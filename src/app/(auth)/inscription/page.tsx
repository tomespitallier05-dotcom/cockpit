import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth } from "@/server/auth";
import { AuthCardSkeleton } from "../auth-card";
import { SetupForm } from "../setup/setup-form";

export const metadata: Metadata = { title: "Créer un compte" };

export default function SignUpPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <SignUpGate />
    </Suspense>
  );
}

async function SignUpGate() {
  // Request-time check: the embedded database isn't seen as dynamic I/O by Next.
  await connection();
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    redirect("/");
  }
  if (process.env.SIGNUPS_DISABLED === "1") {
    redirect("/login");
  }
  return (
    <SetupForm
      copy={{
        title: "Crée ton compte",
        description: "Ton espace Cockpit est privé : tes données ne sont visibles que par toi.",
        submit: "Créer mon compte",
      }}
    />
  );
}
