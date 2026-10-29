"use client";

import { CopyIcon, DownloadIcon, FingerprintIcon, KeyRoundIcon, Loader2Icon, RefreshCwIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authErrorMessage, passkeyErrorMessage } from "@/lib/auth-client";
import { formatShortDate } from "@/lib/format";

export function SecuritySettings({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <PasskeysPanel />
      <TwoFactorPanel enabled={twoFactorEnabled} />
    </div>
  );
}

function defaultPasskeyName() {
  const agent = navigator.userAgent;
  if (/iPhone/.test(agent)) return "iPhone";
  if (/iPad/.test(agent)) return "iPad";
  if (/Android/.test(agent)) return "Android";
  if (/Mac/.test(agent)) return "Mac";
  if (/Windows/.test(agent)) return "Windows";
  return "Appareil";
}

function PasskeysPanel() {
  const { data: passkeys, isPending } = authClient.useListPasskeys();
  const [adding, startAdding] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const add = () =>
    startAdding(async () => {
      const result = await authClient.passkey.addPasskey({ name: defaultPasskeyName() });
      if (result?.error) {
        toast.error(passkeyErrorMessage(result.error));
        return;
      }
      toast.success("Passkey ajoutée", { description: "Tu peux maintenant te connecter sans mot de passe." });
    });

  const remove = async (id: string) => {
    setRemovingId(id);
    const { error } = await authClient.passkey.deletePasskey({ id });
    setRemovingId(null);
    if (error) {
      toast.error(authErrorMessage(error));
      return;
    }
    toast.success("Passkey supprimée");
  };

  return (
    <div className="surface p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <FingerprintIcon className="size-[18px]" />
          </span>
          <div>
            <h3 className="text-[14px] font-medium text-foreground">Passkeys</h3>
            <p className="mt-0.5 max-w-md text-[13px] text-muted-foreground">
              Connexion par Face ID, Touch ID ou Windows Hello. Plus sûr qu&apos;un mot de passe, et
              impossible à hameçonner.
            </p>
          </div>
        </div>
        <Button onClick={add} disabled={adding} className="shrink-0">
          {adding ? <Loader2Icon className="animate-spin" /> : <KeyRoundIcon />}
          Ajouter une passkey
        </Button>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-border rounded-lg border border-border">
        {isPending ? (
          <p className="px-4 py-3 text-[13px] text-subtle">Chargement…</p>
        ) : passkeys && passkeys.length > 0 ? (
          passkeys.map((passkey) => (
            <div key={passkey.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-foreground">{passkey.name || "Passkey"}</p>
                <p className="text-[12px] text-subtle">
                  {passkey.deviceType === "multiDevice" ? "Synchronisée" : "Cet appareil uniquement"}
                  {passkey.createdAt ? ` · ajoutée le ${formatShortDate(new Date(passkey.createdAt))}` : null}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Supprimer ${passkey.name || "la passkey"}`}
                disabled={removingId === passkey.id}
                onClick={() => remove(passkey.id)}
              >
                {removingId === passkey.id ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
              </Button>
            </div>
          ))
        ) : (
          <p className="px-4 py-3 text-[13px] text-subtle">
            Aucune passkey. Ajoute-en une sur chaque appareil que tu utilises.
          </p>
        )}
      </div>
    </div>
  );
}

type EnrollStep =
  | { kind: "password" }
  | { kind: "scan"; totpURI: string; backupCodes: string[] }
  | { kind: "codes"; backupCodes: string[] };

/** The one-time backup codes, with copy and download so they really get saved somewhere. */
function BackupCodes({ codes, title }: { codes: string[]; title: string }) {
  const text = codes.join("\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Codes copiés");
    } catch {
      toast.error("Copie impossible : sélectionne les codes à la main.");
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`Cockpit : codes de secours\n(chaque code ne sert qu'une fois)\n\n${text}\n`], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "cockpit-codes-de-secours.txt";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="rounded-lg border border-warning/25 bg-warning/[0.06] p-3">
      <p className="text-[12.5px] font-medium text-warning">{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[12px] text-muted-foreground select-all">
        {codes.map((backupCode) => (
          <span key={backupCode}>{backupCode}</span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          <CopyIcon /> Copier
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <DownloadIcon /> Télécharger
        </Button>
      </div>
    </div>
  );
}

function TwoFactorPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"enable" | "disable" | "codes" | null>(null);
  const [step, setStep] = useState<EnrollStep>({ kind: "password" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  const close = () => {
    setDialog(null);
    setStep({ kind: "password" });
    setPassword("");
    setCode("");
  };

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      if (dialog === "codes") {
        const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });
        if (error || !data) {
          toast.error(authErrorMessage(error));
          return;
        }
        setStep({ kind: "codes", backupCodes: data.backupCodes });
        return;
      }
      if (dialog === "disable") {
        const { error } = await authClient.twoFactor.disable({ password });
        if (error) {
          toast.error(authErrorMessage(error));
          return;
        }
        toast.success("Double authentification désactivée");
        close();
        router.refresh();
        return;
      }
      const { data, error } = await authClient.twoFactor.enable({ password, method: "totp" });
      if (error || !data || data.method !== "totp") {
        toast.error(authErrorMessage(error));
        return;
      }
      setStep({ kind: "scan", totpURI: data.totpURI, backupCodes: data.backupCodes });
    });
  };

  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const { error } = await authClient.twoFactor.verifyTotp({ code: code.trim() });
      if (error) {
        toast.error(authErrorMessage(error));
        return;
      }
      toast.success("Double authentification activée");
      close();
      router.refresh();
    });
  };

  const secret = step.kind === "scan" ? new URL(step.totpURI).searchParams.get("secret") : null;

  return (
    <div className="surface p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/12 text-success">
            <ShieldCheckIcon className="size-[18px]" />
          </span>
          <div>
            <h3 className="flex items-center gap-2 text-[14px] font-medium text-foreground">
              Double authentification
              <span
                className={
                  enabled
                    ? "rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-medium text-success"
                    : "rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-medium text-subtle"
                }
              >
                {enabled ? "Activée" : "Désactivée"}
              </span>
            </h3>
            <p className="mt-0.5 max-w-md text-[13px] text-muted-foreground">
              Un code à 6 chiffres depuis une app comme 1Password, Google Authenticator ou Authy, en plus
              du mot de passe.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Button
            variant={enabled ? "outline" : "default"}
            onClick={() => setDialog(enabled ? "disable" : "enable")}
          >
            {enabled ? "Désactiver" : "Activer"}
          </Button>
          {enabled ? (
            <Button variant="ghost" size="sm" onClick={() => setDialog("codes")}>
              <RefreshCwIcon /> Régénérer les codes de secours
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => (open ? null : close())}>
        <DialogContent className="sm:max-w-md">
          {step.kind === "codes" ? (
            <div className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Nouveaux codes de secours</DialogTitle>
                <DialogDescription>Chaque code ne sert qu&apos;une fois. Les précédents ne fonctionnent plus.</DialogDescription>
              </DialogHeader>
              <BackupCodes codes={step.backupCodes} title="Garde-les en lieu sûr, hors de cet appareil" />
              <DialogFooter>
                <Button type="button" onClick={close}>
                  J&apos;ai enregistré les codes
                </Button>
              </DialogFooter>
            </div>
          ) : step.kind === "password" ? (
            <form onSubmit={submitPassword} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>
                  {dialog === "disable"
                    ? "Désactiver la double authentification"
                    : dialog === "codes"
                      ? "Régénérer les codes de secours"
                      : "Activer la double authentification"}
                </DialogTitle>
                <DialogDescription>
                  {dialog === "codes"
                    ? "Confirme ton mot de passe. Les anciens codes de secours cesseront de fonctionner."
                    : "Confirme ton mot de passe pour continuer."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="2fa-password">Mot de passe</Label>
                <Input
                  id="2fa-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={close}>
                  Annuler
                </Button>
                <Button type="submit" disabled={pending || !password} variant={dialog === "disable" ? "destructive" : "default"}>
                  {pending ? <Loader2Icon className="animate-spin" /> : null}
                  Continuer
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={submitCode} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Scanne ce QR code</DialogTitle>
                <DialogDescription>
                  Avec ton application d&apos;authentification, puis saisis le code affiché.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center rounded-xl bg-white p-4">
                <QRCode value={step.totpURI} size={168} />
              </div>
              {secret ? (
                <p className="text-center text-[12px] text-subtle">
                  Clé manuelle : <code className="font-mono text-muted-foreground select-all">{secret}</code>
                </p>
              ) : null}
              <BackupCodes codes={step.backupCodes} title="Codes de secours : garde-les en lieu sûr" />
              <div className="flex flex-col gap-2">
                <Label htmlFor="2fa-code">Code à 6 chiffres</Label>
                <Input
                  id="2fa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  className="font-mono tracking-[0.3em]"
                  required
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={close}>
                  Annuler
                </Button>
                <Button type="submit" disabled={pending || code.length !== 6}>
                  {pending ? <Loader2Icon className="animate-spin" /> : null}
                  Vérifier et activer
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
