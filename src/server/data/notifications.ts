import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { requireUser } from "../dal";
import { db } from "../db";
import { notification, pushSubscription } from "../db/schema";

export async function listNotifications(limit = 50) {
  const me = await requireUser();
  return db
    .select()
    .from(notification)
    .where(eq(notification.workspaceId, me.workspaceId))
    .orderBy(desc(notification.createdAt))
    .limit(limit);
}

export async function unreadNotifications() {
  const me = await requireUser();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notification)
    .where(and(eq(notification.workspaceId, me.workspaceId), isNull(notification.readAt)));
  return row?.n ?? 0;
}

export async function countPushSubscriptions() {
  const me = await requireUser();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(pushSubscription)
    .where(eq(pushSubscription.workspaceId, me.workspaceId));
  return row?.n ?? 0;
}
