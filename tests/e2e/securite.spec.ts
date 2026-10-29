import { expect, test } from "@playwright/test";
import { E2E_USER } from "./constants";
import { clearRateLimits, rateLimitRows } from "./db";
import { totp } from "./totp";

const ORIGIN = "http://localhost:3100";

// Étape 2 : en-têtes, CSP, limitation de débit, e-mail entrant, codes de secours.
test.describe.configure({ mode: "serial" });

test.beforeAll(clearRateLimits);
test.afterAll(clearRateLimits);

test("en-têtes de sécurité sur chaque page", async ({ request }) => {
  const response = await request.get("/login");
  const headers = response.headers();
  const csp = headers["content-security-policy"];
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
});

test("la CSP ne bloque rien sur les pages principales", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/content security policy|violates the following/i.test(message.text())) violations.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (/content security policy/i.test(error.message)) violations.push(error.message);
  });
  for (const path of ["/", "/inbox", "/taches", "/reglages"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await page.waitForLoadState("networkidle");
  }
  expect(violations).toEqual([]);
});

test("trop de mauvais mots de passe : 429, compteur stocké en base", async ({ request }) => {
  const attempt = () =>
    request.post("/api/auth/sign-in/email", {
      headers: { origin: ORIGIN },
      data: { email: E2E_USER.email, password: "pas-le-bon-mot-de-passe" },
    });
  const statuses: number[] = [];
  for (let i = 0; i < 10; i += 1) statuses.push((await attempt()).status());
  expect(statuses.every((status) => status === 401)).toBe(true);

  const blocked = await attempt();
  expect(blocked.status()).toBe(429);
  expect(Number(blocked.headers()["x-retry-after"])).toBeGreaterThan(0);

  // Even the right password is refused while the window is closed.
  const right = await request.post("/api/auth/sign-in/email", {
    headers: { origin: ORIGIN },
    data: { email: E2E_USER.email, password: E2E_USER.password },
  });
  expect(right.status()).toBe(429);

  expect(await rateLimitRows("/sign-in/email")).toBeGreaterThan(0);
  await clearRateLimits();
});

test.describe("e-mail entrant : le secret n'est accepté qu'en Basic", () => {
  const basic = (secret: string) => `Basic ${Buffer.from(`inbound:${secret}`).toString("base64")}`;

  test("refuse ?token= dans l'URL", async ({ request }) => {
    const response = await request.post("/api/inbound/email?token=e2e-inbound-secret", { data: { Subject: "x" } });
    expect(response.status()).toBe(401);
  });

  test("refuse un mauvais mot de passe Basic", async ({ request }) => {
    const response = await request.post("/api/inbound/email", { headers: { authorization: basic("autre") }, data: { Subject: "x" } });
    expect(response.status()).toBe(401);
  });

  test("accepte le bon mot de passe Basic (rejette ensuite un corps invalide)", async ({ request }) => {
    const response = await request.post("/api/inbound/email", {
      headers: { authorization: basic("e2e-inbound-secret"), "content-type": "application/json" },
      data: "pas du json",
    });
    expect(response.status()).toBe(400);
  });
});

test("codes de secours : activer la 2FA, les régénérer, désactiver", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/reglages");
  await expect(page.getByText("Double authentification").first()).toBeVisible();

  // Enable.
  await page.getByRole("button", { name: "Activer", exact: true }).click();
  await page.getByLabel("Mot de passe").fill(E2E_USER.password);
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Codes de secours : garde-les en lieu sûr")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copier" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Télécharger" })).toBeVisible();
  const secret = (await page.locator("code.select-all").first().textContent())!.trim();
  await page.getByLabel("Code à 6 chiffres").fill(totp(secret));
  await page.getByRole("button", { name: "Vérifier et activer" }).click();
  await expect(page.getByText("Activée", { exact: true })).toBeVisible();

  // Regenerate: new codes, shown with copy and download.
  await page.getByRole("button", { name: "Régénérer les codes de secours" }).click();
  await page.getByLabel("Mot de passe").fill(E2E_USER.password);
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByRole("heading", { name: "Nouveaux codes de secours" })).toBeVisible();
  const codes = page.locator(".select-all.grid span");
  await expect(codes).toHaveCount(10);
  await page.getByRole("button", { name: "J'ai enregistré les codes" }).click();

  // Disable again so the other journeys sign in with the password alone.
  await page.getByRole("button", { name: "Désactiver", exact: true }).click();
  await page.getByLabel("Mot de passe").fill(E2E_USER.password);
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByText("Désactivée", { exact: true })).toBeVisible();
});
