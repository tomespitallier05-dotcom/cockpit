import "server-only";
import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { requireUser } from "../dal";
import { db } from "../db";
import { contact, project, task } from "../db/schema";

const taskColumns = {
  id: task.id,
  title: task.title,
  description: task.description,
  status: task.status,
  priority: task.priority,
  dueAt: task.dueAt,
  estimateMinutes: task.estimateMinutes,
  actualMinutes: task.actualMinutes,
  completedAt: task.completedAt,
  createdAt: task.createdAt,
  projectId: task.projectId,
  projectName: project.name,
  projectColor: project.color,
  projectIcon: project.icon,
  sourceEntryId: task.sourceEntryId,
  promisedToContactId: task.promisedToContactId,
  promisedToName: contact.name,
};

export type TaskItem = Awaited<ReturnType<typeof listTasks>>[number];

const priorityRank = sql`case ${task.priority} when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 when 'low' then 3 else 4 end`;

/** Open tasks plus those completed in the last 14 days. */
export async function listTasks(options: { projectId?: string; contactId?: string } = {}) {
  const me = await requireUser();
  return db
    .select(taskColumns)
    .from(task)
    .leftJoin(project, eq(task.projectId, project.id))
    .leftJoin(contact, eq(task.promisedToContactId, contact.id))
    .where(
      and(
        eq(task.workspaceId, me.workspaceId),
        isNull(task.deletedAt),
        options.projectId ? eq(task.projectId, options.projectId) : undefined,
        options.contactId ? eq(task.promisedToContactId, options.contactId) : undefined,
        or(
          inArray(task.status, ["todo", "in_progress"]),
          sql`${task.completedAt} > now() - interval '14 days'`,
        ),
      ),
    )
    .orderBy(asc(sql`${task.dueAt} is null`), asc(task.dueAt), asc(priorityRank), desc(task.createdAt));
}

/** Today's focus: overdue, due today, or urgent — three at most. */
export async function todayPriorities(endOfToday: Date) {
  const me = await requireUser();
  return db
    .select(taskColumns)
    .from(task)
    .leftJoin(project, eq(task.projectId, project.id))
    .leftJoin(contact, eq(task.promisedToContactId, contact.id))
    .where(
      and(
        eq(task.workspaceId, me.workspaceId),
        isNull(task.deletedAt),
        inArray(task.status, ["todo", "in_progress"]),
        or(lte(task.dueAt, endOfToday), eq(task.priority, "urgent")),
      ),
    )
    .orderBy(asc(priorityRank), asc(task.dueAt))
    .limit(3);
}
