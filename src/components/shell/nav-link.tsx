"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { cn } from "cn";
import { springSnappy } from "@/lib/motion";
import { isActivePath } from "./nav-config";

type NavLinkProps = {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
};

/**
 * Sidebar link. The active highlight is a shared layout element, so it glides
 * between items instead of blinking.
 *
 * The pathname is URL data: on dynamic routes it isn't known while the static
 * shell prerenders, so the inactive link is the fallback and the active state
 * streams in right after.
 */
export function NavLink(props: NavLinkProps) {
  return (
    <Suspense fallback={<NavLinkView {...props} active={false} />}>
      <NavLinkWithPathname {...props} />
    </Suspense>
  );
}

function NavLinkWithPathname(props: NavLinkProps) {
  const pathname = usePathname();
  return <NavLinkView {...props} active={isActivePath(pathname, props.href)} />;
}

function NavLinkView({ href, icon, children, trailing, active }: NavLinkProps & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/nav relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring/50",
        active ? "text-foreground" : "text-sidebar-foreground/75 hover:text-foreground",
      )}
    >
      {active ? (
        <motion.span
          layoutId="sidebar-active"
          transition={springSnappy}
          className="absolute inset-0 rounded-lg bg-white/[0.06] shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]"
        />
      ) : (
        <span className="absolute inset-0 rounded-lg opacity-0 transition-opacity group-hover/nav:bg-white/[0.035] group-hover/nav:opacity-100" />
      )}
      <span
        className={cn(
          "relative flex size-4 shrink-0 items-center justify-center [&_svg]:size-4",
          active ? "text-foreground" : "text-subtle group-hover/nav:text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="relative min-w-0 flex-1 truncate">{children}</span>
      {trailing ? <span className="relative">{trailing}</span> : null}
    </Link>
  );
}
