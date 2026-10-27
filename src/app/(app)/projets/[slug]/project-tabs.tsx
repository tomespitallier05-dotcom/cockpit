"use client";

import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { springSnappy } from "@/lib/motion";

export type ProjectTab = { key: string; label: string; content: ReactNode };

/** Segmented tabs with a gliding underline. Tabs become real routes in phase 1. */
export function ProjectTabs({ tabs }: { tabs: ProjectTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const current = tabs.find((tab) => tab.key === active) ?? tabs[0];

  return (
    <div className="mt-8">
      <div
        role="tablist"
        aria-label="Sections du projet"
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0"
      >
        {tabs.map((tab) => {
          const selected = tab.key === current?.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab.key)}
              className={cn(
                "relative shrink-0 px-3 pt-1 pb-3 text-[13px] font-medium whitespace-nowrap outline-none transition-colors focus-visible:text-foreground",
                selected ? "text-foreground" : "text-subtle hover:text-muted-foreground",
              )}
            >
              {tab.label}
              {selected ? (
                <motion.span
                  layoutId="project-tab-underline"
                  transition={springSnappy}
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-foreground"
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <motion.div
        key={current?.key}
        role="tabpanel"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6"
      >
        {current?.content}
      </motion.div>
    </div>
  );
}
