import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth } from "@/server/auth";
import { AuthCard, AuthCardSkeleton } from "../auth-card";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "Autoriser l'accès" };

/**
 * OAuth consent for the Cockpit connector: shown after sign-in when Claude (or
 * any MCP client) asks for access. The decision is posted with the signed query
 * from the URL, which the server verifies.
 */
export default function ConnectorConsentPage({ searchParams }: PageProps<"/connecteur">) {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <Consent searchParams={searchParams} />
    </Suspense>
  );
}

async function Consent({ searchParams }: { searchParams: PageProps<"/connecteur">["searchParams"] }) {
  await connection();
  const params = await searchParams;
  const clientId = typeof params.client_id === "string" ? params.client_id : null;
  if (!clientId || typeof params.sig !== "string") {
    return (
      <AuthCard title="Lien d'autorisation invalide" description="Relance la connexion depuis l'application qui demande l'accès.">
        <span />
      </AuthCard>
    );
  }
  const client = (await auth.api
    .getOAuthClientPublic({ query: { client_id: clientId }, headers: await headers() })
    .catch(() => null)) as { client_name?: string; client_uri?: string; logo_uri?: string } | null;
  const scopes = typeof params.scope === "string" ? params.scope.split(" ").filter(Boolean) : [];
  return <ConsentForm clientName={client?.client_name ?? "Une application"} clientUri={client?.client_uri ?? null} scopes={scopes} />;
}
