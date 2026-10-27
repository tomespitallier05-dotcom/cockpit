"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "@/lib/entry-catalog";
import { assertOwnContacts, assertOwnProject, fail, ok, type ActionResult } from "../dal";
import { db } from "../db";
import { entry, task } from "../db/schema";
import { getActionUser } from "../session";

const taskId = z.uuid();
const priority = z.enum(Object.keys(TASK_PRIORITIES) as [TaskPriority, ...TaskPriority[]]);
const status = z.enum(Object.keys(TASK_STATUSES) as [TaskStatus, ...TaskStatus[]]);

const taskInput = z.object({
  title: z.string().trim().min(1, "Donne un titre à la tâche.").max(200, "200 caractères maximum."),
  description: z.string().trim().max(5000).nullable().optional(),
  priority: priority.optional(),
  status: status.optional(),
  dueAt: z.coerce.date().nullable().optional(),
  estimateMinutes: z.number().int().min(0).max(10_000).nullable().optional(),
  actualMinutes: z.number().int().min(0).max(100_000).nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  promisedToContactId: z.uuid().nullable().optional(),
  sourceEntryId: z.uuid().nullable().optional(),
});

export type TaskInput = z.input<typeof taskInput>;

function message(error: unknown) {
  return error instanceof z.ZodError ? new Error(error.issues[0]?.message ?? "Données invalides.") : error;
}

async function checkRefs(me: Awaited<ReturnType<typeof getActionUser>>, data: Partial<z.output<typeof taskInput>>) {
  const projectId = data.projectId === undefined ? undefined : await assertOwnProject(me, data.projectId);
  let promisedToContactId = data.promisedToContactId;
  if (promisedToContactId) [promisedToContactId] = await assertOwnContacts(me, [promisedToContactId]);
  if (data.sourceEntryId) {
    const [owned] = await db
      .select({ id: entry.id })
      .from(entry)
      .where(and(eq(entry.id, data.sourceEntryId), eq(entry.workspaceId, me.workspaceId)));
    if (!owned) throw new Error("Entrée introuvable.");
  }
  return { projectId, promisedToContactId };
}

export async function createTask(input: TaskInput): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await getActionUser();
    const data = taskInput.parse(input);
    const refs = await checkRefs(me, data);
    const [created] = await db
      .insert(task)
      .values({
        ...data,
        ...refs,
        workspaceId: me.workspaceId,
        completedAt: data.status === "done" ? new Date() : null,
      })
      .returning({ id: task.id });
    refresh();
    return ok({ id: created.id });
  } catch (error) {
    return fail(message(error));
  }
}

export async function updateTask(id: string, input: Partial<TaskInput>): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    const data = taskInput.partial().parse(input);
    const refs = await checkRefs(me, data);
    await db
      .update(task)
      .set({
        ...data,
        ...refs,
        completedAt:
          data.status === undefined ? undefined : data.status === "done" ? new Date() : null,
      })
      .where(and(eq(task.id, taskId.parse(id)), eq(task.workspaceId, me.workspaceId), isNull(task.deletedAt)));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(message(error));
  }
}

export async function setTaskDone(id: string, done: boolean): Promise<ActionResult> {
  return updateTask(id, { status: done ? "done" : "todo" });
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    await db
      .update(task)
      .set({ deletedAt: new Date() })
      .where(and(eq(task.id, taskId.parse(id)), eq(task.workspaceId, me.workspaceId)));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(message(error));
  }
}
