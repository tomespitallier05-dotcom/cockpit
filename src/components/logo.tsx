import { cn } from "cn";

/** Cockpit mark: a horizon line inside a rounded instrument. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-7 items-center justify-center overflow-hidden rounded-[9px]",
        "bg-[linear-gradient(145deg,#6d98ff_0%,#4a6fe0_55%,#3b4fb8_100%)]",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_4px_14px_-4px_rgb(91_140_255/0.6)]",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.6" />
        <path d="M5 13.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 6.5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight text-foreground">Cockpit</span>
    </span>
  );
}
