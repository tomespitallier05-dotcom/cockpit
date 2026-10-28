import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { dayKey } from "@/lib/dates";
import { requireUser } from "../dal";
import { db } from "../db";
import { goal, metric, metricValue, project } from "../db/schema";

export type MetricView = {
  id: string;
  name: string;
  unit: string | null;
  direction: "up" | "down";
  aggregation: "last" | "sum" | "avg";
  projectId: string | null;
  projectName: string | null;
  projectColor: string | null;
  series: { date: string; value: number }[];
  latest: { date: string; value: number } | null;
  previous: { date: string; value: number } | null;
};

export async function listMetrics(options: { projectId?: string; historyDays?: number } = {}): Promise<MetricView[]> {
  const me = await requireUser();
  const metrics = await db
    .select({
      id: metric.id,
      name: metric.name,
      unit: metric.unit,
      direction: metric.direction,
      aggregation: metric.aggregation,
      projectId: metric.projectId,
      projectName: project.name,
      projectColor: project.color,
    })
    .from(metric)
    .leftJoin(project, eq(project.id, metric.projectId))
    .where(
      and(
        eq(metric.workspaceId, me.workspaceId),
        isNull(metric.archivedAt),
        options.projectId ? eq(metric.projectId, options.projectId) : undefined,
      ),
    )
    .orderBy(asc(metric.position), asc(metric.createdAt));
  if (metrics.length === 0) return [];

  const since = dayKey(new Date(Date.now() - (options.historyDays ?? 365) * 86400000), me.timezone);
  const values = await db
    .select({ metricId: metricValue.metricId, date: metricValue.date, value: metricValue.value })
    .from(metricValue)
    .where(inArray(metricValue.metricId, metrics.map((m) => m.id)))
    .orderBy(asc(metricValue.date));

  return metrics.map((m) => {
    const all = values.filter((v) => v.metricId === m.id).map((v) => ({ date: v.date, value: Number(v.value) }));
    const series = all.filter((v) => v.date >= since);
    return {
      ...m,
      series,
      latest: all.at(-1) ?? null,
      previous: all.at(-2) ?? null,
    };
  });
}

function rollup(values: { date: string; value: number }[], aggregation: "last" | "sum" | "avg") {
  if (values.length === 0) return null;
  if (aggregation === "sum") return values.reduce((total, v) => total + v.value, 0);
  if (aggregation === "avg") return values.reduce((total, v) => total + v.value, 0) / values.length;
  return values[values.length - 1].value;
}

export type GoalView = {
  id: string;
  title: string;
  description: string | null;
  period: string;
  startsOn: string;
  endsOn: string;
  kind: "metric" | "milestone";
  status: "active" | "achieved" | "missed" | "dropped";
  projectId: string | null;
  projectName: string | null;
  metricId: string | null;
  metricName: string | null;
  unit: string | null;
  startValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  /** 0..1, computed from measurements, never declared. */
  progress: number;
  /** Where progress should be today at a linear pace (0..1). */
  expected: number;
  daysLeft: number;
};

/**
 * Goals with progress computed from KPI values in the goal's period. For a
 * "sum" KPI (sales, posts…) the period total counts; for "last" the latest value.
 */
export async function listGoals(options: { projectId?: string; includeClosed?: boolean } = {}): Promise<GoalView[]> {
  const me = await requireUser();
  const rows = await db
    .select({
      goal,
      projectName: project.name,
      metricName: metric.name,
      unit: metric.unit,
      aggregation: metric.aggregation,
    })
    .from(goal)
    .leftJoin(project, eq(project.id, goal.projectId))
    .leftJoin(metric, eq(metric.id, goal.metricId))
    .where(
      and(
        eq(goal.workspaceId, me.workspaceId),
        options.projectId ? eq(goal.projectId, options.projectId) : undefined,
        options.includeClosed ? undefined : eq(goal.status, "active"),
      ),
    )
    .orderBy(asc(goal.endsOn), desc(goal.createdAt));

  const metricIds = [...new Set(rows.map((r) => r.goal.metricId).filter((id): id is string => Boolean(id)))];
  const values = metricIds.length
    ? await db
        .select({ metricId: metricValue.metricId, date: metricValue.date, value: metricValue.value })
        .from(metricValue)
        .where(inArray(metricValue.metricId, metricIds))
        .orderBy(asc(metricValue.date))
    : [];

  const today = dayKey(new Date(), me.timezone);
  return rows.map(({ goal: g, projectName, metricName, unit, aggregation }) => {
    const start = Date.parse(g.startsOn);
    const end = Date.parse(g.endsOn);
    const now = Date.parse(today);
    const expected = end > start ? Math.max(0, Math.min(1, (now - start) / (end - start))) : 1;
    const daysLeft = Math.max(0, Math.round((end - now) / 86400000));
    const startValue = g.startValue === null ? null : Number(g.startValue);
    const targetValue = g.targetValue === null ? null : Number(g.targetValue);

    let currentValue: number | null = null;
    let progress = g.status === "achieved" ? 1 : 0;
    if (g.kind === "metric" && g.metricId && targetValue !== null) {
      const inPeriod = values
        .filter((v) => v.metricId === g.metricId && v.date >= g.startsOn && v.date <= g.endsOn)
        .map((v) => ({ date: v.date, value: Number(v.value) }));
      currentValue = rollup(inPeriod, aggregation ?? "last");
      const before = values.filter((v) => v.metricId === g.metricId && v.date < g.startsOn).at(-1);
      const base = aggregation === "sum" ? 0 : (startValue ?? (before ? Number(before.value) : 0));
      if (currentValue !== null && targetValue !== base) {
        progress = Math.max(0, Math.min(1, (currentValue - base) / (targetValue - base)));
      }
    }
    return {
      id: g.id,
      title: g.title,
      description: g.description,
      period: g.period,
      startsOn: g.startsOn,
      endsOn: g.endsOn,
      kind: g.kind,
      status: g.status,
      projectId: g.projectId,
      projectName,
      metricId: g.metricId,
      metricName,
      unit,
      startValue,
      targetValue,
      currentValue,
      progress,
      expected: g.status === "active" ? expected : 1,
      daysLeft,
    };
  });
}
