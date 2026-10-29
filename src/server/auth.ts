import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { authBaseURL, authPlugins, authRateLimitRules, trustedOrigins } from "./auth-plugins";
import { db } from "./db";
import * as schema from "./db/schema";
import { assertCanCreateOwner, provisionWorkspace } from "./workspace";

export const auth = betterAuth({
  appName: "Cockpit",
  baseURL: authBaseURL(),
  // The OAuth provider serves /oauth2/token; the JWT plugin's own /token is not used.
  disabledPaths: ["/token"],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  // Stored in the database: on Vercel every request may land on a different instance, so an
  // in-memory counter would never reach its limit. Keys are IP + path. A window restarts from
  // the last allowed attempt, so keeping on trying keeps the door shut.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: authRateLimitRules,
  },
  trustedOrigins: trustedOrigins(),
  // Google is linked to the owner's account for Calendar and Drive, never used to sign in.
  socialProviders: process.env.GOOGLE_CLIENT_ID
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
          accessType: "offline",
          prompt: "select_account consent",
          disableSignUp: true,
        },
      }
    : undefined,
  account: {
    encryptOAuthTokens: true,
    accountLinking: { enabled: true, trustedProviders: ["google"], allowDifferentEmails: true },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/social") {
        throw new APIError("FORBIDDEN", { message: "Connecte-toi avec ton mot de passe ou ta passkey." });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => {
          const refusal = await assertCanCreateOwner(newUser.email);
          if (refusal) {
            throw new APIError("FORBIDDEN", { message: refusal });
          }
          return { data: newUser };
        },
        after: async (createdUser) => {
          await provisionWorkspace(createdUser);
        },
      },
    },
  },
  // nextCookies must stay last so Server Actions can set auth cookies.
  plugins: [...authPlugins(), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
