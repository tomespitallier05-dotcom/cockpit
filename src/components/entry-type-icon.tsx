import {
  BookHeartIcon,
  FileIcon,
  LinkIcon,
  MessageSquareIcon,
  PhoneIcon,
  StickyNoteIcon,
  type LucideProps,
} from "lucide-react";
import { cn } from "cn";
import { entryTypeMeta } from "@/lib/entry-catalog";

/** The bare icon for an entry type. */
export function EntryGlyph({ type, ...props }: { type: string } & LucideProps) {
  switch (type) {
    case "call":
      return <PhoneIcon {...props} />;
    case "message":
      return <MessageSquareIcon {...props} />;
    case "link":
      return <LinkIcon {...props} />;
    case "file":
      return <FileIcon {...props} />;
    case "journal":
      return <BookHeartIcon {...props} />;
    default:
      return <StickyNoteIcon {...props} />;
  }
}

/** The icon on a tinted tile, in the type's colour. */
export function EntryTypeIcon({ type, className }: { type: string; className?: string }) {
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
      <EntryGlyph type={type} strokeWidth={2.1} />
    </span>
  );
}
