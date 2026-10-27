import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { authBaseURL, authPlugins } from "./auth-plugins";
import { db } from "./db";
import * as schema from "./db/schema";
import { assertCanCreateOwner, provisionWorkspace } from "./workspace";

export const auth = betterAuth({
  appName: "Cockpit",
  baseURL: authBaseURL(),
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
  rateLimit: { enabled: true },
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
