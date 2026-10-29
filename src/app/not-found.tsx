import { CompassIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page introuvable" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="surface w-full max-w-md p-6 text-center shadow-[var(--shadow-pop)] sm:p-7">
        <span className="mx-auto flex size-11 items-center justify-center rounded-2xl border border-border bg-surface-raised text-muted-foreground">
          <CompassIcon className="size-5" strokeWidth={1.8} />
        </span>
        <h1 className="mt-4 text-[17px] font-semibold tracking-[-0.015em] text-foreground">Page introuvable</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
          Cette page n’existe pas ou a été déplacée. Si tu cherchais une note ou une tâche, utilise la recherche (⌘K) depuis l’accueil.
        </p>
        <div className="mt-5 flex justify-center">
          <Button asChild>
            <Link href="/">Retour à l’accueil</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
