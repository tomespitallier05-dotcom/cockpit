import { timingSafeEqual } from "node:crypto";
import { and, eq, isNull, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { dayKey } from "@/lib/dates";
import { periodRange, periodTitle, type Period } from "@/lib/periods";
import { buildBrief, getBrief } from "@/server/ai/brief";
import { claudeAvailable } from "@/server/ai/config";
import { processEntry, staleEntries } from "@/server/ai/pipeline";
import { generateReview } from "@/server/ai/reviews";
import { db } from "@/server/db";
import { reminder, review, workspace } from "@/server/db/schema";
import { notify } from "@/server/notify";

export const maxDuration = 300;

/**
 * Daily job (Vercel Cron, ~6–7 h Paris): morning brief, reminders, automatic
 * reviews at the start of each week / month / quarter / year, and gradual
 * analysis of entries that changed. Every step is idempotent, so a repeated
 * call does no harm; with CRON_SECRET set, only Vercel's signed call runs it.
 */
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return request.headers.get("user-agent")?.includes("vercel-cron") ?? false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const PERIOD_STARTS: { period: Period; due: (today: string) => boolean }[] = [
  { period: "week", due: (today) => new Date(`${today}T12:00:00Z`).getUTCDay() === 1 },
  { period: "month", due: (today) => today.endsWith("-01") },
  { period: "quarter", due: (today) => /-(01|04|07|10)-01$/.test(today) },
  { period: "year", due: (today) => today.endsWith("-01-01") },
];

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const report: Record<string, unknown>[] = [];
  const spaces = await db.select({ id: workspace.id, timezone: workspace.timezone }).from(workspace);

  for (const space of spaces) {
    const today = dayKey(new Date(), space.timezone);
    const done: Record<string, unknown> = { workspace: space.id };
    try {
      if (!(await getBrief(space.id, today))) {
        const brief = await buildBrief(space.id, { useAi: true });
        const { counts } = brief.content;
        await notify(space.id, {
          kind: "brief",
          title: "Ton brief du jour",
          body: [brief.content.focus, counts.overdue ? `${counts.overdue} en retard` : null, counts.inbox ? `${counts.inbox} à trier` : null].filter(Boolean).join(" · "),
          href: "/",
        });
        done.brief = brief.generatedBy;
      }

      const due = await db
        .select()
        .from(reminder)
        .where(and(eq(reminder.workspaceId, space.id), isNull(reminder.sentAt), lte(reminder.remindAt, new Date())));
      for (const item of due) {
        await notify(space.id, { kind: "reminder", title: item.message ?? "Rappel", href: item.targetType === "task" && item.targetId ? `/taches?tache=${item.targetId}` : "/" });
        await db.update(reminder).set({ sentAt: new Date() }).where(eq(reminder.id, item.id));
      }
      done.reminders = due.length;

      for (const { period, due: isDue } of PERIOD_STARTS) {
        if (!isDue(today)) continue;
        const range = periodRange(period, today, -1);
        const [exists] = await db
          .select({ id: review.id })
          .from(review)
          .where(and(eq(review.workspaceId, space.id), isNull(review.projectId), eq(review.period, period), eq(review.periodStart, range.start)));
        const id = exists?.id ?? (await generateReview({ workspaceId: space.id, timeZone: space.timezone, period, ...range }));
        if (!exists) {
          await notify(space.id, { kind: "review", title: `Bilan prêt : ${periodTitle(period, range.start)}`, href: `/bilans/${id}` });
        }
      }

      if (claudeAvailable()) {
        const ids = await staleEntries(space.id, 15);
        for (const id of ids) await processEntry(space.id, id);
        done.analysed = ids.length;
      }
    } catch (error) {
      console.error("cron daily", space.id, error);
      done.error = error instanceof Error ? error.message : String(error);
    }
    report.push(done);
  }
  return NextResponse.json({ ok: true, report });
}
