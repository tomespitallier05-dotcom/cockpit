// `npm run test:db:reset`: empties the TEST database and applies every migration
// from ./drizzle, exactly as production does (drizzle-kit migrate). Needs a local
// Postgres with pgvector: `npm run test:db:up` starts one with Docker.
import { spawnSync } from "node:child_process";
import postgres from "postgres";
import { testDatabaseUrl } from "../tests/test-env.mjs";

const url = testDatabaseUrl();

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  // drizzle-kit keeps its journal in the "drizzle" schema: drop both.
  await sql.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE");
  await sql.unsafe("CREATE SCHEMA public");
} finally {
  await sql.end();
}

const result = spawnSync("npx", ["drizzle-kit", "migrate"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url },
});
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("Base de test prête.");
