import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

export function PageHeader({
  title,
  description,
  icon,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-3.5">
        {icon}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Neutral icon tile shown beside a page title. */
export function PageIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-muted-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]">
      <Icon className="size-[18px]" strokeWidth={1.8} />
    </span>
  );
}

/** Standard page frame: generous top space, readable max width. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-8 md:pt-10 md:pb-16", className)}>
      {children}
    </div>
  );
}
