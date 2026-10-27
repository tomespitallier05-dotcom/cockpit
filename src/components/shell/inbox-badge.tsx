import { getTodayStats } from "@/server/queries";

/** Unread-style counter on the Inbox link; hidden at zero. */
export async function InboxBadge() {
  const { inbox } = await getTodayStats();
  if (inbox === 0) return null;
  return (
    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary/15 px-1 text-[10.5px] font-semibold text-primary tabular-nums">
      {inbox > 99 ? "99+" : inbox}
    </span>
  );
}
