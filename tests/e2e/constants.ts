// The owner account created by auth.setup.ts. OWNER_EMAIL in playwright.config.ts must match.
export const E2E_USER = {
  name: "Camille Test",
  firstName: "Camille",
  email: "camille@cockpit.test",
  password: "mot-de-passe-de-test-12",
} as const;

export const AUTH_FILE = "tests/e2e/.auth/user.json";
