import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { hasOwner } from "@/server/workspace";
import { AuthCardSkeleton } from "../auth-card";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Créer ton compte" };

export default function SetupPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <SetupGate />
    </Suspense>
  );
}

/** First run only: once the owner exists, this page is gone for good. */
async function SetupGate() {
  // Request-time check: the embedded database isn't seen as dynamic I/O by Next.
  await connection();
  if (await hasOwner()) {
    redirect("/login");
  }
  return <SetupForm />;
}
