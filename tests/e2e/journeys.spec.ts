import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "./constants";

// Parcours 2 à 5, dans l'ordre : chacun s'appuie sur ce que le précédent a créé.
test.describe.configure({ mode: "serial" });

const FIRST_NOTE = "Relancer les acheteurs le dimanche soir";
const SECOND_NOTE = "Idée : lot de vêtements par taille";
const TASK = "Envoyer le devis au client";

/** Quick capture with the keyboard shortcut, as a user would. */
async function capture(page: Page, title: string) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(E2E_USER.firstName);
  const dialog = page.getByRole("dialog", { name: "Capturer" });
  // The heading is server-rendered before the page is interactive: a "C" pressed too early
  // is lost, so retry the shortcut until the dialog opens (it is ignored once it is open).
  await expect(async () => {
    await page.locator("body").press("c");
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await dialog.getByPlaceholder("Titre (facultatif)").fill(title);
  await dialog.locator("textarea").fill("Conseil de mon mentor pendant l'appel.");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Capturé dans l'Inbox")).toBeVisible();
  await expect(dialog).toBeHidden();
}

test("Parcours 2 : capture d'une note arrive dans l'Inbox", async ({ page }) => {
  await capture(page, FIRST_NOTE);
  await page.goto("/inbox");
  await expect(page.getByRole("button", { name: new RegExp(FIRST_NOTE) })).toBeVisible();
  await expect(page.getByText(/1 élément à trier/)).toBeVisible();
});

test("Parcours 3 : tri de l'Inbox (classer, puis supprimer)", async ({ page }) => {
  await capture(page, SECOND_NOTE);
  await page.goto("/inbox");
  await expect(page.getByText(/2 éléments à trier/)).toBeVisible();

  // File the first note without a project, with the row's button.
  const firstRow = page.getByRole("listitem").filter({ hasText: FIRST_NOTE });
  await firstRow.hover();
  await firstRow.getByRole("button", { name: "Classer sans projet" }).click();
  await expect(page.getByText("Classée", { exact: true })).toBeVisible();
  await expect(firstRow).toBeHidden();

  // Delete the second one with the keyboard (hover selects the row, Backspace deletes).
  const secondRow = page.getByRole("listitem").filter({ hasText: SECOND_NOTE });
  await secondRow.hover();
  await page.keyboard.press("Backspace");
  await expect(page.getByText("Entrée supprimée")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Inbox zéro" })).toBeVisible();
});

test("Parcours 4 : créer puis terminer une tâche", async ({ page }) => {
  await page.goto("/taches");
  const input = page.getByLabel("Nouvelle tâche");
  await input.fill(TASK);
  await input.press("Enter");

  const done = page.getByRole("checkbox", { name: `Terminer « ${TASK} »` });
  await expect(done).toBeVisible();
  await done.click();

  // A finished task moves into the collapsed « Terminées récemment » group.
  const doneGroup = page.getByRole("button", { name: /Terminées récemment · 1/ });
  await expect(doneGroup).toBeVisible();
  await doneGroup.click();
  await expect(page.getByRole("checkbox", { name: `Rouvrir « ${TASK} »` })).toBeVisible();

  // Still there after a reload: it was saved, not just shown.
  await page.reload();
  await page.getByRole("button", { name: /Terminées récemment · 1/ }).click();
  await expect(page.getByRole("checkbox", { name: `Rouvrir « ${TASK} »` })).toBeVisible();
});

test("Parcours 5 : l'accueil s'affiche avec son brief et sans erreur", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(E2E_USER.firstName);
  // The morning brief is shown, or its calm fallback if it failed: never a crash.
  await expect(page.getByText(/Une journée pour avancer|tâche|échange|Le brief du jour est momentanément indisponible/).first()).toBeVisible();
  // Next adds an empty route announcer with role="alert": look for our error panel's text instead.
  await expect(page.getByText(/Quelque chose s.est mal passé/)).toHaveCount(0);
  for (const label of ["Aujourd'hui", "Inbox", "Tâches"]) {
    await expect(page.getByRole("link", { name: new RegExp(label) }).first()).toBeVisible();
  }
});
