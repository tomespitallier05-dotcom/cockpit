import { expect, test as setup } from "@playwright/test";
import { AUTH_FILE, E2E_USER } from "./constants";

// `next dev` compiles each route on its first visit, which can take well over the
// default timeouts. This step is deliberately patient and warms up the routes the
// journeys use, so that they then run at normal speed.
const COLD_START = 120_000;

// Creates the owner account through the real /setup screen, then saves the signed-in
// session for the other journeys.
setup("créer le compte propriétaire", async ({ page }) => {
  setup.setTimeout(5 * 60_000);

  await page.goto("/setup", { timeout: COLD_START });
  await expect(page.getByRole("heading", { name: "Bienvenue dans Cockpit" })).toBeVisible({ timeout: COLD_START });

  await page.getByLabel("Prénom et nom").fill(E2E_USER.name);
  await page.getByLabel("Email").fill(E2E_USER.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(E2E_USER.password);
  await page.getByLabel("Confirmation").fill(E2E_USER.password);
  await page.getByRole("button", { name: "Créer mon espace" }).click();

  await expect(page.getByRole("heading", { name: "Sécurise ton accès" })).toBeVisible({ timeout: COLD_START });
  await page.getByRole("button", { name: "Plus tard" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText(E2E_USER.firstName, { timeout: COLD_START });

  // Warm-up: compile the pages and routes the journeys visit.
  for (const path of ["/inbox", "/taches"]) {
    await page.goto(path, { timeout: COLD_START });
  }
  // Server-only warm-up (no navigation: /login redirects a signed-in user away).
  for (const path of ["/login", "/cette-page-nexiste-pas", "/api/cron/daily"]) {
    await page.request.get(path, { timeout: COLD_START });
  }

  await page.context().storageState({ path: AUTH_FILE });
});
