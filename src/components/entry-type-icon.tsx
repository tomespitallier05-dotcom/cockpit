import {
  BookHeartIcon,
  FileIcon,
  LinkIcon,
  MessageSquareIcon,
  PhoneIcon,
  StickyNoteIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { entryTypeMeta, type CaptureType } from "@/lib/entry-catalog";

const ICONS: Record<CaptureType, LucideIcon> = {
  note: StickyNoteIcon,
  call: PhoneIcon,
  message: MessageSquareIcon,
  link: LinkIcon,
  file: FileIcon,
  journal: BookHeartIcon,
};

export function entryTypeIcon(type: string): LucideIcon {
  return ICONS[type as CaptureType] ?? StickyNoteIcon;
}

export function EntryTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = entryTypeIcon(type);
  const { color } = entryTypeMeta(type);
  return (
    <span
      aria-hidden
      className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-lg [&_svg]:size-3.5", className)}
      style={{
        color,
        backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${color} 20%, transparent)`,
      }}
    >
      <Icon strokeWidth={2.1} />
    </span>
  );
}
