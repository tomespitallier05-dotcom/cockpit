import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { passkeyClient } from "@better-auth/passkey/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // oauthProviderClient forwards the signed OAuth query from /login and /connecteur,
  // so signing in during a connector authorization resumes that authorization.
  plugins: [passkeyClient(), twoFactorClient(), oauthProviderClient()],
});

/** Better Auth errors carry a message in English; map the common ones to French. */
export function authErrorMessage(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return "Une erreur est survenue.";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Email ou mot de passe incorrect.";
    case "PASSWORD_TOO_SHORT":
      return "Le mot de passe doit contenir au moins 12 caractères.";
    case "INVALID_CODE":
    case "INVALID_TWO_FACTOR_AUTHENTICATION":
      return "Code invalide. Réessaie avec le code actuel de ton application.";
    case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
      return "Trop de tentatives. Patiente un moment avant de réessayer.";
    default:
      return error.message || "Une erreur est survenue.";
  }
}

/** WebAuthn failures are mostly the user closing the prompt; say so plainly. */
export function passkeyErrorMessage(error: { code?: string; message?: string }) {
  const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  if (text.includes("cancel") || text.includes("abort") || text.includes("notallowed")) {
    return "Opération annulée.";
  }
  if (text.includes("already") || text.includes("exist")) {
    return "Cet appareil a déjà une passkey pour Cockpit.";
  }
  return authErrorMessage(error);
}
