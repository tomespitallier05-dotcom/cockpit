import "server-only";
import { and, asc, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { dayKey, endOfDayIn, zonedInstant } from "@/lib/dates";
import { db } from "../db";
import { contact, dailyBrief, entry, insight, task, workspace } from "../db/schema";
import { googleAccount, upcomingEvents } from "../google";
import { generateStructured, textBlock } from "./claude";
import { aiMock, claudeAvailable } from "./config";

export type BriefContent = {
  focus: string;
  priorities: { id: string; title: string; reason?: string }[];
  tip: { content: string; insightId: string } | null;
  calls: { title: string; start: string; contactNames: string[]; eventId?: string; entryId?: string }[];
  counts: { overdue: number; today: number; inbox: number; proposed: number; doneYesterday: number };
};

async function gather(workspaceId: string, ownerId: string, timeZone: string) {
  const now = new Date();
  const endToday = endOfDayIn(timeZone, now);
  const today = dayKey(now, timeZone);
  const startToday = zonedInstant(today, "00:00", timeZone);
  const startYesterday = new Date(startToday.getTime() - 86400000);

  const [open, inbox, proposed, doneYesterday, stalled, callEntries, contactsToday] = await Promise.all([
    db
      .select({ id: task.id, title: task.title, priority: task.priority, dueAt: task.dueAt })
      .from(task)
      .where(and(eq(task.workspaceId, workspaceId), inArray(task.status, ["todo", "in_progress"]), isNull(task.deletedAt), lte(task.dueAt, endToday)))
      .orderBy(asc(task.dueAt))
      .limit(40),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(entry)
      .where(and(eq(entry.workspaceId, workspaceId), eq(entry.inboxStatus, "inbox"), isNull(entry.deletedAt))),
    db.select({ n: sql<number>`count(*)::int` }).from(insight).where(and(eq(insight.workspaceId, workspaceId), eq(insight.status, "proposed"))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(task)
      .where(and(eq(task.workspaceId, workspaceId), eq(task.status, "done"), gte(task.completedAt, startYesterday), lt(task.completedAt, startToday))),
    db
      .select({ id: insight.id, content: insight.content })
      .from(insight)
      .where(and(eq(insight.workspaceId, workspaceId), eq(insight.type, "advice"), eq(insight.status, "accepted")))
      .orderBy(asc(insight.updatedAt))
      .limit(5),
    db
      .select({ id: entry.id, title: entry.title, occurredAt: entry.occurredAt })
      .from(entry)
      .where(and(eq(entry.workspaceId, workspaceId), eq(entry.type, "call"), isNull(entry.deletedAt), gte(entry.occurredAt, now), lte(entry.occurredAt, endToday))),
    db
      .select({ name: contact.name, at: contact.nextInteractionAt })
      .from(contact)
      .where(and(eq(contact.workspaceId, workspaceId), isNull(contact.deletedAt), gte(contact.nextInteractionAt, startToday), lte(contact.nextInteractionAt, endToday))),
  ]);

  let calls: BriefContent["calls"] = callEntries.map((c) => ({ title: c.title ?? "Appel", start: c.occurredAt.toISOString(), contactNames: [], entryId: c.id }));
  const google = await googleAccount(ownerId).catch(() => null);
  if (google?.calendar) {
    const events = await upcomingEvents(ownerId, 1).catch(() => []);
    for (const event of events.filter((e) => e.start <= endToday)) {
      if (calls.some((c) => c.start === event.start.toISOString())) continue;
      calls.push({ title: event.title, start: event.start.toISOString(), contactNames: event.attendees.map((a) => a.name ?? a.email), eventId: event.id });
    }
  }
  calls = calls.sort((a, b) => a.start.localeCompare(b.start));
  for (const person of contactsToday) {
    if (!calls.some((c) => c.contactNames.includes(person.name))) {
      calls.push({ title: `Échange prévu avec ${person.name}`, start: person.at!.toISOString(), contactNames: [person.name] });
    }
  }

  const overdue = open.filter((t) => t.dueAt && t.dueAt < startToday);
  const rank = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 } as const;
  const candidates = [...open].sort((a, b) => rank[a.priority] - rank[b.priority] || (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));
  return {
    today,
    candidates,
    stalled,
    calls,
    counts: {
      overdue: overdue.length,
      today: open.length - overdue.length,
      inbox: inbox[0]?.n ?? 0,
      proposed: proposed[0]?.n ?? 0,
      doneYesterday: doneYesterday[0]?.n ?? 0,
    },
  };
}

const briefSchema = z.object({
  focus: z.string().describe("Une phrase : le cap de la journée."),
  priorityIds: z.array(z.string()).describe("Jusqu'à 3 identifiants de tâches, dans l'ordre où les faire."),
  reasons: z.array(z.string()).describe("Pour chaque priorité, en quelques mots, pourquoi maintenant."),
  tipInsightId: z.string().nullable().describe("Identifiant d'un conseil à appliquer aujourd'hui, ou null."),
});

/** Builds (or rebuilds) today's brief. Rules first; Claude orders and frames it when available. */
export async function buildBrief(workspaceId: string, options: { useAi?: boolean } = {}) {
  const [space] = await db.select({ ownerId: workspace.ownerId, timezone: workspace.timezone }).from(workspace).where(eq(workspace.id, workspaceId));
  if (!space) throw new Error("Espace introuvable.");
  const data = await gather(workspaceId, space.ownerId, space.timezone);

  let content: BriefContent = {
    focus:
      data.counts.overdue > 0
        ? `Solde d'abord ${data.counts.overdue} tâche${data.counts.overdue > 1 ? "s" : ""} en retard.`
        : data.calls.length
          ? `${data.calls.length} échange${data.calls.length > 1 ? "s" : ""} prévu${data.calls.length > 1 ? "s" : ""} aujourd'hui : prépare-les.`
          : "Une journée pour avancer sur l'essentiel.",
    priorities: data.candidates.slice(0, 3).map((t) => ({ id: t.id, title: t.title })),
    tip: data.stalled[0] ? { content: data.stalled[0].content, insightId: data.stalled[0].id } : null,
    calls: data.calls,
    counts: data.counts,
  };
  let generatedBy: "rules" | "ai" = "rules";

  if (options.useAi && claudeAvailable() && !aiMock() && (data.candidates.length || data.stalled.length)) {
    const answer = await generateStructured({
      workspaceId,
      feature: "brief",
      schema: briefSchema,
      effort: "low",
      maxTokens: 4000,
      system:
        "Tu prépares le brief du matin d'un entrepreneur francophone. Choisis au plus 3 tâches à faire en priorité aujourd'hui parmi celles fournies (retard, échéance, priorité, promesses), et au plus un conseil à appliquer. Tutoie-le. Sois bref et concret. N'utilise que les identifiants fournis.",
      content: [
        textBlock(
          JSON.stringify({
            date: data.today,
            taches: data.candidates.slice(0, 25).map((t) => ({ id: t.id, titre: t.title, priorite: t.priority, echeance: t.dueAt?.toISOString().slice(0, 10) ?? null })),
            conseils_a_appliquer: data.stalled.map((s) => ({ id: s.id, conseil: s.content })),
            appels_du_jour: data.calls.map((c) => c.title),
            compteurs: data.counts,
          }),
        ),
      ],
    });
    const byId = new Map(data.candidates.map((t) => [t.id, t]));
    const priorities = answer.priorityIds
      .map((id, i) => (byId.has(id) ? { id, title: byId.get(id)!.title, reason: answer.reasons[i] } : null))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .slice(0, 3);
    const tip = data.stalled.find((s) => s.id === answer.tipInsightId);
    content = {
      ...content,
      focus: answer.focus || content.focus,
      priorities: priorities.length ? priorities : content.priorities,
      tip: tip ? { content: tip.content, insightId: tip.id } : content.tip,
    };
    generatedBy = "ai";
  }

  await db
    .insert(dailyBrief)
    .values({ workspaceId, date: data.today, content, summary: content.focus, generatedBy })
    .onConflictDoUpdate({ target: [dailyBrief.workspaceId, dailyBrief.date], set: { content, summary: content.focus, generatedBy } });
  return { content, generatedBy, date: data.today };
}

export async function getBrief(workspaceId: string, date: string) {
  const [row] = await db.select().from(dailyBrief).where(and(eq(dailyBrief.workspaceId, workspaceId), eq(dailyBrief.date, date)));
  return row ? { content: row.content as BriefContent, generatedBy: row.generatedBy, createdAt: row.createdAt } : null;
}
