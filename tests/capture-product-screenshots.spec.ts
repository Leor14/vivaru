/**
 * capture-product-screenshots.spec.ts
 *
 * Captura las screenshots de producto para la sección Perspectivas del landing.
 * Ejecutar con: npx playwright test tests/capture-product-screenshots.spec.ts
 *
 * Credenciales usadas:
 *   admin     → admin@santamaria.co      / Demo1234*  (tenant: Santa María)
 *   residente → residente@santamaria.co  / Demo1234*  (tenant: Santa María)
 *   portería  → guardia@elnogal.co       / Demo1234*  (tenant: El Nogal — sin guardia en Santa María)
 *
 * Output → /public/product/
 */

import * as fs from "fs";
import * as path from "path";
import { expect, test, type Page } from "@playwright/test";

const OUT = path.resolve(__dirname, "../public/product");

// ─── Login helper ─────────────────────────────────────────────────────────────

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /Ingresar/i }).click();
  // Espera hasta salir de /login (redirige al dashboard del rol)
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 30_000,
  });
}

// ─── Shot helper ──────────────────────────────────────────────────────────────

async function capture(
  page: Page,
  url: string,
  filename: string,
  extraWait?: () => Promise<void>
) {
  await page.goto(url);
  await page.waitForLoadState("load");
  // Espera breve para renderizado post-load (lazy images, Firebase data)
  await page.waitForTimeout(2500);
  if (extraWait) await extraWait();
  const buffer = await page.screenshot({ fullPage: false });
  const dest = path.join(OUT, filename);
  fs.writeFileSync(dest, buffer);
  console.log(`✓  ${filename}`);
  return buffer;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Product screenshots — Perspectivas", () => {
  test.setTimeout(180_000);

  // 1. Admin reservaciones (desktop 1440×900)
  test("admin reservations desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, "admin@santamaria.co", "Demo1234*");
    await capture(page, "/admin/reservations", "perspectives-admin-reservations.png");
  });

  // 2. Residente reservaciones (mobile 390×844)  → también hero
  test("resident reservations mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "residente@santamaria.co", "Demo1234*");
    const buffer = await capture(
      page,
      "/resident/reservations",
      "perspectives-resident-reservations.png"
    );
    // Copia como hero-resident-reservations.png
    fs.writeFileSync(path.join(OUT, "hero-resident-reservations.png"), buffer);
    console.log("✓  hero-resident-reservations.png (copia)");
  });

  // 3. Residente mi cuenta / estado de cuenta (mobile 390×844)
  test("resident account mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, "residente@santamaria.co", "Demo1234*");
    await capture(page, "/resident/account", "perspectives-resident-account.png");
  });

  // 4. Portería scanner QR visitantes (tablet 1024×768)
  test("guard QR scanner tablet", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    // Sin guardia para Santa María — usa El Nogal (misma UI)
    await loginAs(page, "guardia@elnogal.co", "Demo1234*");
    await capture(page, "/guard/visitors", "perspectives-porteria-scanner.png");
  });

  // 5. Portería paquetes (tablet 1024×768)
  test("guard packages tablet", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await loginAs(page, "guardia@elnogal.co", "Demo1234*");
    await capture(page, "/guard/packages", "perspectives-porteria-packages.png");
  });
});
