import { expect, test } from "@playwright/test";

// Hors parcours : la page 404 et l'accès au cron (CRON_SECRET obligatoire).
test("une URL inconnue affiche la page 404 en français", async ({ page }) => {
  const response = await page.goto("/cette-page-nexiste-pas");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Retour à l’accueil" })).toBeVisible();
});

test.describe("tâche quotidienne /api/cron/daily", () => {
  test("refuse un appel sans secret", async ({ request }) => {
    const response = await request.get("/api/cron/daily");
    expect(response.status()).toBe(401);
  });

  test("refuse l'ancien contournement par user-agent", async ({ request }) => {
    const response = await request.get("/api/cron/daily", { headers: { "user-agent": "vercel-cron/1.0" } });
    expect(response.status()).toBe(401);
  });

  test("refuse un mauvais secret", async ({ request }) => {
    const response = await request.get("/api/cron/daily", { headers: { authorization: "Bearer autre-chose" } });
    expect(response.status()).toBe(401);
  });

  test("s'exécute avec le bon secret", async ({ request }) => {
    const response = await request.get("/api/cron/daily", { headers: { authorization: "Bearer e2e-cron-secret" } });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.report)).toBe(true);
  });
});
