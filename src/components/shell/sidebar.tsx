"use client";

import { PlusIcon, SearchIcon, ZapIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NavLink } from "./nav-link";
import { PRIMARY_NAV, PROJECTS_NAV, SETTINGS_NAV } from "./nav-config";
import { useShell } from "./shell-provider";

export function Sidebar({ projects, userMenu }: { projects: ReactNode; userMenu: ReactNode }) {
  const { setPaletteOpen, capture } = useShell();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-14 shrink-0 items-center px-4">
        <Link href="/" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          <Logo />
        </Link>
      </div>

      <div className="flex flex-col gap-1.5 px-3">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-8 items-center gap-2 rounded-lg border border-border bg-white/[0.02] px-2.5 text-[13px] text-subtle shadow-[inset_0_1px_0_rgb(255_255_255/0.03)] transition-colors hover:border-white/12 hover:text-muted-foreground"
        >
          <SearchIcon className="size-3.5" />
          <span className="flex-1 text-left">Rechercher…</span>
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </button>
        <button
          type="button"
          onClick={capture}
          className="flex h-8 items-center gap-2 rounded-lg bg-primary/12 px-2.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary/18"
        >
          <ZapIcon className="size-3.5" />
          <span className="flex-1 text-left">Capturer</span>
          <Kbd className="bg-primary/15 text-primary/80">C</Kbd>
        </button>
      </div>

      <nav aria-label="Navigation principale" className="mt-4 flex flex-col gap-0.5 px-3">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} href={item.href} icon={<item.icon />}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 flex min-h-0 flex-1 flex-col px-3">
        <div className="flex h-7 items-center justify-between px-2.5">
          <Link
            href={PROJECTS_NAV.href}
            className="text-[11px] font-medium tracking-[0.06em] text-subtle uppercase transition-colors hover:text-muted-foreground"
          >
            Projets
          </Link>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Nouveau projet"
                onClick={() =>
                  toast("La création de projet arrive en phase 1", {
                    description: "Nom, icône, couleur et template, en un instant.",
                  })
                }
                className="flex size-5 items-center justify-center rounded-md text-subtle transition-colors hover:bg-white/5 hover:text-foreground"
              >
                <PlusIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Nouveau projet — phase 1</TooltipContent>
          </Tooltip>
        </div>
        <div className="-mr-1 mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-1">{projects}</div>
      </div>

      <div className="flex flex-col gap-0.5 border-t border-sidebar-border px-3 pt-2 pb-3">
        <NavLink href={SETTINGS_NAV.href} icon={<SETTINGS_NAV.icon />}>
          {SETTINGS_NAV.label}
        </NavLink>
        {userMenu}
      </div>
    </aside>
  );
}
