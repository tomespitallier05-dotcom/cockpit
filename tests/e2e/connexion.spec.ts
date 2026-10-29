import { expect, test } from "@playwright/test";
import { E2E_USER } from "./constants";

// Parcours 1 : connexion. Starts signed out (see playwright.config.ts).
test.describe("Parcours 1 : connexion", () => {
  test("une page protégée renvoie vers la connexion", async ({ page }) => {
    await page.goto("/taches");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Content de te revoir" })).toBeVisible();
  });

  test("un mauvais mot de passe affiche une erreur et reste sur la connexion", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(E2E_USER.email);
    await page.getByLabel("Mot de passe").fill("pas-le-bon-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.locator("p[aria-live='polite']")).not.toBeEmpty();
    await expect(page).toHaveURL(/\/login/);
  });

  test("email et mot de passe ouvrent l'accueil", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(E2E_USER.email);
    await page.getByLabel("Mot de passe").fill(E2E_USER.password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(E2E_USER.firstName);
  });
});
