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

/**
 * Origins allowed to call the auth API besides BETTER_AUTH_URL. Vercel preview deployments
 * get their own URL: without it every sign-in there fails with « Invalid origin ». Only the
 * URLs Vercel itself injects on a *preview* build are trusted (never wildcards), plus
 * anything listed in TRUSTED_ORIGINS (comma-separated, full origins).
 */
export function trustedOrigins(): string[] {
  const origins = new Set<string>([new URL(authBaseURL()).origin]);
  if (process.env.VERCEL_ENV === "preview") {
    for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
      if (host) origins.add(`https://${host}`);
    }
  }
  for (const value of (process.env.TRUSTED_ORIGINS ?? "").split(",")) {
    try {
      const origin = new URL(value.trim()).origin;
      if (origin.startsWith("https://") || origin.startsWith("http://localhost")) origins.add(origin);
    } catch {
      // Ignore empty or malformed entries.
    }
  }
  return [...origins];
}

/**
 * Brute-force limits per IP and path (window in seconds). Better Auth's defaults are far too
 * generous for a password and a 6-digit code: a 6-digit TOTP must not be guessable.
 */
export const authRateLimitRules = {
  "/sign-in/email": { window: 15 * 60, max: 10 },
  "/sign-up/email": { window: 60 * 60, max: 5 },
  "/two-factor/verify-totp": { window: 15 * 60, max: 8 },
  "/two-factor/verify-backup-code": { window: 15 * 60, max: 8 },
  "/two-factor/enable": { window: 15 * 60, max: 10 },
  "/two-factor/disable": { window: 15 * 60, max: 10 },
  "/two-factor/generate-backup-codes": { window: 15 * 60, max: 10 },
  "/change-password": { window: 15 * 60, max: 10 },
  // The connector registers itself without being signed in: keep the flood small.
  "/oauth2/register": { window: 60 * 60, max: 20 },
  "/oauth2/token": { window: 60, max: 30 },
};

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
