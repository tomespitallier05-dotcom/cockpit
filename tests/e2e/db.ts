import postgres from "postgres";
import { testDatabaseUrl } from "../test-env.mjs";

/** The rate limit counters live in the test database: clear them so runs never depend on each other. */
export async function clearRateLimits() {
  const sql = postgres(testDatabaseUrl(), { max: 1, onnotice: () => {} });
  try {
    await sql`delete from rate_limit`;
  } finally {
    await sql.end();
  }
}

export async function rateLimitRows(pathFragment: string) {
  const sql = postgres(testDatabaseUrl(), { max: 1, onnotice: () => {} });
  try {
    const rows = await sql`select key, count from rate_limit where key like ${"%" + pathFragment + "%"}`;
    return rows.length;
  } finally {
    await sql.end();
  }
}
