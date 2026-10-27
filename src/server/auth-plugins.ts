import { passkey } from "@better-auth/passkey";
import { twoFactor } from "better-auth/plugins/two-factor";

// Kept free of `server-only` and path aliases so the Better Auth CLI can load it
// (see scripts/better-auth.config.ts) to generate the auth tables.

export function authBaseURL() {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

/** Returned as a tuple so Better Auth can infer each plugin's fields (e.g. twoFactorEnabled). */
export function authPlugins(): [ReturnType<typeof passkey>, ReturnType<typeof twoFactor>] {
  const { hostname, origin } = new URL(authBaseURL());
  return [
    passkey({ rpID: hostname, rpName: "Cockpit", origin }),
    twoFactor({ issuer: "Cockpit" }),
  ];
}
