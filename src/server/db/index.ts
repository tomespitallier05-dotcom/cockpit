import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Production (and any env with DATABASE_URL) talks to Postgres through postgres.js.
 * Local development without DATABASE_URL uses PGlite, an embedded Postgres stored in
 * ./.pglite, so the app runs with zero setup. Both expose the same Drizzle query API;
 * the PGlite instance is typed as the Postgres one to keep a single `Database` type.
 */
function createDatabase(): Database {
  const url = process.env.DATABASE_URL;
  if (url) {
    // prepare: false keeps it compatible with Supabase's transaction pooler (port 6543).
    const client = postgres(url, { prepare: false, max: process.env.VERCEL ? 1 : 10 });
    return drizzlePostgres(client, { schema });
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL est obligatoire en production.");
  }
  const client = new PGlite(process.env.PGLITE_DIR ?? ".pglite", { extensions: { vector } });
  return drizzlePglite(client, { schema }) as unknown as Database;
}

// One instance per process, reused across hot reloads (two PGlite instances on
// the same directory would corrupt it), and created on first use so that
// `next build` can import this module without a database.
const globalForDb = globalThis as unknown as { cockpitDb?: Database };

function getDatabase(): Database {
  globalForDb.cockpitDb ??= createDatabase();
  return globalForDb.cockpitDb;
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const database = getDatabase();
    const value = Reflect.get(database, property, database);
    return typeof value === "function" ? value.bind(database) : value;
  },
});
