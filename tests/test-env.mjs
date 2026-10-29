// Shared by the integration tests and scripts/test-db.mjs.
//
// Tests run against a throwaway Postgres (docker-compose.test.yml), never against
// the database in .env.local. Two guards enforce it: the URL comes from
// TEST_DATABASE_URL only, and its host must be local.

export const DEFAULT_TEST_DATABASE_URL = "postgres://cockpit:cockpit@127.0.0.1:54329/cockpit_test";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "postgres-test"]);

export function testDatabaseUrl() {
  const url = process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`TEST_DATABASE_URL pointe vers « ${host} » : les tests ne tournent que sur une base locale, pour ne jamais toucher aux vraies données.`);
  }
  return url;
}
