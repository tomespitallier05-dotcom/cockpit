import { unreadNotifications } from "@/server/data/notifications";

/** Unread notifications counter; hidden at zero. */
export async function NotificationBadge() {
  const unread = await unreadNotifications();
  if (unread === 0) return null;
  return (
    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary/15 px-1 text-[10.5px] font-semibold text-primary tabular-nums">
      {unread > 99 ? "99+" : unread}
    </span>
  );
}
