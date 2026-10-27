import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";
import { PhaseBadge } from "@/components/phase-badge";

/**
 * Empty states explain what will live here and when, instead of a blank page.
 * `phase` refers to the product roadmap in docs/PRODUCT.md.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  phase,
  features,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase?: 1 | 2 | 3 | 4;
  features?: string[];
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface relative flex flex-col items-center overflow-hidden px-6 py-14 text-center",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <span className="relative flex size-12 items-center justify-center rounded-2xl border border-border bg-surface-raised text-muted-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]">
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <div className="relative mt-5 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-medium text-foreground">{title}</h2>
          {phase ? <PhaseBadge phase={phase} /> : null}
        </div>
        <p className="max-w-md text-[13.5px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {features?.length ? (
        <ul className="relative mt-6 grid w-full max-w-lg gap-2 text-left sm:grid-cols-2">
          {features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2 rounded-lg border border-hairline bg-white/[0.015] px-3 py-2 text-[13px] text-muted-foreground"
            >
              <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-primary/70" />
              {feature}
            </li>
          ))}
        </ul>
      ) : null}
      {action ? <div className="relative mt-6">{action}</div> : null}
    </div>
  );
}
