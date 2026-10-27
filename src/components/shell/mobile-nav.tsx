"use client";

import { FolderIcon, InboxIcon, PlusIcon, SearchIcon, SunIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { cn } from "cn";
import { Logo } from "@/components/logo";
import { isActivePath } from "./nav-config";
import { useShell } from "./shell-provider";

/**
 * Mobile is for capturing and checking; heavy editing stays on desktop.
 * Like NavLink, the active state waits for the pathname behind Suspense.
 */
export function MobileNav() {
  return (
    <Suspense fallback={<MobileNavView pathname={null} />}>
      <MobileNavWithPathname />
    </Suspense>
  );
}

function MobileNavWithPathname() {
  return <MobileNavView pathname={usePathname()} />;
}

function MobileNavView({ pathname }: { pathname: string | null }) {
  const { setPaletteOpen, capture } = useShell();

  const itemClass = (href: string | null) =>
    cn(
      "flex flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition-colors",
      href && pathname && isActivePath(pathname, href)
        ? "text-foreground"
        : "text-subtle active:text-muted-foreground",
    );

  return (
    <nav
      aria-label="Navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5">
        <Link href="/" className={itemClass("/")}>
          <SunIcon className="size-5" strokeWidth={1.8} />
          Aujourd&apos;hui
        </Link>
        <Link href="/inbox" className={itemClass("/inbox")}>
          <InboxIcon className="size-5" strokeWidth={1.8} />
          Inbox
        </Link>
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={capture}
            aria-label="Capturer"
            className="flex size-12 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#6d98ff,#4a6fe0)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_8px_24px_-6px_rgb(91_140_255/0.7)] transition-transform active:scale-95"
          >
            <PlusIcon className="size-5" strokeWidth={2.4} />
          </button>
        </div>
        <button type="button" onClick={() => setPaletteOpen(true)} className={itemClass(null)}>
          <SearchIcon className="size-5" strokeWidth={1.8} />
          Rechercher
        </button>
        <Link href="/projets" className={itemClass("/projets")}>
          <FolderIcon className="size-5" strokeWidth={1.8} />
          Projets
        </Link>
      </div>
    </nav>
  );
}

export function MobileTopBar({ userMenu }: { userMenu: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-13 items-center justify-between border-b border-border/70 bg-background/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden">
      <Link href="/" aria-label="Aujourd'hui">
        <Logo />
      </Link>
      {userMenu}
    </header>
  );
}
