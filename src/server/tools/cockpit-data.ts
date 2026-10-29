import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { attachment, contact, contentItem, entry, entryContact, insight, inventoryItem, metric, metricValue, project, task } from "../db/schema";

/*
 * Workspace-scoped reads shared by the in-app assistant and the Claude connector
 * (MCP). Every function takes the workspace id explicitly: callers resolve it
 * from the session or from the connector's access token, never from input.
 */

export const DAY = 86_400_000;

export async function findProject(workspaceId: string, nameOrId?: string | null) {
  if (!nameOrId) return null;
  const rows = await db
    .select({ id: project.id, name: project.name, slug: project.slug })
    .from(project)
    .where(and(eq(project.workspaceId, workspaceId), isNull(project.deletedAt)));
  const target = nameOrId.toLowerCase().trim();
  return (
    rows.find((p) => p.id === nameOrId) ??
    rows.find((p) => p.name.toLowerCase() === target || p.slug === target) ??
    rows.find((p) => p.name.toLowerCase().includes(target)) ??
    null
  );
}

export async function findContact(workspaceId: string, nameOrId?: string | null) {
  if (!nameOrId) return null;
  const rows = await db
    .select({ id: contact.id, name: contact.name, email: contact.email })
    .from(contact)
    .where(and(eq(contact.workspaceId, workspaceId), isNull(contact.deletedAt)));
  const target = nameOrId.toLowerCase().trim();
  return (
    rows.find((c) => c.id === nameOrId) ??
    rows.find((c) => c.name.toLowerCase() === target || c.email?.toLowerCase() === target) ??
    rows.find((c) => c.name.toLowerCase().split(" ")[0] === target.split(" ")[0]) ??
    null
  );
}

export async function listProjectsData(workspaceId: string) {
  return db
    .select({ id: project.id, name: project.name, template: project.template, status: project.status, description: project.description })
    .from(project)
    .where(and(eq(project.workspaceId, workspaceId), isNull(project.deletedAt)))
    .orderBy(asc(project.position), asc(project.createdAt));
}

export async function listContactsData(workspaceId: string, search?: string | null) {
  const rows = await db
    .select({
      id: contact.id,
      name: contact.name,
      relationship: contact.relationship,
      role: contact.role,
      company: contact.company,
      email: contact.email,
      lastInteractionAt: contact.lastInteractionAt,
      nextInteractionAt: contact.nextInteractionAt,
    })
    .from(contact)
    .where(and(eq(contact.workspaceId, workspaceId), isNull(contact.deletedAt)))
    .orderBy(asc(contact.name));
  if (!search) return rows;
  const q = search.toLowerCase();
  return rows.filter((c) => `${c.name} ${c.role ?? ""} ${c.company ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q));
}

export type TaskFilter = "en_retard" | "aujourdhui" | "ouvertes" | "terminees_7_jours";

export async function listTasksData(workspaceId: string, filter: TaskFilter, projectId?: string | null, endOfToday = new Date()) {
  const now = new Date();
  const where = [eq(task.workspaceId, workspaceId), isNull(task.deletedAt)];
  if (projectId) where.push(eq(task.projectId, projectId));
  if (filter === "terminees_7_jours") {
    where.push(eq(task.status, "done"), gte(task.completedAt, new Date(now.getTime() - 7 * DAY)));
  } else {
    where.push(inArray(task.status, ["todo", "in_progress"]));
    if (filter === "en_retard") where.push(lt(task.dueAt, now));
    if (filter === "aujourdhui") where.push(lt(task.dueAt, endOfToday));
  }
  return db
    .select({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueAt: task.dueAt,
      completedAt: task.completedAt,
      projectName: project.name,
      promisedTo: contact.name,
    })
    .from(task)
    .leftJoin(project, eq(project.id, task.projectId))
    .leftJoin(contact, eq(contact.id, task.promisedToContactId))
    .where(and(...where))
    .orderBy(asc(sql`${task.dueAt} is null`), asc(task.dueAt))
    .limit(60);
}

export type InsightKind = "advice" | "decision" | "action" | "mistake" | "lesson" | "idea" | "key_fact";

export async function listInsightsData(
  workspaceId: string,
  filters: { type?: InsightKind | null; status?: "proposed" | "accepted" | "applied" | "dismissed" | null; contactName?: string | null; days?: number | null },
) {
  const where = [
    eq(insight.workspaceId, workspaceId),
    isNull(entry.deletedAt),
    eq(entry.isPrivate, false),
    filters.status ? eq(insight.status, filters.status) : inArray(insight.status, ["proposed", "accepted", "applied"]),
  ];
  if (filters.type) where.push(eq(insight.type, filters.type));
  if (filters.days) where.push(gte(entry.occurredAt, new Date(Date.now() - filters.days * DAY)));
  if (filters.contactName) where.push(sql`lower(${contact.name}) like ${`%${filters.contactName.toLowerCase()}%`}`);
  return db
    .select({
      id: insight.id,
      type: insight.type,
      status: insight.status,
      content: insight.content,
      quote: insight.quote,
      appliedAt: insight.appliedAt,
      who: contact.name,
      entryId: entry.id,
      entryTitle: entry.title,
      occurredAt: entry.occurredAt,
      projectName: project.name,
    })
    .from(insight)
    .innerJoin(entry, eq(entry.id, insight.sourceEntryId))
    .leftJoin(contact, eq(contact.id, insight.contactId))
    .leftJoin(project, eq(project.id, insight.projectId))
    .where(and(...where))
    .orderBy(desc(entry.occurredAt))
    .limit(80);
}

export async function metricsData(workspaceId: string, projectId?: string | null) {
  const metrics = await db
    .select({ id: metric.id, name: metric.name, unit: metric.unit, direction: metric.direction, aggregation: metric.aggregation, projectName: project.name })
    .from(metric)
    .leftJoin(project, eq(project.id, metric.projectId))
    .where(and(eq(metric.workspaceId, workspaceId), isNull(metric.archivedAt), projectId ? eq(metric.projectId, projectId) : undefined));
  if (metrics.length === 0) return [];
  const values = await db
    .select({ metricId: metricValue.metricId, date: metricValue.date, value: metricValue.value })
    .from(metricValue)
    .where(inArray(metricValue.metricId, metrics.map((m) => m.id)))
    .orderBy(desc(metricValue.date))
    .limit(600);
  return metrics.map((m) => ({
    ...m,
    values: values
      .filter((v) => v.metricId === m.id)
      .slice(0, 24)
      .reverse()
      .map((v) => ({ date: v.date, value: Number(v.value) })),
  }));
}

export async function inventoryData(workspaceId: string, projectId?: string | null) {
  return db
    .select()
    .from(inventoryItem)
    .where(and(eq(inventoryItem.workspaceId, workspaceId), isNull(inventoryItem.deletedAt), projectId ? eq(inventoryItem.projectId, projectId) : undefined))
    .orderBy(desc(inventoryItem.createdAt))
    .limit(300);
}

export async function contentData(workspaceId: string, projectId?: string | null) {
  return db
    .select()
    .from(contentItem)
    .where(and(eq(contentItem.workspaceId, workspaceId), isNull(contentItem.deletedAt), projectId ? eq(contentItem.projectId, projectId) : undefined))
    .orderBy(desc(contentItem.updatedAt))
    .limit(200);
}

/** One entry with everything needed to understand it. Private entries are refused. */
export async function entryDetailData(workspaceId: string, entryId: string) {
  const [row] = await db
    .select({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      plainText: entry.plainText,
      occurredAt: entry.occurredAt,
      source: entry.source,
      meta: entry.meta,
      isPrivate: entry.isPrivate,
      inboxStatus: entry.inboxStatus,
      projectId: entry.projectId,
      projectName: project.name,
    })
    .from(entry)
    .leftJoin(project, eq(project.id, entry.projectId))
    .where(and(eq(entry.id, entryId), eq(entry.workspaceId, workspaceId), isNull(entry.deletedAt)));
  if (!row) return null;
  if (row.isPrivate) return { private: true as const, id: row.id };
  const [people, files, insights] = await Promise.all([
    db
      .select({ id: contact.id, name: contact.name, role: entryContact.role })
      .from(entryContact)
      .innerJoin(contact, eq(contact.id, entryContact.contactId))
      .where(eq(entryContact.entryId, entryId)),
    db
      .select({ fileName: attachment.fileName, kind: attachment.kind, extractedText: attachment.extractedText, processingStatus: attachment.processingStatus })
      .from(attachment)
      .where(eq(attachment.entryId, entryId)),
    db
      .select({ id: insight.id, type: insight.type, status: insight.status, content: insight.content })
      .from(insight)
      .where(eq(insight.sourceEntryId, entryId)),
  ]);
  const { meta, isPrivate: _private, ...rest } = row;
  void _private;
  const { ai, ...details } = (meta ?? {}) as Record<string, unknown>;
  return { ...rest, details, analysis: ai ?? null, contacts: people, files, insights };
}
