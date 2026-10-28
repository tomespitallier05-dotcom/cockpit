// `npm run db:migrate` / predev: applies ./drizzle migrations.
// With a DATABASE_URL it defers to drizzle-kit. Locally it migrates the embedded
// PGlite database itself, because drizzle-kit's PGlite driver cannot load the
// pgvector extension that semantic search needs.
import { spawnSync } from "node:child_process";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

if (process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL) {
  const result = spawnSync("npx", ["drizzle-kit", "migrate"], { stdio: "inherit", shell: true });
  process.exit(result.status ?? 1);
}

const { PGlite } = await import("@electric-sql/pglite");
const { vector } = await import("@electric-sql/pglite-pgvector");
const { drizzle } = await import("drizzle-orm/pglite");
const { migrate } = await import("drizzle-orm/pglite/migrator");

const dir = process.env.PGLITE_DIR ?? ".pglite";
const client = new PGlite(dir, { extensions: { vector } });
await migrate(drizzle(client), { migrationsFolder: "drizzle" });
await client.close();
console.log(`Migrations applied to ${dir}`);
