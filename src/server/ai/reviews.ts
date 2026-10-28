import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import { zonedInstant } from "@/lib/dates";
import { periodTitle, type Period } from "@/lib/periods";
import { db } from "../db";
import { contentItem, entry, insight, inventoryItem, metric, metricValue, project, review, task } from "../db/schema";
import { generateStructured, textBlock } from "./claude";
import { aiMock, claudeAvailable } from "./config";

/**
 * Reviews from the day to the year. The numbers are collected deterministically
 * (and frozen in `metricsSnapshot`, so old reviews stay truthful); Claude writes
 * the narrative from those numbers and the period's insights, never from memory.
 */
export type PeriodData = Awaited<ReturnType<typeof collectPeriod>>;

export async function collectPeriod(workspaceId: string, timeZone: string, start: string, end: string) {
  const from = zonedInstant(start, "00:00", timeZone);
  const to = zonedInstant(end, "23:59:59", timeZone);

  const [tasksDone, overdue, entries, insights, metrics, sold, published] = await Promise.all([
    db
      .select({ title: task.title, projectName: project.name, completedAt: task.completedAt })
      .from(task)
      .leftJoin(project, eq(project.id, task.projectId))
      .where(and(eq(task.workspaceId, workspaceId), eq(task.status, "done"), isNull(task.deletedAt), gte(task.completedAt, from), lte(task.completedAt, to)))
      .orderBy(asc(task.completedAt)),
    db
      .select({ title: task.title, dueAt: task.dueAt })
      .from(task)
      .where(and(eq(task.workspaceId, workspaceId), inArray(task.status, ["todo", "in_progress"]), isNull(task.deletedAt), lte(task.dueAt, to)))
      .orderBy(asc(task.dueAt))
      .limit(30),
    db
      .select({ id: entry.id, title: entry.title, type: entry.type, occurredAt: entry.occurredAt, meta: entry.meta, isPrivate: entry.isPrivate })
      .from(entry)
      .where(and(eq(entry.workspaceId, workspaceId), isNull(entry.deletedAt), gte(entry.occurredAt, from), lte(entry.occurredAt, to)))
      .orderBy(asc(entry.occurredAt))
      .limit(200),
    db
      .select({ type: insight.type, status: insight.status, content: insight.content, appliedAt: insight.appliedAt, createdAt: insight.createdAt })
      .from(insight)
      .innerJoin(entry, eq(entry.id, insight.sourceEntryId))
      .where(
        and(
          eq(insight.workspaceId, workspaceId),
          inArray(insight.status, ["proposed", "accepted", "applied"]),
          eq(entry.isPrivate, false),
          gte(insight.updatedAt, from),
          lte(insight.createdAt, to),
        ),
      )
      .orderBy(desc(insight.createdAt))
      .limit(150),
    db
      .select({ id: metric.id, name: metric.name, unit: metric.unit, direction: metric.direction, aggregation: metric.aggregation, projectName: project.name })
      .from(metric)
      .leftJoin(project, eq(project.id, metric.projectId))
      .where(and(eq(metric.workspaceId, workspaceId), isNull(metric.archivedAt))),
    db
      .select({ name: inventoryItem.name, buy: inventoryItem.buyPriceCents, sell: inventoryItem.sellPriceCents, fees: inventoryItem.feesCents })
      .from(inventoryItem)
      .where(and(eq(inventoryItem.workspaceId, workspaceId), eq(inventoryItem.status, "sold"), isNull(inventoryItem.deletedAt), gte(inventoryItem.soldOn, start), lte(inventoryItem.soldOn, end))),
    db
      .select({ title: contentItem.title, format: contentItem.format, stats: contentItem.stats })
      .from(contentItem)
      .where(and(eq(contentItem.workspaceId, workspaceId), isNull(contentItem.deletedAt), gte(contentItem.publishedOn, start), lte(contentItem.publishedOn, end))),
  ]);

  const values = metrics.length
    ? await db
        .select({ metricId: metricValue.metricId, date: metricValue.date, value: metricValue.value })
        .from(metricValue)
        .where(and(inArray(metricValue.metricId, metrics.map((m) => m.id)), lte(metricValue.date, end)))
        .orderBy(asc(metricValue.date))
    : [];

  const kpis = metrics.map((m) => {
    const series = values.filter((v) => v.metricId === m.id).map((v) => ({ date: v.date, value: Number(v.value) }));
    const inPeriod = series.filter((v) => v.date >= start);
    const before = series.filter((v) => v.date < start).at(-1) ?? null;
    const endValue =
      m.aggregation === "sum"
        ? inPeriod.reduce((total, v) => total + v.value, 0)
        : m.aggregation === "avg"
          ? inPeriod.length
            ? inPeriod.reduce((total, v) => total + v.value, 0) / inPeriod.length
            : null
          : (inPeriod.at(-1)?.value ?? null);
    const startValue = m.aggregation === "sum" ? null : (before?.value ?? inPeriod[0]?.value ?? null);
    return {
      name: m.name,
      unit: m.unit,
      projectName: m.projectName,
      direction: m.direction,
      aggregation: m.aggregation,
      start: startValue,
      end: endValue,
      points: inPeriod.length,
    };
  });

  const profitCents = sold.reduce((sum, i) => sum + (i.sell ?? 0) - i.buy - i.fees, 0);
  const views = published.reduce((sum, c) => sum + ((c.stats as { views?: number }).views ?? 0), 0);

  return {
    start,
    end,
    tasksDone: tasksDone.map((t) => ({ title: t.title, projectName: t.projectName })),
    overdue: overdue.filter((t) => t.dueAt && t.dueAt < new Date()).map((t) => t.title),
    entries: entries.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      summary: e.isPrivate ? null : ((e.meta as { ai?: { suggestion?: { summary?: string } } }).ai?.suggestion?.summary ?? null),
    })),
    insights: {
      advice: insights.filter((i) => i.type === "advice").map((i) => ({ content: i.content, status: i.status })),
      decisions: insights.filter((i) => i.type === "decision").map((i) => i.content),
      mistakes: insights.filter((i) => i.type === "mistake").map((i) => i.content),
      lessons: insights.filter((i) => i.type === "lesson").map((i) => i.content),
      wins: insights.filter((i) => i.type === "key_fact").map((i) => i.content),
    },
    adviceApplied: insights.filter((i) => i.type === "advice" && i.appliedAt && i.appliedAt >= from && i.appliedAt <= to).length,
    kpis,
    resale: { soldCount: sold.length, profitCents },
    content: { publishedCount: published.length, views },
  };
}

const reviewSchema = z.object({
  summary: z.string().describe("2 ou 3 phrases : le bilan de la période, chiffres à l'appui."),
  wins: z.array(z.string()).describe("Les meilleurs résultats, chiffrés quand c'est possible."),
  blockers: z.array(z.string()).describe("Ce qui a bloqué ou glissé."),
  lessons: z.array(z.string()).describe("Ce qu'il faut retenir."),
  adviceFollowUp: z.string().describe("Où en est l'application des conseils reçus."),
  nextFocus: z.array(z.string()).describe("3 priorités concrètes pour la période suivante."),
  question: z.string().describe("Une question de réflexion personnelle pour la suite."),
});

export type ReviewNarrative = z.infer<typeof reviewSchema>;

function deterministicNarrative(data: PeriodData): ReviewNarrative {
  const moved = data.kpis.filter((k) => k.end !== null);
  return {
    summary: `${data.tasksDone.length} tâche${data.tasksDone.length > 1 ? "s" : ""} terminée${data.tasksDone.length > 1 ? "s" : ""}, ${data.adviceApplied} conseil${data.adviceApplied > 1 ? "s" : ""} appliqué${data.adviceApplied > 1 ? "s" : ""}${data.resale.soldCount ? `, ${data.resale.soldCount} vente(s) pour ${(data.resale.profitCents / 100).toFixed(0)} € de bénéfice` : ""}${data.content.publishedCount ? `, ${data.content.publishedCount} contenu(s) publié(s)` : ""}.`,
    wins: moved.map((k) => `${k.name} : ${k.start ?? "—"} → ${k.end}${k.unit ? ` ${k.unit}` : ""}`).slice(0, 5),
    blockers: data.overdue.slice(0, 5).map((t) => `En retard : ${t}`),
    lessons: data.insights.lessons.slice(0, 5),
    adviceFollowUp: `${data.adviceApplied} appliqué(s) sur la période, ${data.insights.advice.filter((a) => a.status === "accepted").length} encore à appliquer.`,
    nextFocus: data.overdue.slice(0, 3),
    question: "Qu'est-ce qui aurait le plus d'impact si tu le faisais en premier la semaine prochaine ?",
  };
}

const REVIEW_SYSTEM = `Tu rédiges le bilan périodique d'un entrepreneur francophone (achat-revente, création de contenu, business), à partir de données chiffrées et d'éléments extraits de son journal.
Règles :
- Tutoie-le. Sois honnête et concret : des résultats d'abord, de l'activité ensuite. Pas de compliments vides.
- N'utilise que les données fournies. Cite les chiffres (KPI, ventes, tâches, conseils appliqués).
- Le nombre de notes n'est jamais un indicateur de progrès.
- Si les données sont minces, dis-le et recommande de mieux mesurer (check-in des KPI, marquer les conseils appliqués).`;

export async function writeNarrative(workspaceId: string, period: Period, data: PeriodData, answers?: Record<string, string>) {
  if (!claudeAvailable() || aiMock()) return { narrative: deterministicNarrative(data), by: "user" as const };
  const facts = JSON.stringify(
    {
      periode: periodTitle(period, data.start),
      taches_terminees: data.tasksDone,
      taches_en_retard: data.overdue,
      kpi: data.kpis,
      achat_revente: { ventes: data.resale.soldCount, benefice_euros: data.resale.profitCents / 100 },
      contenu: { publications: data.content.publishedCount, vues: data.content.views },
      conseils: data.insights.advice,
      conseils_appliques_sur_la_periode: data.adviceApplied,
      decisions: data.insights.decisions,
      erreurs: data.insights.mistakes,
      lecons: data.insights.lessons,
      faits_cles: data.insights.wins,
      entrees: data.entries.filter((e) => e.summary).map((e) => `${e.title ?? e.type} : ${e.summary}`).slice(0, 60),
      reponses_de_la_revue: answers ?? null,
    },
    null,
    1,
  );
  const narrative = await generateStructured({
    workspaceId,
    feature: "review",
    schema: reviewSchema,
    system: REVIEW_SYSTEM,
    effort: period === "quarter" || period === "year" ? "high" : "medium",
    maxTokens: 16000,
    content: [textBlock(facts)],
  });
  return { narrative, by: "ai" as const };
}

/** Creates or refreshes the review for one period, keeping the owner's own answers. */
export async function generateReview(options: {
  workspaceId: string;
  timeZone: string;
  period: Period;
  start: string;
  end: string;
  answers?: Record<string, string>;
}) {
  const data = await collectPeriod(options.workspaceId, options.timeZone, options.start, options.end);
  const [existing] = await db
    .select({ id: review.id, content: review.content })
    .from(review)
    .where(and(eq(review.workspaceId, options.workspaceId), isNull(review.projectId), eq(review.period, options.period), eq(review.periodStart, options.start)));
  const previous = (existing?.content ?? {}) as { answers?: Record<string, string> };
  const answers = options.answers ?? previous.answers;
  const { narrative, by } = await writeNarrative(options.workspaceId, options.period, data, answers);
  const content = {
    ...previous,
    answers,
    narrative,
    stats: {
      tasksDone: data.tasksDone.length,
      adviceApplied: data.adviceApplied,
      soldCount: data.resale.soldCount,
      profitCents: data.resale.profitCents,
      published: data.content.publishedCount,
      views: data.content.views,
    },
    tasksDone: data.tasksDone.slice(0, 50),
  };
  const values = {
    content,
    summary: narrative.summary,
    metricsSnapshot: data.kpis,
    generatedBy: by,
  };
  if (existing) {
    await db.update(review).set(values).where(eq(review.id, existing.id));
    return existing.id;
  }
  const [row] = await db
    .insert(review)
    .values({ workspaceId: options.workspaceId, period: options.period, periodStart: options.start, periodEnd: options.end, ...values })
    .returning({ id: review.id });
  return row.id;
}
