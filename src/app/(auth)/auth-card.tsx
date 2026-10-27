import type { ReactNode } from "react";

export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="surface p-6 shadow-[var(--shadow-pop)] sm:p-7">
      <h1 className="text-[19px] font-semibold tracking-[-0.015em] text-foreground">{title}</h1>
      <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function AuthCardSkeleton() {
  return <div className="surface shimmer h-[380px] w-full" />;
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-[11.5px] text-subtle">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  return (
    <p aria-live="polite" className="min-h-5 text-[12.5px] text-destructive">
      {message}
    </p>
  );
}

/** Only same-origin paths are accepted as a post-login destination. */
export function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}
