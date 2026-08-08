/**
 * Segunda pasada sobre tres capturas del deck que salieron pobres **por el
 * filtro, no por falta de datos**.
 *
 * Las tres enseñaban ceros con datos detrás:
 *
 *  - Panel de control: «% recaudo 0,0 % · Sin actividad», porque el período
 *    arranca en «Hoy» y hoy nadie ha pagado. En «Este mes» o «Mes pasado» hay
 *    número real.
 *  - Reporte de comité: «Recaudo del 0 % de lo facturado». El 87 % vive en el
 *    trimestre marzo–junio, no en el mes en curso.
 *  - Libro y fondos: abre con una alerta roja de fondo insuficiente. Los
 *    asientos —que son la prueba— están más abajo.
 *
 * Antes de escribir un solo dato en producción hay que agotar esto: cambiar el
 * filtro no toca la base y arregla la mitad de los huecos.
 *
 * No escribe credenciales: abre el navegador y espera a que una persona entre.
 *
 *   node scripts/afinar-capturas-presentacion.mjs [carpeta-destino]
 */

import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const DESTINO =
  process.argv.slice(2).find((a) => !a.startsWith("--")) ??
  "/Users/david/Claude Coworker/Hogaru/Hogaru/Design/capturas-plataforma";

const BASE = "https://www.grupovivaru.com";
const ESPERA_LOGIN = 10 * 60 * 1000;

const aviso = (t) => console.log(`\n${"─".repeat(64)}\n${t}\n${"─".repeat(64)}\n`);

async function esperarContenido(page) {
  await page.waitForLoadState("load");
  await page
    .waitForFunction(() => document.querySelectorAll(".animate-pulse").length === 0, null, {
      timeout: 15_000,
    })
    .catch(() => {});
  await page.waitForTimeout(1200);
}

/** Pulsa el primer control que coincida y devuelve si lo encontró. */
async function pulsar(page, nombre) {
  const b = page.getByRole("button", { name: nombre, exact: true }).first();
  if (await b.count()) {
    await b.click();
    await page.waitForTimeout(2200);
    return true;
  }
  const t = page.getByText(nombre, { exact: true }).first();
  if (await t.count()) {
    await t.click();
    await page.waitForTimeout(2200);
    return true;
  }
  return false;
}

/** Lee el texto de la tarjeta que contiene una etiqueta, para decidir a ojo. */
async function leer(page, etiqueta) {
  return page
    .evaluate((e) => {
      const nodo = [...document.querySelectorAll("*")].find(
        (n) => n.children.length === 0 && n.textContent.trim() === e
      );
      return nodo?.parentElement?.parentElement?.innerText.replace(/\s+/g, " ").slice(0, 90) ?? "no encontrado";
    }, etiqueta)
    .catch(() => "error");
}

async function foto(page, archivo) {
  await page.addStyleTag({ content: "[data-env-banner],nextjs-portal{display:none !important}" });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  fs.writeFileSync(path.join(DESTINO, archivo), await page.screenshot());
  console.log(`  ✓ ${archivo}`);
}

const navegador = await chromium.launch({ headless: false, slowMo: 30 });
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: "es-CO",
});
const page = await contexto.newPage();

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  aviso(
    "TE TOCA: entra como ADMINISTRADOR de Las Playas.\n" +
      "Escribe correo y contraseña en la ventana de Chromium.\n\n" +
      "Sigo solo en cuanto la URL deje de ser /login. No escribo ni leo las claves."
  );
  for (let t = 0; t < ESPERA_LOGIN; t += 500) {
    if (!new URL(page.url()).pathname.startsWith("/login")) break;
    await page.waitForTimeout(500);
  }
  if (new URL(page.url()).pathname.startsWith("/login")) throw new Error("no se inició sesión");
  await page.waitForTimeout(1500);
  console.log("✓ sesión iniciada\n");

  // ── 1. Panel de control con período que tenga movimiento ──────────────────
  await page.goto(`${BASE}/admin`, { waitUntil: "load" });
  await esperarContenido(page);
  console.log("panel · «Hoy»       →", await leer(page, "% recaudo"));

  for (const periodo of ["Mes pasado", "Este mes"]) {
    if (!(await pulsar(page, periodo))) continue;
    const v = await leer(page, "% recaudo");
    console.log(`panel · «${periodo}» →`, v);
    if (!/0\.0\s*%/.test(v)) {
      await foto(page, "admin-01-panel-control.png");
      break;
    }
  }

  // ── 2. Reporte de comité con el rango donde vive el recaudo ───────────────
  await page.goto(`${BASE}/admin/reports`, { waitUntil: "load" });
  await esperarContenido(page);
  for (const rango of ["Últimos 3 meses", "Último trimestre", "Mes pasado"]) {
    if (!(await pulsar(page, rango))) continue;
    const txt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    const m = txt.match(/Recaudo del ([\d.,]+)\s*%/);
    console.log(`reporte · «${rango}» → recaudo ${m ? m[1] + " %" : "no leído"}`);
    if (m && parseFloat(m[1].replace(",", ".")) > 0) {
      await foto(page, "admin-09-reporte-comite.png");
      break;
    }
  }

  // ── 3. Libro y fondos, por debajo de la alerta ────────────────────────────
  await page.goto(`${BASE}/admin/finanzas`, { waitUntil: "load" });
  await esperarContenido(page);
  // Rueda de ratón real: quien desplaza aquí es un contenedor interno, así que
  // `window.scrollBy` no mueve nada y `scrollIntoViewIfNeeded` se da por
  // satisfecho con un ancla que ya estaba a la vista.
  await page.mouse.move(800, 450);
  await page.mouse.wheel(0, 620);
  await page.waitForTimeout(1200);
  await foto(page, "admin-10-libro-y-fondos.png");
} finally {
  await navegador.close();
}

console.log(`\nafinadas en ${DESTINO}`);
