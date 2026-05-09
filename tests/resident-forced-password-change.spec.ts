import { test, expect } from "@playwright/test";

const residentEmail = process.env.E2E_RESIDENT_EMAIL;
const temporaryPassword = process.env.E2E_RESIDENT_TEMP_PASSWORD;
const newPassword = process.env.E2E_RESIDENT_NEW_PASSWORD;

test.describe("Resident forced password change", () => {
  test("resident completes forced password change and can re-login", async ({ page }) => {
    if (!residentEmail || !temporaryPassword || !newPassword) {
      throw new Error("Missing E2E resident credentials in environment variables.");
    }

    const browserErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        browserErrors.push(`[${message.type()}] ${message.text()}`);
      }
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure();
      failedRequests.push(`${request.method()} ${request.url()} => ${failure?.errorText ?? "unknown"}`);
    });

    await page.goto("/login");

    await page.getByLabel("Correo").fill(residentEmail);
    await page.getByLabel("Contrasena").fill(temporaryPassword);
    await page.getByRole("button", { name: /entrar a mi workspace/i }).click();

    try {
      await page.waitForFunction(() => window.location.pathname !== "/login", { timeout: 60_000 });
    } catch {
      const alertText = await page.locator("[role='alert']").allInnerTexts().catch(() => []);
      throw new Error(
        [
          "Login did not navigate away from /login.",
          `Current URL: ${page.url()}`,
          `Alerts: ${alertText.join(" | ") || "none"}`,
          `Browser errors: ${browserErrors.join(" | ") || "none"}`,
          `Failed requests: ${failedRequests.join(" | ") || "none"}`,
        ].join("\n"),
      );
    }

    const firstPathname = new URL(page.url()).pathname;
    if (firstPathname !== "/resident/change-password-required") {
      throw new Error(
        [
          "Resident was not redirected to forced-change page after temporary login.",
          `Current URL: ${page.url()}`,
          `Browser errors: ${browserErrors.join(" | ") || "none"}`,
        ].join("\n"),
      );
    }

    await page.getByLabel("Clave temporal actual").fill(temporaryPassword);
    await page.getByLabel("Nueva contrasena").fill(newPassword);
    await page.getByLabel("Confirmar nueva contrasena").fill(newPassword);
    await page.getByRole("button", { name: /guardar nueva contrasena/i }).click();

    await page.waitForURL("**/resident", { timeout: 30_000 });
    await expect(page).not.toHaveURL(/change-password-required/);

    await page.getByRole("button", { name: /cerrar sesion/i }).first().click();
    await page.waitForURL("**/login", { timeout: 30_000 });

    await page.getByLabel("Correo").fill(residentEmail);
    await page.getByLabel("Contrasena").fill(newPassword);
    await page.getByRole("button", { name: /entrar a mi workspace/i }).click();

    await page.waitForURL("**/resident", { timeout: 30_000 });
    await expect(page).not.toHaveURL(/change-password-required/);
  });
});
