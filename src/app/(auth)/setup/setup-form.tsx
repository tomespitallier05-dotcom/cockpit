"use client";

import { FingerprintIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authErrorMessage, passkeyErrorMessage } from "@/lib/auth-client";
import { AuthCard, FormError } from "../auth-card";

const MIN_PASSWORD = 12;

export function SetupForm() {
  const router = useRouter();
  const [step, setStep] = useState<"account" | "passkey">("account");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const enterApp = () => {
    router.replace("/");
    router.refresh();
  };

  const createAccount = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    startTransition(async () => {
      const { error } = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password });
      if (error) {
        setError(authErrorMessage(error));
        return;
      }
      setStep("passkey");
    });
  };

  const addPasskey = () =>
    startTransition(async () => {
      setError(null);
      const result = await authClient.passkey.addPasskey({ name: "Appareil principal" });
      if (result?.error) {
        setError(passkeyErrorMessage(result.error));
        return;
      }
      enterApp();
    });

  if (step === "passkey") {
    return (
      <AuthCard
        title="Sécurise ton accès"
        description="Ajoute une passkey : tu te connecteras avec Face ID, Touch ID ou Windows Hello, sans mot de passe."
      >
        <div className="flex flex-col gap-3">
          <Button size="lg" className="h-10" onClick={addPasskey} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <FingerprintIcon />}
            Ajouter une passkey
          </Button>
          <FormError message={error} />
          <Button variant="ghost" onClick={enterApp} disabled={pending}>
            Plus tard
          </Button>
          <p className="text-center text-[12px] text-subtle">
            Tu pourras aussi activer la double authentification dans Réglages → Sécurité.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Bienvenue dans Cockpit"
      description="Crée ton compte propriétaire. C'est le seul compte de cet espace : personne d'autre ne pourra s'inscrire."
    >
      <form onSubmit={createAccount} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Prénom et nom</Label>
          <Input id="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
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
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <p className="text-[12px] text-subtle">{MIN_PASSWORD} caractères minimum.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm">Confirmation</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" className="h-10" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          Créer mon espace
        </Button>
      </form>
    </AuthCard>
  );
}
