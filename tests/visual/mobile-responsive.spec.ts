import { expect, test, type Page } from "@playwright/test";

const breakpoints = [320, 360, 375, 390, 412, 430, 480] as const;
const publicPages = ["/", "/login"] as const;
const protectedPages = ["/admin", "/resident", "/superadmin"] as const;

async function login(page: Page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) return false;

  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|resident|superadmin/, { timeout: 15_000 });
  return true;
}

test.describe("mobile responsive snapshots", () => {
  for (const width of breakpoints) {
    test(`public pages at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });

      for (const route of publicPages) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot(`public-${route.replace(/\//g, "_") || "root"}-${width}.png`, {
          fullPage: true,
          animations: "disabled",
        });
      }
    });
  }

  test("protected pages snapshots when credentials are available", async ({ page }) => {
    const loggedIn = await login(page);
    test.skip(!loggedIn, "Set E2E_EMAIL and E2E_PASSWORD to capture authenticated mobile snapshots.");

    for (const width of breakpoints) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of protectedPages) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot(`protected-${route.replace(/\//g, "_")}-${width}.png`, {
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  });
});
