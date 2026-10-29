"use client";

import { CheckIcon, Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { AuthCard, FormError } from "../auth-card";

const SCOPE_LABELS: Record<string, string> = {
  cockpit: "Lire et modifier tes données Cockpit : journal, tâches, connaissances, KPI, inventaire, contenus, bilans",
  openid: "Confirmer ton identité",
  profile: "Voir ton nom",
  email: "Voir ton adresse email",
  offline_access: "Rester connecté sans te redemander l'accès",
};

export function ConsentForm({ clientName, clientUri, scopes }: { clientName: string; clientUri: string | null; scopes: string[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (accept: boolean) =>
    startTransition(async () => {
      setError(null);
      // The OAuth client plugin attaches the signed query of this page.
      const { data, error } = await authClient.$fetch<{ redirect?: boolean; url?: string }>("/oauth2/consent", {
        method: "POST",
        body: { accept },
      });
      if (error || !data?.url) {
        setError(error?.message ?? "La demande a expiré. Relance la connexion depuis l'application.");
        return;
      }
      window.location.href = data.url;
    });

  return (
    <AuthCard
      title={`Autoriser ${clientName} ?`}
      description={`${clientName}${clientUri ? ` (${new URL(clientUri).host})` : ""} demande l'accès à ton Cockpit. Tu pourras le révoquer à tout moment dans Réglages.`}
    >
      <ul className="space-y-2.5">
        {(scopes.length ? scopes : ["cockpit"]).map((scope) => (
          <li key={scope} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
            <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            {SCOPE_LABELS[scope] ?? scope}
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-start gap-2 text-[12px] text-subtle">
        <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Les entrées privées restent invisibles pour lui. Il propose, tu valides dans Cockpit.
      </p>
      <FormError message={error} />
      <div className="mt-2 flex gap-2">
        <Button className="flex-1" onClick={() => decide(true)} disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          Autoriser
        </Button>
        <Button variant="outline" onClick={() => decide(false)} disabled={pending}>
          Refuser
        </Button>
      </div>
    </AuthCard>
  );
}
