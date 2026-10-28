"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "../dal";
import { db } from "../db";
import { notification, pushSubscription } from "../db/schema";
import { notify } from "../notify";
import { getActionUser } from "../session";

export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(eq(notification.workspaceId, me.workspaceId), isNull(notification.readAt)));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

const subscriptionInput = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  userAgent: z.string().max(300).optional(),
});

export async function savePushSubscription(input: z.input<typeof subscriptionInput>): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    const data = subscriptionInput.parse(input);
    await db
      .insert(pushSubscription)
      .values({ workspaceId: me.workspaceId, endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth, userAgent: data.userAgent ?? null })
      .onConflictDoUpdate({
        target: pushSubscription.endpoint,
        set: { workspaceId: me.workspaceId, p256dh: data.keys.p256dh, auth: data.keys.auth },
      });
    await notify(me.workspaceId, { kind: "system", title: "Notifications activées", body: "Tu recevras ton brief chaque matin.", href: "/notifications" });
    refresh();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    await db
      .delete(pushSubscription)
      .where(and(eq(pushSubscription.workspaceId, me.workspaceId), eq(pushSubscription.endpoint, z.string().max(1000).parse(endpoint))));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
