"use client";

import * as Sentry from "@sentry/nextjs";
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Fallback shown by the error boundaries (error.tsx). The message is deliberately
 * generic: the technical detail goes to Sentry and the server logs, never to the
 * screen. `error.digest` is the reference that links the two.
 */
export function ErrorPanel({ error, retry, fullPage = false }: { error: unknown; retry: () => void; fullPage?: boolean }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const reference = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";

  return (
    <div className={fullPage ? "flex min-h-dvh items-center justify-center px-4" : "flex min-h-[60dvh] items-center justify-center px-4 py-16"}>
      <div role="alert" className="surface w-full max-w-md p-6 text-center shadow-[var(--shadow-pop)] sm:p-7">
        <span className="mx-auto flex size-11 items-center justify-center rounded-2xl border border-border bg-surface-raised text-muted-foreground">
          <TriangleAlertIcon className="size-5" strokeWidth={1.8} />
        </span>
        <h1 className="mt-4 text-[17px] font-semibold tracking-[-0.015em] text-foreground">Quelque chose s’est mal passé</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
          Cette page n’a pas pu s’afficher. Tes données ne sont pas touchées. Réessaie dans un instant, et si le problème revient, reviens à l’accueil.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button onClick={() => retry()}>
            <RefreshCwIcon data-icon="inline-start" />
            Réessayer
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Retour à l’accueil</Link>
          </Button>
        </div>
        {reference ? <p className="mt-4 text-[11.5px] text-subtle">Référence : {reference}</p> : null}
      </div>
    </div>
  );
}
