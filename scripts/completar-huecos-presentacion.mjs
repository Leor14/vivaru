/**
 * Segunda pasada: lo que falló en `sembrar-huecos-presentacion.mjs`.
 *
 * ⚠️ ESCRIBE EN PRODUCCIÓN (solo las autorizaciones de visita).
 *
 * Qué salió mal la primera vez y cómo se corrige:
 *
 *  - **Las autorizaciones no se guardaban.** El formulario exige `startDate`
 *    —«Fecha inicial obligatoria» en `schemas.ts`— y el guion nunca lo
 *    rellenaba. Peor: envolvía cada campo en `.catch(() => {})`, así que el
 *    fallo no se veía y enviaba el formulario incompleto. Aquí los campos van
 *    por `[name="..."]`, que es como los registra react-hook-form, y **sin
 *    catch**: si uno no está, revienta.
 *
 *  - **Las capturas del residente salieron con «Acceso restringido».** El
 *    segundo acceso se hizo con una cuenta que no es de residente. Ahora se
 *    comprueba el portal ANTES de capturar y se avisa en vez de guardar una
 *    pantalla de error.
 *
 *   node scripts/completar-huecos-presentacion.mjs
 */

import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const DESTINO = "/Users/david/Claude Coworker/Hogaru/Hogaru/Design/capturas-plataforma";
const BASE = "https://www.grupovivaru.com";
const ESPERA_LOGIN = 10 * 60 * 1000;

/** Fechas relativas al día de ejecución: una vigencia que esté viva al capturar. */
const hoy = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const masDias = (n) => new Date(hoy.getTime() + n * 86400000);

/**
 * Solo los campos que el formulario pinta para una autorización PUNTUAL, que es
 * el tipo por defecto. `endDate` y `endTime` existen en el esquema pero son
 * opcionales y no se renderizan aquí: intentar rellenarlos agotaba la espera.
 *
 * Y la fecha es MAÑANA, no hoy: `visitorSchema` tiene un `superRefine` con
 * «Debes seleccionar una hora futura», así que hoy a las 09:00 lo rechaza si
 * ya pasaron las nueve.
 */
const VISITAS = [
  {
    visitorName: "Camila Restrepo Ortiz",
    visitorDocument: "1010203040",
    startDate: iso(masDias(1)),
    startTime: "10:00",
    notes: "Visita familiar",
  },
  {
    visitorName: "Andrés Villamil Soto",
    visitorDocument: "1020304050",
    startDate: iso(masDias(2)),
    startTime: "15:00",
    notes: "Entrega de domicilio",
  },
];

const aviso = (t) => console.log(`\n${"─".repeat(64)}\n${t}\n${"─".repeat(64)}\n`);

async function esperarContenido(page) {
  await page.waitForLoadState("load");
  await page
    .waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, null, { timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
}

async function entrarAMano(page, quien) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  aviso(
    `TE TOCA: entra como ${quien}.\n\n` +
      `Sigo solo cuando la URL deje de ser /login. No escribo ni leo las claves.`
  );
  for (let t = 0; t < ESPERA_LOGIN; t += 500) {
    if (!new URL(page.url()).pathname.startsWith("/login")) break;
    await page.waitForTimeout(500);
  }
  if (new URL(page.url()).pathname.startsWith("/login")) throw new Error("no se inició sesión");
  await page.waitForTimeout(1500);
  console.log(`✓ sesión iniciada — el producto llevó a ${new URL(page.url()).pathname}`);
}

async function foto(page, archivo) {
  // Guardar una pantalla de error como si fuera material comercial es peor que
  // no guardar nada: se cuela en el deck sin que nadie lo mire.
  if (await page.getByText(/Acceso restringido|No tienes permisos/i).count()) {
    console.warn(`  ✗ ${archivo}: la sesión no tiene permiso para esta pantalla — NO la guardo`);
    return false;
  }
  await page.addStyleTag({ content: "[data-env-banner],nextjs-portal{display:none !important}" });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  fs.writeFileSync(path.join(DESTINO, archivo), await page.screenshot());
  console.log(`  ✓ ${archivo}`);
  return true;
}

const navegador = await chromium.launch({ headless: false, slowMo: 60 });

try {
  // ══ 1 · administración: autorizaciones ══════════════════════════════════
  const ctxA = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: "es-CO",
  });
  const admin = await ctxA.newPage();
  await entrarAMano(admin, "ADMINISTRADOR de Las Playas");

  // Comprobar de paso si los documentos de la pasada anterior sí entraron.
  await admin.goto(`${BASE}/admin/documents`, { waitUntil: "load" });
  await esperarContenido(admin);
  const textoDocs = await admin.evaluate(() => document.body.innerText);
  console.log(
    `  documentos de la pasada anterior: ${/Reglamento interno/i.test(textoDocs) ? "SÍ están" : "NO aparecen"}`
  );

  console.log("→ creando autorizaciones de visita");
  for (const v of VISITAS) {
    await admin.goto(`${BASE}/admin/visitors`, { waitUntil: "load" });
    await esperarContenido(admin);
    await admin.getByRole("button", { name: "Crear autorización" }).first().click();
    await admin.waitForTimeout(1500);

    for (const [campo, valor] of Object.entries(v)) {
      const c = admin.locator(`[name="${campo}"]`).first();
      if (!(await c.count())) {
        console.warn(`    · el formulario no pinta «${campo}»; lo salto`);
        continue;
      }
      await c.fill(valor, { timeout: 8000 });
    }

    await admin.getByRole("button", { name: /^Guardar|^Crear/ }).last().click();
    await admin.waitForTimeout(3000);

    // Si la validación se queja, quiero LEER el motivo, no adivinarlo mirando
    // una lista vacía tres pasos después.
    const errores = await admin
      .locator('[class*="danger"], [role="alert"]')
      .allTextContents()
      .catch(() => []);
    const visibles = errores.map((t) => t.trim()).filter(Boolean).slice(0, 3);
    if (visibles.length) console.warn(`    · validación: ${visibles.join(" | ")}`);

    await admin.goto(`${BASE}/admin/visitors`, { waitUntil: "load" });
    await esperarContenido(admin);
    const guardada = await admin.getByText(v.visitorName.split(" ")[0]).count();
    console.log(`  ${guardada ? "+" : "✗"} ${v.visitorName}${guardada ? "" : " — NO se guardó"}`);
  }

  await admin.goto(`${BASE}/admin/visitors`, { waitUntil: "load" });
  await esperarContenido(admin);
  await foto(admin, "admin-07-visitantes.png");
  await ctxA.close();

  // ══ 2 · residente: solo capturas ════════════════════════════════════════
  const ctxR = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: "es-CO",
  });
  const res = await ctxR.newPage();
  await entrarAMano(
    res,
    "RESIDENTE de T1-101  ⚠️ NO la cuenta de administrador: la vez anterior se entró con esa y las tres capturas salieron con «Acceso restringido»"
  );

  const ruta = new URL(res.url()).pathname;
  if (!ruta.startsWith("/resident")) {
    console.warn(
      `\n⚠️  El producto llevó a ${ruta}, no a /resident: esa cuenta NO es de residente.\n` +
        `   No capturo nada para no guardar pantallas de error.\n`
    );
  } else {
    for (const [r, archivo] of [
      ["/resident/services", "residente-07-servicios-comunitarios.png"],
      ["/resident/documents", "residente-08-documentos.png"],
      ["/resident/visitors", "residente-04-visitantes.png"],
    ]) {
      await res.goto(`${BASE}${r}`, { waitUntil: "load" });
      await esperarContenido(res);
      await foto(res, archivo);
    }
  }
  await ctxR.close();
} finally {
  await navegador.close();
}

console.log("\nlisto");
