"use client";

import { CopyIcon, Loader2Icon, LinkIcon, UnlinkIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { disconnectGoogle } from "@/server/actions/google";
import { registerDiscordCommands } from "@/server/actions/integrations";

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/drive.readonly"];

export function GoogleButtons({ configured, linked }: { configured: boolean; linked: boolean }) {
  const [pending, startTransition] = useTransition();
  if (!configured) return null;
  return linked ? (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await disconnectGoogle();
          if (!result.ok) toast.error(result.error);
          else toast.success("Google déconnecté");
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <UnlinkIcon />}
      Déconnecter
    </Button>
  ) : (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await authClient.linkSocial({ provider: "google", scopes: GOOGLE_SCOPES, callbackURL: "/reglages#integrations" });
          if (result?.error) toast.error(result.error.message ?? "Connexion impossible.");
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <LinkIcon />}
      Connecter Google
    </Button>
  );
}

export function DiscordButton({ configured }: { configured: boolean }) {
  const [pending, startTransition] = useTransition();
  if (!configured) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await registerDiscordCommands();
          if (!result.ok) toast.error(result.error);
          else toast.success("Commandes enregistrées", { description: "/save et « Enregistrer dans Cockpit » sur un message." });
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : null}
      Enregistrer les commandes
    </Button>
  );
}

export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md bg-white/[0.04] px-2 py-1 font-mono text-[11.5px] text-muted-foreground">{value}</code>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Copier ${label}`}
        onClick={() => {
          void navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "✓" : <CopyIcon />}
      </Button>
    </div>
  );
}
