import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
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
 * call does no harm.
 *
 * Access: CRON_SECRET is mandatory. Vercel sends it as `Authorization: Bearer …`
 * when the variable is set on the project; any other caller gets a 401, and a
 * missing secret is a 500 (a misconfiguration to fix, never an open endpoint).
 *
 * Failures: each step runs in its own try/catch, so one failing step does not
 * block the others or the other workspaces. Errors are sent to Sentry, and the
 * response is a 500 whenever a step failed, so Vercel marks the run as failed.
 * The whole run is also a Sentry cron monitor: a run that errors or never
 * happens raises an alert (see docs/PRODUCT.md, « Variables d'environnement »).
 */
function authorized(request: Request, secret: string) {
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

type StepReport = Record<string, unknown> & { workspace: string; errors?: Record<string, string> };

/** Runs one step of the job; a failure is reported and recorded, never thrown. */
async function step(report: StepReport, name: string, run: () => Promise<void>) {
  try {
    await run();
  } catch (error) {
    console.error("cron daily", report.workspace, name, error);
    Sentry.captureException(error, { tags: { job: "cron-daily", step: name }, extra: { workspace: report.workspace } });
    (report.errors ??= {})[name] = error instanceof Error ? error.message : String(error);
  }
}

async function runDaily() {
  const report: StepReport[] = [];
  const spaces = await db.select({ id: workspace.id, timezone: workspace.timezone }).from(workspace);

  for (const space of spaces) {
    const today = dayKey(new Date(), space.timezone);
    const done: StepReport = { workspace: space.id };

    await step(done, "brief", async () => {
      if (await getBrief(space.id, today)) return;
      const brief = await buildBrief(space.id, { useAi: true });
      done.brief = brief.generatedBy;
      const { counts } = brief.content;
      await notify(space.id, {
        kind: "brief",
        title: "Ton brief du jour",
        body: [brief.content.focus, counts.overdue ? `${counts.overdue} en retard` : null, counts.inbox ? `${counts.inbox} à trier` : null].filter(Boolean).join(" · "),
        href: "/",
      });
    });

    await step(done, "reminders", async () => {
      const due = await db
        .select()
        .from(reminder)
        .where(and(eq(reminder.workspaceId, space.id), isNull(reminder.sentAt), lte(reminder.remindAt, new Date())));
      let sent = 0;
      for (const item of due) {
        await notify(space.id, { kind: "reminder", title: item.message ?? "Rappel", href: item.targetType === "task" && item.targetId ? `/taches?tache=${item.targetId}` : "/" });
        await db.update(reminder).set({ sentAt: new Date() }).where(eq(reminder.id, item.id));
        sent += 1;
      }
      done.reminders = sent;
    });

    for (const { period, due: isDue } of PERIOD_STARTS) {
      if (!isDue(today)) continue;
      await step(done, `review-${period}`, async () => {
        const range = periodRange(period, today, -1);
        const [exists] = await db
          .select({ id: review.id })
          .from(review)
          .where(and(eq(review.workspaceId, space.id), isNull(review.projectId), eq(review.period, period), eq(review.periodStart, range.start)));
        if (exists) return;
        const id = await generateReview({ workspaceId: space.id, timeZone: space.timezone, period, ...range });
        await notify(space.id, { kind: "review", title: `Bilan prêt : ${periodTitle(period, range.start)}`, href: `/bilans/${id}` });
      });
    }

    if (claudeAvailable()) {
      await step(done, "analysis", async () => {
        const ids = await staleEntries(space.id, 15);
        let analysed = 0;
        for (const id of ids) {
          // One broken entry must not stop the analysis of the others.
          try {
            await processEntry(space.id, id);
            analysed += 1;
          } catch (error) {
            console.error("cron daily", space.id, "entry", id, error);
            Sentry.captureException(error, { tags: { job: "cron-daily", step: "analysis-entry" }, extra: { workspace: space.id, entry: id } });
            (done.errors ??= {})[`analysis:${id}`] = error instanceof Error ? error.message : String(error);
          }
        }
        done.analysed = analysed;
      });
    }

    report.push(done);
  }
  return report;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("cron daily: CRON_SECRET n'est pas défini, la tâche quotidienne est désactivée.");
    return NextResponse.json({ error: "CRON_SECRET n'est pas configuré sur le serveur." }, { status: 500 });
  }
  if (!authorized(request, secret)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  let report: StepReport[] = [];
  try {
    // Sentry cron monitor: alerts when a run fails or when no run arrives on time.
    await Sentry.withMonitor(
      "cron-daily",
      async () => {
        report = await runDaily();
        if (report.some((item) => item.errors)) throw new Error("Au moins une étape de la tâche quotidienne a échoué.");
      },
      { schedule: { type: "crontab", value: "0 5 * * *" }, checkinMargin: 60, maxRuntime: 6, timezone: "UTC" },
    );
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    console.error("cron daily", error);
    // Step failures were already reported one by one; only a crash of the job itself is new.
    if (report.length === 0) Sentry.captureException(error, { tags: { job: "cron-daily" } });
    await Sentry.flush(2000).catch(() => false);
    return NextResponse.json(
      { ok: false, error: "La tâche quotidienne a échoué.", detail: error instanceof Error ? error.message : String(error), report },
      { status: 500 },
    );
  }
}
