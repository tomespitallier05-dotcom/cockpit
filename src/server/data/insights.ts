import "server-only";
import { and, desc, eq, gte, inArray, isNull, lt, sql, type SQL } from "drizzle-orm";
import type { InsightStatusKey, InsightTypeKey, InsightView } from "@/lib/insight-catalog";
import { similarInsightGroups } from "../ai/semantic";
import { requireUser } from "../dal";
import { db } from "../db";
import { contact, entry, insight, project, task } from "../db/schema";

const DAY = 24 * 60 * 60 * 1000;

async function selectInsights(where: SQL | undefined, limit = 200): Promise<InsightView[]> {
  const rows = await db
    .select({
      id: insight.id,
      type: insight.type,
      status: insight.status,
      content: insight.content,
      quote: insight.quote,
      contactId: insight.contactId,
      contactName: contact.name,
      sourceEntryId: insight.sourceEntryId,
      sourceTitle: entry.title,
      sourceDate: entry.occurredAt,
      projectName: project.name,
      createdAt: insight.createdAt,
      appliedAt: insight.appliedAt,
      meta: insight.meta,
      taskId: sql<string | null>`(select ${task.id} from ${task} where ${task.sourceInsightId} = ${insight.id} and ${task.deletedAt} is null limit 1)`,
    })
    .from(insight)
    .innerJoin(entry, eq(entry.id, insight.sourceEntryId))
    .leftJoin(contact, eq(contact.id, insight.contactId))
    .leftJoin(project, eq(project.id, insight.projectId))
    .where(and(isNull(entry.deletedAt), where))
    .orderBy(desc(entry.occurredAt), desc(insight.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    ...row,
    type: row.type as InsightTypeKey,
    status: row.status as InsightStatusKey,
    meta: (row.meta ?? {}) as InsightView["meta"],
  }));
}

export async function listEntryInsights(entryId: string) {
  const me = await requireUser();
  return selectInsights(and(eq(insight.workspaceId, me.workspaceId), eq(insight.sourceEntryId, entryId)));
}

export async function listInsights(filters: {
  type?: InsightTypeKey;
  status?: InsightStatusKey | "open";
  contactId?: string;
  projectId?: string;
  limit?: number;
} = {}) {
  const me = await requireUser();
  const conditions: (SQL | undefined)[] = [eq(insight.workspaceId, me.workspaceId)];
  if (filters.type) conditions.push(eq(insight.type, filters.type));
  if (filters.status === "open") conditions.push(inArray(insight.status, ["proposed", "accepted"]));
  else if (filters.status) conditions.push(eq(insight.status, filters.status));
  else conditions.push(inArray(insight.status, ["proposed", "accepted", "applied"]));
  if (filters.contactId) conditions.push(eq(insight.contactId, filters.contactId));
  if (filters.projectId) conditions.push(eq(insight.projectId, filters.projectId));
  return selectInsights(and(...conditions), filters.limit ?? 200);
}

/**
 * North Star: of the advice kept (accepted or applied, not dismissed), the share
 * that was actually applied. Proposals awaiting review are counted apart.
 */
export async function adviceStats(days = 90) {
  const me = await requireUser();
  const since = new Date(Date.now() - days * DAY);
  const rows = await db
    .select({ status: insight.status, n: sql<number>`count(*)::int` })
    .from(insight)
    .where(and(eq(insight.workspaceId, me.workspaceId), eq(insight.type, "advice"), gte(insight.createdAt, since)))
    .groupBy(insight.status);
  const count = (status: string) => rows.find((row) => row.status === status)?.n ?? 0;
  const applied = count("applied");
  const kept = applied + count("accepted");
  return {
    applied,
    accepted: count("accepted"),
    proposed: count("proposed"),
    rate: kept ? applied / kept : null,
  };
}

/** Advice kept for a while but still not applied: the reminder list. */
export async function stalledAdvice(olderThanDays = 14) {
  const me = await requireUser();
  return selectInsights(
    and(
      eq(insight.workspaceId, me.workspaceId),
      eq(insight.type, "advice"),
      eq(insight.status, "accepted"),
      lt(insight.updatedAt, new Date(Date.now() - olderThanDays * DAY)),
    ),
    20,
  );
}

/** Mistakes that come back, grouped by meaning (needs embeddings). */
export async function repeatedMistakes() {
  const me = await requireUser();
  const groups = await similarInsightGroups(me.workspaceId, "mistake");
  if (groups.length === 0) return [];
  const all = await selectInsights(and(eq(insight.workspaceId, me.workspaceId), inArray(insight.id, groups.flat())));
  const byId = new Map(all.map((item) => [item.id, item]));
  return groups
    .map((ids) => ids.map((id) => byId.get(id)).filter((item): item is InsightView => Boolean(item)))
    .filter((group) => group.length > 1)
    .sort((a, b) => b.length - a.length);
}

export async function countProposedInsights() {
  const me = await requireUser();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(insight)
    .innerJoin(entry, eq(entry.id, insight.sourceEntryId))
    .where(and(eq(insight.workspaceId, me.workspaceId), eq(insight.status, "proposed"), isNull(entry.deletedAt)));
  return row?.n ?? 0;
}
