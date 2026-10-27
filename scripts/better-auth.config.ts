// Used only by `npm run auth:schema` to regenerate src/server/db/schema/auth.ts.
// The app's real config lives in src/server/auth.ts; both share authPlugins().
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { authPlugins } from "../src/server/auth-plugins";

export const auth = betterAuth({
  database: drizzleAdapter({}, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  plugins: authPlugins(),
});
