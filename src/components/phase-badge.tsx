import { cn } from "cn";

export function PhaseBadge({ phase, className }: { phase: 1 | 2 | 3 | 4; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full border whitespace-nowrap border-primary/25 bg-primary/10 px-2 text-[11px] font-medium text-primary/90",
        className,
      )}
      title="Étape de la roadmap où cette fonctionnalité arrive"
    >
      Phase {phase}
    </span>
  );
}
