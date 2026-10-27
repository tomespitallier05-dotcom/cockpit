import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth } from "@/server/auth";
import { hasOwner } from "@/server/workspace";
import { AuthCardSkeleton } from "../auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <LoginGate />
    </Suspense>
  );
}

async function LoginGate() {
  // Request-time check: the embedded database isn't seen as dynamic I/O by Next.
  await connection();
  if (!(await hasOwner())) {
    redirect("/setup");
  }
  // A validated session (not just a cookie) skips the form; an expired cookie lands here safely.
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    redirect("/");
  }
  return <LoginForm />;
}
