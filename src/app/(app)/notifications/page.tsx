import { BellIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageContainer, PageHeader, PageIcon } from "@/components/page-header";
import { CardEmpty } from "@/components/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelative } from "@/lib/format";
import { requireUser } from "@/server/dal";
import { countPushSubscriptions, listNotifications } from "@/server/data/notifications";
import { pushConfigured } from "@/server/notify";
import { MarkRead, PushToggle } from "./notifications-client";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Le brief du matin, les rappels et les bilans prêts. Sur ce téléphone aussi, si tu actives les notifications."
        icon={<PageIcon icon={BellIcon} />}
      />
      <Suspense fallback={<Skeleton className="mt-8 h-64 w-full rounded-2xl" />}>
        <NotificationsLoader />
      </Suspense>
    </PageContainer>
  );
}

async function NotificationsLoader() {
  await requireUser();
  const [items, subscriptions] = await Promise.all([listNotifications(), countPushSubscriptions()]);
  const unread = items.some((item) => !item.readAt);
  const now = new Date();
  return (
    <div className="mt-8 flex flex-col gap-6">
      <PushToggle configured={pushConfigured()} publicKey={process.env.VAPID_PUBLIC_KEY ?? null} subscriptions={subscriptions} />
      {unread ? <MarkRead /> : null}
      {items.length ? (
        <ul className="surface divide-y divide-border overflow-hidden">
          {items.map((item) => {
            const body = (
              <>
                <span className="flex items-center gap-2">
                  {!item.readAt ? <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Non lue" /> : null}
                  <span className="text-[13.5px] text-foreground">{item.title}</span>
                </span>
                {item.body ? <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{item.body}</span> : null}
                <span className="mt-0.5 block text-[11.5px] text-subtle">{formatRelative(item.createdAt, now)}</span>
              </>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link href={item.href} className="block px-5 py-3.5 transition-colors hover:bg-white/[0.025]">
                    {body}
                  </Link>
                ) : (
                  <div className="px-5 py-3.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <CardEmpty>Aucune notification. Le premier brief arrive demain matin.</CardEmpty>
      )}
    </div>
  );
}
