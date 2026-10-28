import "server-only";
import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db } from "./db";
import { notification, pushSubscription } from "./db/schema";

/**
 * In-app notifications, mirrored as Web Push when VAPID keys are configured
 * (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT).
 */
export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function setup() {
  if (configured || !pushConfigured()) return pushConfigured();
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:owner@cockpit.local",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
  return true;
}

type Kind = (typeof notification.$inferInsert)["kind"];

export async function notify(workspaceId: string, input: { kind: Kind; title: string; body?: string; href?: string }) {
  await db.insert(notification).values({ workspaceId, kind: input.kind, title: input.title, body: input.body ?? null, href: input.href ?? null });
  if (!setup()) return;
  const subscriptions = await db.select().from(pushSubscription).where(eq(pushSubscription.workspaceId, workspaceId));
  const gone: string[] = [];
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: input.title, body: input.body ?? "", href: input.href ?? "/" }),
          { TTL: 60 * 60 * 12 },
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(sub.id);
        else console.error("web push", status, error);
      }
    }),
  );
  if (gone.length) await db.delete(pushSubscription).where(inArray(pushSubscription.id, gone));
}
