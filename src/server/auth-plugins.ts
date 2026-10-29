import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { passkey } from "@better-auth/passkey";
import { jwt } from "better-auth/plugins";
import { twoFactor } from "better-auth/plugins/two-factor";

// Kept free of `server-only` and path aliases so the Better Auth CLI can load it
// (see scripts/better-auth.config.ts) to generate the auth tables.

export function authBaseURL() {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

/** The Cockpit connector (MCP server) that Claude connects to. */
export function mcpResourceURL() {
  return `${new URL(authBaseURL()).origin}/api/mcp`;
}

/** Scope granted to the Claude connector: read and write the owner's Cockpit data. */
export const MCP_SCOPE = "cockpit";

type Plugins = [
  ReturnType<typeof passkey>,
  ReturnType<typeof twoFactor>,
  ReturnType<typeof jwt>,
  ReturnType<typeof mcp>,
  ReturnType<typeof cimd>,
];

/**
 * Returned as a tuple so Better Auth can infer each plugin's fields (e.g. twoFactorEnabled).
 * jwt + mcp + cimd turn Cockpit into an OAuth 2.1 authorization server for MCP
 * clients: Claude (web, desktop, mobile) registers itself, the owner signs in and
 * consents, and Claude receives a token bound to /api/mcp only.
 */
export function authPlugins(): Plugins {
  const { hostname, origin } = new URL(authBaseURL());
  return [
    passkey({ rpID: hostname, rpName: "Cockpit", origin }),
    twoFactor({ issuer: "Cockpit" }),
    jwt(),
    mcp({
      loginPage: "/login",
      consentPage: "/connecteur",
      resource: mcpResourceURL(),
      scopes: ["openid", "profile", "email", "offline_access", MCP_SCOPE],
      // Claude may register through Client ID Metadata Documents (cimd below) or
      // classic dynamic registration; either way, nothing works until the owner
      // signs in and approves the client on the consent page.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultApplicationType: "infer",
    }),
    cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
  ];
}
