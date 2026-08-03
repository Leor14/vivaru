/**
 * Dos cosas en un solo inicio de sesión, para no hacerte entrar dos veces:
 *
 *  1. Diagnostica el fallo de `/resident/reservations` en producción. La
 *     captura de Las Playas salió con «Algo salió mal», que es el boundary de
 *     `src/app/error.tsx`: la ruta entera se cayó. Aquí se recogen el error de
 *     página, la consola y las peticiones fallidas para saber POR QUÉ, en vez
 *     de adivinar leyendo 1474 líneas.
 *
 *  2. Vuelve a capturar `/resident/visitors` con el formulario de «Crear
 *     invitación» abierto. La primera pasada lo pilló en su estado vacío
 *     («Aún no tienes invitaciones»), que no es lo que promete el texto de la
 *     sección ni sirve para vender.
 *
 * Mismo trato con las credenciales que `capturar-produccion.mjs`: el navegador
 * se abre a la vista, tú escribes, el guion nunca ve ni guarda la contraseña.
 *
 *   node scripts/diagnosticar-reservas-residente.mjs
 */

import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = path.join(RAIZ, "public", "product");
const BASE = "https://www.grupovivaru.com";
const ESPERA_LOGIN = 10 * 60 * 1000;

const aviso = (t) => console.log(`\n${"─".repeat(64)}\n${t}\n${"─".repeat(64)}\n`);

const navegador = await chromium.launch({ headless: false, slowMo: 40 });
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: "es-CO",
});
const page = await contexto.newPage();

// ── Recolectores ─────────────────────────────────────────────────────────────
const erroresDePagina = [];
const consola = [];
const peticionesFallidas = [];
const respuestasFeas = [];

page.on("pageerror", (e) => {
  erroresDePagina.push({ mensaje: e.message, pila: (e.stack || "").split("\n").slice(0, 12) });
});
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") {
    consola.push(`[${m.type()}] ${m.text()}`.slice(0, 500));
  }
});
page.on("requestfailed", (r) => {
  peticionesFallidas.push(`${r.method()} ${r.url().slice(0, 160)} — ${r.failure()?.errorText}`);
});
page.on("response", (r) => {
  if (r.status() >= 400) respuestasFeas.push(`${r.status()} ${r.url().slice(0, 160)}`);
});

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  aviso(
    `TE TOCA: entra como el RESIDENTE de Las Playas (el mismo de antes).\n` +
      `Escribe correo y contraseña en la ventana de Chromium y pulsa «Ingresar».\n\n` +
      `Sigo solo en cuanto vea que la sesión arrancó.`
  );
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: ESPERA_LOGIN });
  console.log("✓  sesión iniciada\n");

  // ── 1. El fallo de reservas ────────────────────────────────────────────────
  // A partir de aquí solo interesa lo que pase en esta ruta.
  erroresDePagina.length = 0;
  consola.length = 0;
  peticionesFallidas.length = 0;
  respuestasFeas.length = 0;

  console.log("→ abriendo /resident/reservations …");
  await page.goto(`${BASE}/resident/reservations`, { waitUntil: "load" });
  await page.waitForTimeout(7000);

  const seCayo = await page.getByText(/Algo salió mal/i).count().then((n) => n > 0);
  console.log(`   ¿se cayó la ruta?  ${seCayo ? "SÍ" : "no"}\n`);

  const informe = {
    seCayo,
    url: page.url(),
    erroresDePagina,
    consola: consola.slice(0, 40),
    peticionesFallidas: peticionesFallidas.slice(0, 20),
    respuestasFeas: respuestasFeas.slice(0, 20),
  };
  const destinoInforme = path.join(RAIZ, "diagnostico-reservas.json");
  fs.writeFileSync(destinoInforme, JSON.stringify(informe, null, 2));

  console.log("── ERRORES DE PÁGINA ──");
  console.log(erroresDePagina.length ? JSON.stringify(erroresDePagina, null, 2) : "  (ninguno)");
  console.log("\n── CONSOLA ──");
  console.log(consola.length ? consola.join("\n") : "  (limpia)");
  console.log("\n── PETICIONES FALLIDAS ──");
  console.log(peticionesFallidas.length ? peticionesFallidas.join("\n") : "  (ninguna)");
  console.log("\n── RESPUESTAS >= 400 ──");
  console.log(respuestasFeas.length ? respuestasFeas.join("\n") : "  (ninguna)");
  console.log(`\n   informe completo en ${destinoInforme}\n`);

  // ── 2. La captura que faltaba ──────────────────────────────────────────────
  console.log("→ abriendo /resident/visitors para el formulario …");
  await page.goto(`${BASE}/resident/visitors`, { waitUntil: "load" });
  await page.waitForTimeout(3500);

  // «Crear invitación» sale dos veces (cabecera y estado vacío). La primera es
  // la de la tarjeta de arriba y es la que deja la pantalla mejor encuadrada.
  const abrir = page.getByRole("button", { name: /Crear invitación/i }).first();
  if (await abrir.count()) {
    await abrir.click();
    await page.waitForTimeout(2500);
  } else {
    console.warn("⚠  no encontré el botón «Crear invitación»; guardo la pantalla tal cual");
  }
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);

  fs.writeFileSync(
    path.join(SALIDA, "perspectives-resident-visitor.png"),
    await page.screenshot()
  );
  console.log("✓  perspectives-resident-visitor.png (con el formulario abierto)");

  aviso("Listo. No hace falta que hagas nada más.");
} finally {
  await navegador.close();
}
