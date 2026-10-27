import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Same env files as `next dev` (.env.local, .env…).
loadEnvConfig(process.cwd());

// Migrations prefer a direct / session connection (Supabase port 5432); the app
// itself uses the transaction pooler in DATABASE_URL.
const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

export default databaseUrl
  ? defineConfig({
      dialect: "postgresql",
      schema: "./src/server/db/schema",
      out: "./drizzle",
      dbCredentials: { url: databaseUrl },
    })
  : defineConfig({
      dialect: "postgresql",
      driver: "pglite",
      schema: "./src/server/db/schema",
      out: "./drizzle",
      dbCredentials: { url: process.env.PGLITE_DIR ?? ".pglite" },
    });
