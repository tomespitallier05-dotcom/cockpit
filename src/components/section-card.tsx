import type { ReactNode } from "react";
import { cn } from "cn";

/** The standard dashboard card: title row, optional action, body. */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface flex flex-col p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-medium text-foreground">{title}</h2>
          {description ? <p className="mt-0.5 text-[12.5px] text-subtle">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

/** Inline empty message for a card body. */
export function CardEmpty({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-2 rounded-lg border border-dashed border-white/[0.07] bg-white/[0.012] px-4 py-5 text-[13px] leading-relaxed text-muted-foreground [&_svg]:size-4 [&_svg]:text-subtle">
      {icon}
      {children}
    </div>
  );
}
