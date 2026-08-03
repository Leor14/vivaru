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
 *
 * ⚠️  ENTORNO. `playwright.config.ts` levanta `npm run dev`, y este repo NO
 * tiene las variables de Firebase en `.env.local`: el fallback de
 * `src/lib/firebase/config.ts` es **hogaru-1, producción**. Correrlo sin más
 * significa hacer login automatizado contra datos reales.
 *
 * Para apuntar a staging, exportar antes:
 *
 *   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyChPlJL3WESeNggGXBPMiHzIAAicEH8J6c \
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=vivaru-staging-02.firebaseapp.com \
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=vivaru-staging-02 \
 *   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=vivaru-staging-02.firebasestorage.app \
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=765613061037 \
 *   NEXT_PUBLIC_FIREBASE_APP_ID=1:765613061037:web:37c450d7c1a20b4812a724 \
 *   npx playwright test tests/capture-product-screenshots.spec.ts
 *
 * Las capturas salen a @2x (deviceScaleFactor: 2) para el rediseño del
 * landing: la sección de Perspectivas las muestra al doble de tamaño y a 1x
 * se veían blandas. Ver docs/plan-rediseno-landing.md.
 */

import * as fs from "fs";
import * as path from "path";
import { expect, test, type Page } from "@playwright/test";

// @2x en todo: el rediseño muestra estas capturas al doble de tamaño.
test.use({ deviceScaleFactor: 2 });

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
  // La banda «AMBIENTE DE PRUEBAS» no puede aparecer en material de marketing.
  // Se oculta desde aquí y NO con un parámetro de URL: una URL capaz de
  // esconder el aviso de «los datos aquí no son reales» es justo lo que no
  // debe existir en el producto.
  await page.addStyleTag({
    content: '[data-env-banner]{display:none !important}',
  });
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

// ─── Capturas del rediseño del landing ───────────────────────────────────────

test.describe("Product screenshots — rediseño landing", () => {
  test.setTimeout(180_000);

  // NO se captura: **el conmutador de conjunto no existe en el producto**.
  // Verificado en agosto de 2026: el claim de sesión lleva un único `tenantId`
  // (functions/src/index.ts, setCustomUserClaims) y `auth-context.tsx` resuelve
  // la membresía con `limit(1)`, es decir, toma la primera que encuentra. No hay
  // enumeración ni selección. Reactivar cuando exista la pantalla.
  test.skip("selector de conjunto", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, "admin@santamaria.co", "Demo1234*");
    await capture(page, "/admin", "multiconjunto-selector.png");
  });

  // Las dos marcas: MISMO encuadre, distinto conjunto. Si cambia la pantalla
  // entre una y otra se pierde la demostración.
  test("tablero con marca A", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await loginAs(page, "admin@santamaria.co", "Demo1234*");
    await capture(page, "/admin", "multiconjunto-marca-a.png");
  });

  test("tablero con marca B", async ({ page }) => {
    // MISMA pantalla que la marca A, otro conjunto. Estuvo apuntando a /guard
    // con la cuenta de portería: eso comparaba dos portales distintos, no dos
    // marcas, y la demostración se perdía.
    await page.setViewportSize({ width: 1200, height: 900 });
    await loginAs(page, "admin@elnogal.co", "Demo1234*");
    await capture(page, "/admin", "multiconjunto-marca-b.png");
  });

  // Confianza: cuatro pantallas 16:9.
  test("importación desde Excel", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAs(page, "admin@elnogal.co", "Demo1234*");
    await capture(page, "/admin/residents", "trust-migracion.png");
  });

  test("registro de auditoría", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAs(page, "admin@elnogal.co", "Demo1234*");
    await capture(page, "/admin/settings", "trust-respaldos.png");
  });

  test("soporte dentro del producto", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAs(page, "admin@elnogal.co", "Demo1234*");
    await capture(page, "/admin/soporte", "trust-soporte.png");
  });

  // `trust-acceso.png` (activación por enlace) NO se automatiza: la pantalla
  // vive detrás de un enlace de un solo uso que caduca, así que reproducirla
  // pide generar una invitación real. Se captura a mano.
});

// ─── Siembra, bajo demanda ───────────────────────────────────────────────────
//
// Las capturas de un producto vacío no sirven: el conjunto demo salía con
// «Sin unidades», cartera 0 y personas 0. Este paso llena el conjunto usando
// el botón «Cargar seed», que el propio producto solo muestra en desarrollo.
//
// NO corre con el resto: escribe datos en un ambiente compartido. Lanzarlo a
// propósito con:
//   npx playwright test tests/capture-product-screenshots.spec.ts --grep "sembrar"
//
// Es aditivo, no destructivo, y va contra staging: comprobar antes que
// `.env.local` no apunte a producción.
test.describe("Siembra", () => {
  test.setTimeout(180_000);

  test("sembrar datos demo del conjunto", async ({ page }) => {
    await loginAs(page, "admin@santamaria.co", "Demo1234*");
    await page.goto("/admin/residents");
    await page.waitForLoadState("load");
    const boton = page.getByRole("button", { name: /Cargar seed/i });
    await expect(boton).toBeVisible({ timeout: 20_000 });
    await boton.click();
    await expect(page.getByRole("button", { name: /Cargar seed/i })).toBeEnabled({
      timeout: 120_000,
    });
    await page.waitForTimeout(3000);
    console.log("✓  seed operativo aplicado");
  });
});
