import { expect, test } from "@playwright/test";

/**
 * Validates that updating the tenant branding color from
 * `Configuración → Perfil del edificio` is reflected on the admin sidebar
 * immediately, without requiring a full page reload.
 *
 * Requires env vars (skipped automatically if missing):
 *   E2E_ADMIN_EMAIL
 *   E2E_ADMIN_PASSWORD
 */

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

const FIRST_COLOR = "#3b4fd0";
const SECOND_COLOR = "#356f3c";
const THIRD_COLOR = "#0f172a";

test.describe("Admin tenant branding live update", () => {
  test.skip(!adminEmail || !adminPassword, "Admin E2E credentials not configured.");

  test("sidebar color updates without reload after saving branding", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    // 1. Login
    await page.goto("/login");
    await page.getByLabel("Correo").fill(adminEmail!);
    await page.getByLabel("Contrasena").fill(adminPassword!);
    await page.getByRole("button", { name: /entrar a mi workspace/i }).click();
    await page.waitForURL("**/admin**", { timeout: 30_000 });

    // 2. Navigate to settings
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: /branding del edificio/i })).toBeVisible();

    // The desktop sidebar root is the AdminSidebar container with inline
    // backgroundColor. Pick the aside that hosts the main navigation nav.
    const sidebarRoot = page
      .locator('aside.hidden.md\\:block')
      .locator('div.flex.flex-col')
      .first();
    await expect(sidebarRoot).toBeVisible();

    const readSidebarColor = () =>
      sidebarRoot.evaluate((el) => (el as HTMLElement).style.backgroundColor);

    const initialColor = await readSidebarColor();

    // Helper to pick a swatch and save, then assert sidebar color changed
    // without reloading.
    async function pickAndSave(hex: string, expectedRgb: string) {
      const beforeUrl = page.url();

      await page.getByRole("button", { name: `Seleccionar color ${hex}` }).click();

      const saveButton = page.getByRole("button", { name: /guardar cambios/i });
      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      // Toast confirms persistence
      await expect(page.getByText(/branding del edificio actualizado/i)).toBeVisible({
        timeout: 10_000,
      });

      // CRITICAL ASSERTION: sidebar color reflected without reload.
      await expect
        .poll(async () => readSidebarColor(), { timeout: 5_000 })
        .toBe(expectedRgb);

      // We did not navigate away.
      expect(page.url()).toBe(beforeUrl);

      // Save button returns to disabled (sin cambios).
      await expect(page.getByRole("button", { name: /sin cambios/i })).toBeDisabled();
    }

    await pickAndSave(FIRST_COLOR, "rgb(59, 79, 208)");
    await pickAndSave(SECOND_COLOR, "rgb(53, 111, 60)");
    await pickAndSave(THIRD_COLOR, "rgb(15, 23, 42)");

    // Persistence-after-navigation: navigate away and back, color holds.
    await page.goto("/admin/reservations");
    await expect(sidebarRoot).toBeVisible();
    expect(await readSidebarColor()).toBe("rgb(15, 23, 42)");

    // Persistence-after-reload.
    await page.reload();
    await expect(sidebarRoot).toBeVisible();
    expect(await readSidebarColor()).toBe("rgb(15, 23, 42)");

    // No console errors leaked during the flow.
    expect(consoleErrors, `Console errors: ${consoleErrors.join(" | ")}`).toEqual([]);

    // Sanity: initial color was a non-empty rgb string.
    expect(initialColor).toMatch(/^rgb\(/);
  });
});
