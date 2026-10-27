import {
  BookOpenIcon,
  BriefcaseIcon,
  ClapperboardIcon,
  FolderIcon,
  HeartPulseIcon,
  RocketIcon,
  ShoppingBagIcon,
  SparklesIcon,
  TargetIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import {
  PROJECT_COLORS,
  type ProjectColor,
  type ProjectIconName,
} from "@/lib/project-catalog";

const ICONS: Record<ProjectIconName, LucideIcon> = {
  "shopping-bag": ShoppingBagIcon,
  clapperboard: ClapperboardIcon,
  briefcase: BriefcaseIcon,
  rocket: RocketIcon,
  target: TargetIcon,
  sparkles: SparklesIcon,
  "heart-pulse": HeartPulseIcon,
  "book-open": BookOpenIcon,
  folder: FolderIcon,
};

export function projectColor(color: string) {
  return PROJECT_COLORS[color as ProjectColor] ?? PROJECT_COLORS.slate;
}

const SIZES = {
  xs: "size-4 rounded-[5px] [&_svg]:size-2.5",
  sm: "size-5 rounded-md [&_svg]:size-3",
  md: "size-8 rounded-lg [&_svg]:size-4",
  lg: "size-11 rounded-xl [&_svg]:size-5",
} as const;

/** A tinted tile: the project's colour at low opacity, icon at full strength. */
export function ProjectIcon({
  icon,
  color,
  size = "sm",
  className,
}: {
  icon: string;
  color: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const Icon = ICONS[icon as ProjectIconName] ?? FolderIcon;
  const hex = projectColor(color);
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center", SIZES[size], className)}
      style={{
        color: hex,
        backgroundColor: `color-mix(in oklch, ${hex} 16%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${hex} 22%, transparent)`,
      }}
    >
      <Icon strokeWidth={2.2} />
    </span>
  );
}
