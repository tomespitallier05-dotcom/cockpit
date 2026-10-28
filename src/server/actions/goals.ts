"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { assertOwnProject, fail, ok, type ActionResult } from "../dal";
import { db } from "../db";
import { goal, metric, metricValue } from "../db/schema";
import { getActionUser } from "../session";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

function message(error: unknown) {
  return error instanceof z.ZodError ? new Error(error.issues[0]?.message ?? "Données invalides.") : error;
}

const metricInput = z.object({
  name: z.string().trim().min(1, "Nomme l'indicateur.").max(80),
  unit: z.string().trim().max(20).nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  direction: z.enum(["up", "down"]).default("up"),
  aggregation: z.enum(["last", "sum", "avg"]).default("last"),
});

export async function createMetric(input: z.input<typeof metricInput>): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await getActionUser();
    const data = metricInput.parse(input);
    const projectId = await assertOwnProject(me, data.projectId);
    const [row] = await db
      .insert(metric)
      .values({ ...data, unit: data.unit || null, projectId, workspaceId: me.workspaceId })
      .returning({ id: metric.id });
    refresh();
    return ok({ id: row.id });
  } catch (error) {
    return fail(message(error));
  }
}

export async function updateMetric(id: string, input: Partial<z.input<typeof metricInput>>): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    const data = metricInput.partial().parse(input);
    const projectId = data.projectId === undefined ? undefined : await assertOwnProject(me, data.projectId);
    await db
      .update(metric)
      .set({ ...data, projectId })
      .where(and(eq(metric.id, z.uuid().parse(id)), eq(metric.workspaceId, me.workspaceId)));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(message(error));
  }
}

export async function archiveMetric(id: string): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    await db
      .update(metric)
      .set({ archivedAt: new Date() })
      .where(and(eq(metric.id, z.uuid().parse(id)), eq(metric.workspaceId, me.workspaceId)));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(message(error));
  }
}

const valuesInput = z.array(
  z.object({
    metricId: z.uuid(),
    date: day,
    value: z.number().finite().nullable(),
    note: z.string().trim().max(500).nullable().optional(),
  }),
);

/** Check-in: one value per KPI and date (re-entering a date replaces it; null clears it). */
export async function recordMetricValues(input: z.input<typeof valuesInput>): Promise<ActionResult<{ saved: number }>> {
  try {
    const me = await getActionUser();
    const rows = valuesInput.parse(input);
    if (rows.length === 0) return ok({ saved: 0 });
    const owned = await db
      .select({ id: metric.id })
      .from(metric)
      .where(and(eq(metric.workspaceId, me.workspaceId), inArray(metric.id, [...new Set(rows.map((r) => r.metricId))])));
    const allowed = new Set(owned.map((m) => m.id));
    let saved = 0;
    for (const row of rows) {
      if (!allowed.has(row.metricId)) throw new Error("Indicateur introuvable.");
      if (row.value === null) {
        await db.delete(metricValue).where(and(eq(metricValue.metricId, row.metricId), eq(metricValue.date, row.date)));
        continue;
      }
      await db
        .insert(metricValue)
        .values({ metricId: row.metricId, date: row.date, value: String(row.value), note: row.note ?? null })
        .onConflictDoUpdate({
          target: [metricValue.metricId, metricValue.date],
          set: { value: String(row.value), note: row.note ?? null },
        });
      saved += 1;
    }
    refresh();
    return ok({ saved });
  } catch (error) {
    return fail(message(error));
  }
}

const goalInput = z
  .object({
    title: z.string().trim().min(1, "Donne un titre à l'objectif.").max(160),
    description: z.string().trim().max(2000).nullable().optional(),
    projectId: z.uuid().nullable().optional(),
    period: z.enum(["month", "quarter", "year", "custom"]).default("month"),
    startsOn: day,
    endsOn: day,
    kind: z.enum(["metric", "milestone"]).default("milestone"),
    metricId: z.uuid().nullable().optional(),
    startValue: z.number().finite().nullable().optional(),
    targetValue: z.number().finite().nullable().optional(),
  })
  .refine((g) => g.endsOn >= g.startsOn, { message: "La fin doit suivre le début." })
  .refine((g) => g.kind === "milestone" || (g.metricId && g.targetValue != null), {
    message: "Choisis l'indicateur et la cible.",
  });

export async function createGoal(input: z.input<typeof goalInput>): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await getActionUser();
    const data = goalInput.parse(input);
    const projectId = await assertOwnProject(me, data.projectId);
    if (data.metricId) {
      const [owned] = await db
        .select({ id: metric.id })
        .from(metric)
        .where(and(eq(metric.id, data.metricId), eq(metric.workspaceId, me.workspaceId)));
      if (!owned) throw new Error("Indicateur introuvable.");
    }
    const [row] = await db
      .insert(goal)
      .values({
        workspaceId: me.workspaceId,
        projectId,
        title: data.title,
        description: data.description || null,
        period: data.period,
        startsOn: data.startsOn,
        endsOn: data.endsOn,
        kind: data.kind,
        metricId: data.kind === "metric" ? data.metricId : null,
        startValue: data.startValue == null ? null : String(data.startValue),
        targetValue: data.targetValue == null ? null : String(data.targetValue),
      })
      .returning({ id: goal.id });
    refresh();
    return ok({ id: row.id });
  } catch (error) {
    return fail(message(error));
  }
}

export async function setGoalStatus(id: string, status: "active" | "achieved" | "missed" | "dropped"): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    await db
      .update(goal)
      .set({ status: z.enum(["active", "achieved", "missed", "dropped"]).parse(status) })
      .where(and(eq(goal.id, z.uuid().parse(id)), eq(goal.workspaceId, me.workspaceId)));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(message(error));
  }
}
