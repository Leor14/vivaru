import { expect, test } from "@playwright/test";

const guardEmail = process.env.E2E_GUARD_EMAIL;
const guardPassword = process.env.E2E_GUARD_PASSWORD;
const visitorName = process.env.E2E_GUARD_VISITOR_NAME;
const visitorQr = process.env.E2E_GUARD_VISITOR_QR;

const hasGuardE2EConfig = Boolean(guardEmail && guardPassword && visitorName && visitorQr);

test.describe("Guard visitors QR flow", () => {
  test("scans QR and opens visitor operational detail", async ({ page }) => {
    test.skip(!hasGuardE2EConfig, "Missing E2E_GUARD_* environment variables for guard visitors flow.");

    const wrongQr = `${visitorQr}-INVALID`;
    const encodedQrUrl = `https://hogaru.app/guard/scan?code=${encodeURIComponent(visitorQr as string)}`;

    await page.goto("/login");

    await page.getByLabel("Correo").fill(guardEmail as string);
    await page.getByLabel("Contrasena").fill(guardPassword as string);
    await page.getByRole("button", { name: /entrar a mi workspace/i }).click();

    await page.waitForURL(/\/guard(\/.*)?$/i, { timeout: 60_000 });
    await page.goto("/guard/visitors");

    await expect(page.getByRole("heading", { name: "Visitantes" })).toBeVisible();
    await page.getByRole("button", { name: "Escanear QR" }).click();
    await expect(page.getByRole("heading", { name: "Escanear QR" })).toBeVisible();

    const manualInput = page.getByPlaceholder("Pega o escribe el codigo QR");

    await manualInput.fill(wrongQr);
    await page.getByRole("button", { name: "Validar codigo" }).click();
    await expect(page.getByText("Codigo no valido o QR no encontrado. Reintenta con otro codigo.")).toBeVisible();

    await manualInput.fill(encodedQrUrl);
    await page.getByRole("button", { name: "Validar codigo" }).click();

    await expect(page.getByText(new RegExp(`Bienvenido, ${visitorName as string}`))).toBeVisible();
    await expect(page.getByRole("heading", { name: visitorName as string })).toBeVisible();
    await expect(page.getByRole("button", { name: /Entró/i })).toBeVisible();
  });
});
