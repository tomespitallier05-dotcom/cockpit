import {
  BellIcon,
  BotIcon,
  CalendarRangeIcon,
  ChartNoAxesColumnIcon,
  FolderIcon,
  GoalIcon,
  InboxIcon,
  LightbulbIcon,
  ListTodoIcon,
  Settings2Icon,
  SunIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Second key of the "G then …" navigation shortcut. */
  shortcut?: string;
};

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Aujourd'hui", icon: SunIcon, shortcut: "a" },
  { href: "/inbox", label: "Inbox", icon: InboxIcon, shortcut: "i" },
  { href: "/taches", label: "Tâches", icon: ListTodoIcon, shortcut: "t" },
  { href: "/insights", label: "Connaissances", icon: LightbulbIcon, shortcut: "k" },
  { href: "/objectifs", label: "Objectifs & KPI", icon: GoalIcon, shortcut: "o" },
  { href: "/contacts", label: "Contacts", icon: UsersIcon, shortcut: "c" },
  { href: "/assistant", label: "Assistant", icon: BotIcon },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesColumnIcon },
  { href: "/bilans", label: "Bilans", icon: CalendarRangeIcon, shortcut: "b" },
];

export const PROJECTS_NAV: NavItem = {
  href: "/projets",
  label: "Projets",
  icon: FolderIcon,
  shortcut: "p",
};

export const SETTINGS_NAV: NavItem = {
  href: "/reglages",
  label: "Réglages",
  icon: Settings2Icon,
  shortcut: "r",
};

export const NOTIFICATIONS_NAV: NavItem = {
  href: "/notifications",
  label: "Notifications",
  icon: BellIcon,
  shortcut: "n",
};

export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, PROJECTS_NAV, NOTIFICATIONS_NAV, SETTINGS_NAV];

export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
