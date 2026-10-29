import { defineConfig, devices } from "@playwright/test";
import { testDatabaseUrl } from "./tests/test-env.mjs";

// End-to-end tests: `npm run test:e2e` (after `npm run test:db:up` and `npm run test:db:reset`).
// The app is started on its own port against the TEST database, with the AI in mock
// mode. Every variable that .env.local could otherwise inject (API keys, storage…) is
// set to an empty string here, because Next never overrides a variable that is already set.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const databaseUrl = testDatabaseUrl();

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testIgnore: [/auth\.setup\.ts/, /connexion\.spec\.ts/],
      use: { ...devices["Desktop Chrome"], storageState: "tests/e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
    {
      // The login journey starts signed out.
      name: "chromium-signed-out",
      testMatch: /connexion\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      DATABASE_URL: databaseUrl,
      DIRECT_DATABASE_URL: databaseUrl,
      BETTER_AUTH_URL: BASE_URL,
      BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-1",
      OWNER_EMAIL: "camille@cockpit.test",
      CRON_SECRET: "e2e-cron-secret",
      AI_MOCK: "1",
      NEXT_PUBLIC_SENTRY_DSN: "",
      ANTHROPIC_API_KEY: "",
      AI_GATEWAY_API_KEY: "",
      BLOB_READ_WRITE_TOKEN: "",
      BLOB_STORE_ID: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      DISCORD_BOT_TOKEN: "",
      INBOUND_EMAIL_SECRET: "",
      VAPID_PUBLIC_KEY: "",
      VAPID_PRIVATE_KEY: "",
    },
  },
});
