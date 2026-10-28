import "server-only";
import { and, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { dayKey } from "@/lib/dates";
import { addDaysTo, periodRange } from "@/lib/periods";
import { requireUser } from "../dal";
import { db } from "../db";
import { contentItem, entry, goal, insight, inventoryItem, project, task } from "../db/schema";

const MONTHS = 6;

function monthLabel(key: string) {
  return new Date(`${key}-15T12:00:00Z`).toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" });
}

/** Results first, activity second: everything the Analytics page plots. */
export async function getAnalytics() {
  const me = await requireUser();
  const ws = me.workspaceId;
  const today = dayKey(new Date(), me.timezone);
  const firstWeek = periodRange("week", today, -11).start;
  const firstMonth = periodRange("month", today, -(MONTHS - 1)).start;
  const since30 = new Date(Date.now() - 30 * 86400000);
  const tz = me.timezone;

  const [weeklyTasks, adviceRows, sold, published, goals, taskTime, callTime, projects] = await Promise.all([
    db
      .select({ week: sql<string>`to_char(date_trunc('week', ${task.completedAt} at time zone ${tz}), 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
      .from(task)
      .where(and(eq(task.workspaceId, ws), eq(task.status, "done"), isNull(task.deletedAt), gte(task.completedAt, new Date(`${firstWeek}T00:00:00Z`))))
      .groupBy(sql`1`),
    db
      .select({ status: insight.status, createdAt: insight.createdAt })
      .from(insight)
      .where(and(eq(insight.workspaceId, ws), eq(insight.type, "advice"), inArray(insight.status, ["accepted", "applied"]), gte(insight.createdAt, new Date(`${firstMonth}T00:00:00Z`)))),
    db
      .select({ soldOn: inventoryItem.soldOn, sell: inventoryItem.sellPriceCents, buy: inventoryItem.buyPriceCents, fees: inventoryItem.feesCents })
      .from(inventoryItem)
      .where(and(eq(inventoryItem.workspaceId, ws), eq(inventoryItem.status, "sold"), isNull(inventoryItem.deletedAt), gte(inventoryItem.soldOn, firstMonth))),
    db
      .select({ publishedOn: contentItem.publishedOn, stats: contentItem.stats })
      .from(contentItem)
      .where(and(eq(contentItem.workspaceId, ws), isNull(contentItem.deletedAt), gte(contentItem.publishedOn, firstMonth))),
    db
      .select({ status: goal.status, endsOn: goal.endsOn })
      .from(goal)
      .where(and(eq(goal.workspaceId, ws), gte(goal.endsOn, `${today.slice(0, 4)}-01-01`))),
    db
      .select({ projectId: task.projectId, minutes: sql<number>`coalesce(sum(${task.actualMinutes}), 0)::int` })
      .from(task)
      .where(and(eq(task.workspaceId, ws), isNull(task.deletedAt), isNotNull(task.actualMinutes), gte(task.completedAt, since30)))
      .groupBy(task.projectId),
    db
      .select({ projectId: entry.projectId, minutes: sql<number>`coalesce(sum((${entry.meta}->>'durationMinutes')::int), 0)::int` })
      .from(entry)
      .where(and(eq(entry.workspaceId, ws), isNull(entry.deletedAt), eq(entry.type, "call"), gte(entry.occurredAt, since30), sql`${entry.meta} ? 'durationMinutes'`))
      .groupBy(entry.projectId),
    db.select({ id: project.id, name: project.name, color: project.color }).from(project).where(and(eq(project.workspaceId, ws), isNull(project.deletedAt))),
  ]);

  const weeks = Array.from({ length: 12 }, (_, i) => addDaysTo(firstWeek, i * 7));
  const tasksPerWeek = weeks.map((week) => ({
    key: week,
    label: new Date(`${week}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }),
    value: weeklyTasks.find((row) => row.week === week)?.n ?? 0,
    hint: `Semaine du ${new Date(`${week}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })}`,
  }));

  const months = Array.from({ length: MONTHS }, (_, i) => periodRange("month", today, i - (MONTHS - 1)).start.slice(0, 7));
  const adviceByMonth = months.map((key) => {
    const rows = adviceRows.filter((row) => dayKey(row.createdAt, tz).startsWith(key));
    const applied = rows.filter((row) => row.status === "applied").length;
    return { key, label: monthLabel(key), value: rows.length ? Math.round((applied / rows.length) * 100) : 0, hint: `${applied} sur ${rows.length} conseils retenus` };
  });
  const profitByMonth = months.map((key) => {
    const rows = sold.filter((row) => row.soldOn?.startsWith(key));
    const cents = rows.reduce((sum, row) => sum + (row.sell ?? 0) - row.buy - row.fees, 0);
    return { key, label: monthLabel(key), value: Math.round(cents / 100), hint: `${rows.length} vente(s)` };
  });
  const viewsByMonth = months.map((key) => {
    const rows = published.filter((row) => row.publishedOn?.startsWith(key));
    const views = rows.reduce((sum, row) => sum + ((row.stats as { views?: number }).views ?? 0), 0);
    return { key, label: monthLabel(key), value: views, hint: `${rows.length} publication(s)` };
  });

  const minutes = new Map<string | null, number>();
  for (const row of [...taskTime, ...callTime]) minutes.set(row.projectId, (minutes.get(row.projectId) ?? 0) + row.minutes);
  const timeByProject = [...minutes.entries()]
    .map(([projectId, value]) => {
      const p = projects.find((item) => item.id === projectId);
      return { name: p?.name ?? "Sans projet", color: p?.color ?? "slate", minutes: value };
    })
    .filter((row) => row.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  return {
    tasksPerWeek,
    adviceByMonth,
    profitByMonth: sold.length ? profitByMonth : null,
    viewsByMonth: published.length ? viewsByMonth : null,
    timeByProject,
    goals: {
      achieved: goals.filter((g) => g.status === "achieved").length,
      missed: goals.filter((g) => g.status === "missed" || (g.status === "active" && g.endsOn < today)).length,
      active: goals.filter((g) => g.status === "active" && g.endsOn >= today).length,
    },
  };
}
