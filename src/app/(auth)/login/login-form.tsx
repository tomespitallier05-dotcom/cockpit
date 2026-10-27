"use client";

import { FingerprintIcon, Loader2Icon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authErrorMessage, passkeyErrorMessage } from "@/lib/auth-client";
import { AuthCard, AuthDivider, FormError, safeNextPath } from "../auth-card";

export function LoginForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [step, setStep] = useState<"credentials" | "second-factor">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const finish = useCallback(() => {
    router.replace(next);
    router.refresh();
  }, [router, next]);

  // Passkey autofill: the browser offers saved passkeys right in the email field.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof PublicKeyCredential === "undefined") return;
      if (!(await PublicKeyCredential.isConditionalMediationAvailable?.())) return;
      const result = await authClient.signIn.passkey({ autoFill: true });
      if (!cancelled && result && !result.error) finish();
    })();
    return () => {
      cancelled = true;
    };
  }, [finish]);

  const signInWithPasskey = () =>
    startTransition(async () => {
      setError(null);
      const result = await authClient.signIn.passkey();
      if (result?.error) {
        setError(passkeyErrorMessage(result.error));
        return;
      }
      finish();
    });

  const signInWithPassword = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      const { data, error } = await authClient.signIn.email({ email, password });
      if (error) {
        setError(authErrorMessage(error));
        return;
      }
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
        setStep("second-factor");
        return;
      }
      finish();
    });
  };

  const verifySecondFactor = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      const { error } = useBackupCode
        ? await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice: true })
        : await authClient.twoFactor.verifyTotp({ code: code.trim(), trustDevice: true });
      if (error) {
        setError(authErrorMessage(error));
        return;
      }
      finish();
    });
  };

  if (step === "second-factor") {
    return (
      <AuthCard
        title="Vérification en deux étapes"
        description={
          useBackupCode
            ? "Saisis l'un de tes codes de secours."
            : "Saisis le code à 6 chiffres de ton application d'authentification."
        }
      >
        <form onSubmit={verifySecondFactor} className="flex flex-col gap-3">
          <Label htmlFor="code" className="sr-only">
            Code
          </Label>
          <Input
            id="code"
            inputMode={useBackupCode ? "text" : "numeric"}
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(useBackupCode ? event.target.value : event.target.value.replace(/\D/g, ""))}
            maxLength={useBackupCode ? 32 : 6}
            className="h-11 text-center font-mono text-lg tracking-[0.35em]"
            autoFocus
            required
          />
          <FormError message={error} />
          <Button type="submit" size="lg" className="h-10" disabled={pending || code.length === 0}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            Vérifier
          </Button>
          <button
            type="button"
            onClick={() => {
              setUseBackupCode((value) => !value);
              setCode("");
              setError(null);
            }}
            className="mt-1 text-[12.5px] text-subtle transition-colors hover:text-foreground"
          >
            {useBackupCode ? "Utiliser l'application d'authentification" : "Utiliser un code de secours"}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Content de te revoir" description="Connecte-toi pour retrouver ton cockpit.">
      <Button type="button" size="lg" className="h-10 w-full" onClick={signInWithPasskey} disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : <FingerprintIcon />}
        Continuer avec une passkey
      </Button>

      <AuthDivider label="ou avec ton mot de passe" />

      <form onSubmit={signInWithPassword} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username webauthn"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <FormError message={error} />
        <Button type="submit" variant="outline" size="lg" className="h-10" disabled={pending}>
          Se connecter
        </Button>
      </form>
    </AuthCard>
  );
}
