import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { connection } from "next/server";
import type { Period } from "@/lib/periods";
import type { ReviewNarrative } from "../ai/reviews";
import { requireUser } from "../dal";
import { db } from "../db";
import { review, shareLink, user, workspace } from "../db/schema";

export type ReviewContent = {
  answers?: Record<string, string>;
  narrative?: ReviewNarrative;
  stats?: { tasksDone: number; adviceApplied: number; soldCount: number; profitCents: number; published: number; views: number };
  tasksDone?: { title: string; projectName: string | null }[];
};

export type KpiSnapshot = {
  name: string;
  unit: string | null;
  projectName: string | null;
  direction: "up" | "down";
  aggregation: string;
  start: number | null;
  end: number | null;
};

export async function listReviews(limit = 60) {
  const me = await requireUser();
  return db
    .select({
      id: review.id,
      period: review.period,
      periodStart: review.periodStart,
      periodEnd: review.periodEnd,
      summary: review.summary,
      generatedBy: review.generatedBy,
      updatedAt: review.updatedAt,
    })
    .from(review)
    .where(and(eq(review.workspaceId, me.workspaceId), isNull(review.projectId)))
    .orderBy(desc(review.periodStart), desc(review.period))
    .limit(limit);
}

export async function getReview(id: string) {
  const me = await requireUser();
  const [row] = await db.select().from(review).where(and(eq(review.id, id), eq(review.workspaceId, me.workspaceId)));
  if (!row) return null;
  const links = await db
    .select({ id: shareLink.id, expiresAt: shareLink.expiresAt, revokedAt: shareLink.revokedAt, lastViewedAt: shareLink.lastViewedAt, createdAt: shareLink.createdAt })
    .from(shareLink)
    .where(and(eq(shareLink.workspaceId, me.workspaceId), eq(shareLink.kind, "review"), eq(shareLink.targetId, id)))
    .orderBy(desc(shareLink.createdAt));
  return {
    ...row,
    period: row.period as Period,
    content: (row.content ?? {}) as ReviewContent,
    snapshot: (row.metricsSnapshot ?? []) as KpiSnapshot[],
    links,
  };
}

/** Public read of a shared review: valid token only, never anything else. */
export async function getSharedReview(token: string) {
  await connection();
  if (!/^[\w-]{20,64}$/.test(token)) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const [link] = await db
    .select()
    .from(shareLink)
    .where(and(eq(shareLink.tokenHash, hash), isNull(shareLink.revokedAt), gt(shareLink.expiresAt, new Date())));
  if (!link || link.kind !== "review") return null;
  const [row] = await db
    .select({
      period: review.period,
      periodStart: review.periodStart,
      periodEnd: review.periodEnd,
      summary: review.summary,
      content: review.content,
      metricsSnapshot: review.metricsSnapshot,
      ownerName: user.name,
    })
    .from(review)
    .innerJoin(workspace, eq(workspace.id, review.workspaceId))
    .innerJoin(user, eq(user.id, workspace.ownerId))
    .where(and(eq(review.id, link.targetId), eq(review.workspaceId, link.workspaceId)));
  if (!row) return null;
  await db.update(shareLink).set({ lastViewedAt: new Date() }).where(eq(shareLink.id, link.id));
  return {
    ...row,
    period: row.period as Period,
    content: (row.content ?? {}) as ReviewContent,
    snapshot: (row.metricsSnapshot ?? []) as KpiSnapshot[],
    expiresAt: link.expiresAt,
  };
}
