import { InboxIcon, PinIcon } from "lucide-react";
import Link from "next/link";
import { EntryTypeIcon } from "@/components/entry-type-icon";
import { ProjectIcon } from "@/components/project-icon";
import { groupByDay, timeLabel } from "@/lib/dates";
import { entryTypeMeta } from "@/lib/entry-catalog";

export type TimelineEntry = {
  id: string;
  type: string;
  title: string | null;
  plainText: string;
  occurredAt: Date;
  inboxStatus: "inbox" | "processed";
  pinned: boolean;
  projectName: string | null;
  projectColor: string | null;
  projectIcon: string | null;
};

export function entryHeadline(item: { title: string | null; plainText: string; type: string }) {
  if (item.title) return item.title;
  const firstLine = item.plainText.split("\n").find((line) => line.trim());
  return firstLine?.trim().slice(0, 120) || `${entryTypeMeta(item.type).label} sans titre`;
}

function preview(item: TimelineEntry) {
  const text = item.plainText.replace(/\s+/g, " ").trim();
  if (!item.title) {
    const firstLine = item.plainText.split("\n").find((line) => line.trim())?.trim() ?? "";
    return text.slice(firstLine.length).trim().slice(0, 180);
  }
  return text.slice(0, 180);
}

/** Entries grouped by the day they happened. Pinned entries stay on top. */
export function EntryTimeline({
  entries,
  timeZone,
  showProject = true,
}: {
  entries: TimelineEntry[];
  timeZone: string;
  showProject?: boolean;
}) {
  const pinned = entries.filter((item) => item.pinned);
  const groups = groupByDay(
    entries.filter((item) => !item.pinned),
    (item) => item.occurredAt,
    timeZone,
  );

  return (
    <div className="flex flex-col gap-6">
      {pinned.length ? <Group label="Épinglées" items={pinned} timeZone={timeZone} showProject={showProject} /> : null}
      {groups.map((group) => (
        <Group key={group.key} label={group.label} items={group.items} timeZone={timeZone} showProject={showProject} />
      ))}
    </div>
  );
}

function Group({
  label,
  items,
  timeZone,
  showProject,
}: {
  label: string;
  items: TimelineEntry[];
  timeZone: string;
  showProject: boolean;
}) {
  return (
    <section>
      <h3 className="mb-2 px-1 text-[12px] font-medium text-subtle">{label}</h3>
      <ul className="surface divide-y divide-border overflow-hidden">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/entrees/${item.id}`}
              className="group/entry flex gap-3 px-4 py-3 outline-none transition-colors hover:bg-white/[0.025] focus-visible:bg-white/[0.04]"
            >
              <EntryTypeIcon type={item.type} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[13.5px] font-medium text-foreground">{entryHeadline(item)}</p>
                  {item.pinned ? <PinIcon className="size-3 shrink-0 text-subtle" /> : null}
                  {item.inboxStatus === "inbox" ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/12 px-1.5 py-0.5 text-[10.5px] font-medium text-primary">
                      <InboxIcon className="size-2.5" /> À trier
                    </span>
                  ) : null}
                </div>
                {preview(item) ? (
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">{preview(item)}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5 text-[11.5px] text-subtle">
                <span className="tabular-nums">{timeLabel(item.occurredAt, timeZone)}</span>
                {showProject && item.projectName ? (
                  <span className="hidden items-center gap-1.5 sm:inline-flex">
                    <ProjectIcon icon={item.projectIcon ?? "folder"} color={item.projectColor ?? "slate"} size="xs" />
                    <span className="max-w-28 truncate">{item.projectName}</span>
                  </span>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
