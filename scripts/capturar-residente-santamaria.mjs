/**
 * Capturas del portal del residente de **Santa María** (producción), con
 * énfasis en el flujo de reservas.
 *
 * Van a una subcarpeta propia: las 28 que ya están en `capturas-plataforma/`
 * son de Las Playas y no se tocan. Mezclar dos conjuntos en la misma carpeta,
 * con los mismos nombres, es la forma más rápida de que alguien monte en el
 * deck una diapositiva del conjunto equivocado.
 *
 * No escribe nada: solo mira y fotografía.
 *
 * El acceso lo hace una persona: el navegador se abre a la vista, el guion se
 * detiene y espera. Nunca ve la contraseña.
 *
 *   node scripts/capturar-residente-santamaria.mjs
 */

import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const DESTINO =
  "/Users/david/Claude Coworker/Hogaru/Hogaru/Design/capturas-plataforma/residente-santa-maria";
const BASE = "https://www.grupovivaru.com";
const ESPERA_LOGIN = 10 * 60 * 1000;

const aviso = (t) => console.log(`\n${"─".repeat(64)}\n${t}\n${"─".repeat(64)}\n`);

async function esperarContenido(page) {
  await page.waitForLoadState("load");
  await page
    .waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, null, { timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
}

async function foto(page, archivo) {
  // Una pantalla de «Acceso restringido» guardada como material comercial se
  // cuela en el deck sin que nadie la mire. Mejor no guardarla.
  if (await page.getByText(/Acceso restringido|No tienes permisos/i).count()) {
    console.warn(`  ✗ ${archivo}: la sesión no tiene permiso aquí — NO la guardo`);
    return;
  }
  await page.addStyleTag({ content: "[data-env-banner],nextjs-portal{display:none !important}" });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  fs.writeFileSync(path.join(DESTINO, archivo), await page.screenshot());
  console.log(`  ✓ ${archivo}`);
}

fs.mkdirSync(DESTINO, { recursive: true });

const navegador = await chromium.launch({ headless: false, slowMo: 50 });
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: "es-CO",
});
const page = await contexto.newPage();

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  aviso(
    "TE TOCA: entra como RESIDENTE de SANTA MARÍA.\n\n" +
      "⚠️ Que NO sea una cuenta de administrador ni de portería: el portal del\n" +
      "   residente las rechaza y saldrían pantallas de «Acceso restringido».\n\n" +
      "Sigo solo cuando la URL deje de ser /login. No escribo ni leo las claves."
  );
  for (let t = 0; t < ESPERA_LOGIN; t += 500) {
    if (!new URL(page.url()).pathname.startsWith("/login")) break;
    await page.waitForTimeout(500);
  }
  const ruta = new URL(page.url()).pathname;
  if (ruta.startsWith("/login")) throw new Error("no se inició sesión");
  if (!ruta.startsWith("/resident")) {
    throw new Error(`el producto llevó a ${ruta}: esa cuenta no es de residente`);
  }
  await page.waitForTimeout(1500);

  // Comprobar de qué conjunto es la sesión ANTES de capturar nada: la carpeta
  // dice «santa-maria» y si dentro hubiera otro conjunto nadie lo notaría.
  const conjunto = await page
    .evaluate(() => document.body.innerText.match(/Conjunto[^\n]{0,40}/)?.[0] ?? "no leído")
    .catch(() => "no leído");
  console.log(`✓ sesión de residente · ${conjunto}`);
  if (!/santa\s*mar/i.test(conjunto)) {
    console.warn(
      `\n⚠️  Esto NO parece Santa María sino «${conjunto}».\n` +
        `   Sigo capturando, pero revisa antes de meterlo en el deck.\n`
    );
  }

  // ── Recorrido base del portal ─────────────────────────────────────────────
  for (const [ruta_, archivo] of [
    ["/resident", "sm-residente-01-inicio.png"],
    ["/resident/account", "sm-residente-02-estado-de-cuenta.png"],
    ["/resident/visitors", "sm-residente-03-visitantes.png"],
    ["/resident/packages", "sm-residente-04-paquetes.png"],
    ["/resident/pqrs", "sm-residente-05-pqrs.png"],
    ["/resident/communications", "sm-residente-06-comunicaciones.png"],
    ["/resident/services", "sm-residente-07-servicios.png"],
    ["/resident/documents", "sm-residente-08-documentos.png"],
  ]) {
    await page.goto(`${BASE}${ruta_}`, { waitUntil: "load" });
    await esperarContenido(page);
    await foto(page, archivo);
  }

  // ── Reservas, con más detalle ─────────────────────────────────────────────
  console.log("→ flujo de reservas");
  await page.goto(`${BASE}/resident/reservations`, { waitUntil: "load" });
  await esperarContenido(page);
  await foto(page, "sm-reservas-01-calendario.png");

  // Un día disponible del calendario: el resumen de la fecha y las franjas solo
  // aparecen tras elegir uno, y esa es la pantalla que enseña que el producto
  // sabe qué está libre.
  const dias = page.locator('button:not([disabled])').filter({ hasText: /^\d{1,2}$/ });
  const total = await dias.count();
  if (total) {
    await dias.nth(Math.min(total - 1, Math.floor(total / 2))).click();
    await page.waitForTimeout(2200);
    await foto(page, "sm-reservas-02-dia-seleccionado.png");

    // Ya con día elegido, el formulario de franja horaria queda a la vista.
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(900);
    await foto(page, "sm-reservas-03-franja-horaria.png");
  } else {
    console.warn("  · no encontré días seleccionables en el calendario");
  }

  // «Mis reservas» — el listado del residente.
  await page.goto(`${BASE}/resident/reservations`, { waitUntil: "load" });
  await esperarContenido(page);
  await page.evaluate(() => {
    const h = [...document.querySelectorAll("*")].find((n) =>
      /^Mis reservas$/i.test(n.textContent?.trim() ?? "")
    );
    h?.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(1200);
  await foto(page, "sm-reservas-04-mis-reservas.png");

  // La pestaña de mudanza, que es un flujo distinto y suele quedar fuera.
  const mudanza = page.getByText("Mudanza", { exact: true }).first();
  if (await mudanza.count()) {
    await mudanza.click();
    await page.waitForTimeout(2000);
    await foto(page, "sm-reservas-05-mudanza.png");
  } else {
    console.warn("  · no encontré la pestaña «Mudanza»");
  }
} finally {
  await navegador.close();
}

console.log(`\nlisto · ${DESTINO}`);
