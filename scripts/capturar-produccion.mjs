/**
 * Capturas de PRODUCCIÓN, con inicio de sesión a mano.
 *
 * Va aparte de `tests/capture-product-screenshots.spec.ts` a propósito. Aquel
 * corre contra staging con contraseñas de demo escritas en el propio archivo;
 * esto entra a producción, con datos de un cliente real, y no puede llevar
 * credenciales dentro ni pedirlas por consola.
 *
 * El trato es: el navegador se abre a la vista, el guion se detiene en el
 * login, **la persona escribe correo y contraseña**, y el guion sigue solo en
 * cuanto detecta que la sesión arrancó. Nunca ve la contraseña, no la registra
 * y no la guarda en disco.
 *
 *   node scripts/capturar-produccion.mjs
 *
 * Las imágenes salen a `public/product/` en PNG; después hay que pasarlas por
 * `scripts/optimize-product-images.mjs` como el resto.
 */

import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = path.join(RAIZ, "public", "product");
const BASE = "https://www.grupovivaru.com";

// Diez minutos: es tiempo de persona, no de máquina. Quien esté al teclado
// puede tener que buscar la contraseña en su gestor.
const ESPERA_LOGIN = 10 * 60 * 1000;

const aviso = (t) => console.log(`\n${"─".repeat(64)}\n${t}\n${"─".repeat(64)}\n`);

/**
 * Deja el navegador en el login y espera a que la persona entre.
 *
 * No rellena nada ni lee los campos. Solo mira la URL: cuando deja de estar en
 * `/login`, la sesión ya arrancó.
 */
async function esperarSesion(page, quien) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  aviso(
    `TE TOCA: entra como ${quien} en la ventana de Chromium que se acaba de abrir.\n` +
      `Escribe el correo y la contraseña y pulsa «Ingresar».\n\n` +
      `El guion sigue solo en cuanto detecte la sesión. No escribo yo las claves\n` +
      `ni las leo: solo miro si la URL deja de ser /login.`
  );
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
    timeout: ESPERA_LOGIN,
  });
  console.log(`✓  sesión iniciada como ${quien} → ${page.url()}`);
}

/** Cierra sesión por la interfaz, para que el siguiente login empiece limpio. */
async function cerrarSesion(page) {
  const boton = page.getByRole("button", { name: /Cerrar sesión/i }).first();
  if (await boton.count()) {
    await boton.click().catch(() => {});
    await page.waitForURL((u) => u.pathname.startsWith("/login"), {
      timeout: 30_000,
    }).catch(() => {});
  }
  // Cinturón y tirantes: la sesión de Firebase vive en IndexedDB, así que si el
  // botón no estaba donde se esperaba, se borra el origen entero.
  await page.context().clearCookies();
  await page.evaluate(() => indexedDB.databases?.().then((ds) =>
    ds.forEach((d) => d.name && indexedDB.deleteDatabase(d.name))
  )).catch(() => {});
}

async function preparar(page, ruta) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: "load" });
  // `networkidle` no vale: los escuchas de Firestore no dejan la red quieta.
  await page.waitForTimeout(3500);
  // El ratón abre tooltips de recharts si se queda encima de una barra.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
}

async function foto(page, ruta, archivo, opciones = {}) {
  await preparar(page, ruta);
  const destino = path.join(SALIDA, archivo);
  fs.writeFileSync(destino, await page.screenshot({ ...opciones }));
  console.log(`✓  ${archivo}`);
}

/**
 * Recorta a un elemento con margen, respetando una proporción.
 *
 * Si el selector falla, NO revienta: guarda la pantalla entera y sigue. Aquí ya
 * hay una persona que escribió su contraseña hace un minuto, y perder la sesión
 * por un selector frágil obligaría a repetirlo todo. Se recorta después a mano.
 */
async function fotoDeElemento(page, ruta, selector, archivo, proporcion) {
  await preparar(page, ruta);
  const caja = await page
    .locator(selector)
    .first()
    .boundingBox()
    .catch(() => null);
  if (!caja) {
    console.warn(`⚠  no encontré «${selector}»; guardo la pantalla completa`);
    fs.writeFileSync(path.join(SALIDA, archivo), await page.screenshot());
    console.log(`✓  ${archivo} (sin recortar)`);
    return;
  }
  const ancho = caja.width + 64;
  const alto = proporcion ? ancho / proporcion : caja.height + 64;
  fs.writeFileSync(
    path.join(SALIDA, archivo),
    await page.screenshot({
      clip: {
        x: Math.max(0, caja.x - 32),
        y: Math.max(0, caja.y - (alto - caja.height) / 2),
        width: ancho,
        height: alto,
      },
    })
  );
  console.log(`✓  ${archivo}`);
}

const navegador = await chromium.launch({ headless: false, slowMo: 40 });
const contexto = await navegador.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  locale: "es-CO",
});
const page = await contexto.newPage();

try {
  // ── 1. Administración de Las Playas ────────────────────────────────────────
  await esperarSesion(page, "ADMINISTRADOR de Las Playas");

  const conjunto = await page
    .locator("body")
    .innerText()
    .then((t) => (/playas/i.test(t) ? "Las Playas" : "NO parece Las Playas"));
  console.log(`   conjunto detectado: ${conjunto}`);

  // La gráfica de cartera para el pre-footer. Recortada a 16:9 alrededor de la
  // tarjeta: a pantalla completa entra media barra lateral y el argumento
  // —cobrado contra recaudado— se pierde.
  await fotoDeElemento(
    page,
    "/admin/billing",
    "text=Comportamiento histórico de cartera >> xpath=ancestor::div[contains(@class,'rounded')][1]",
    "pre-footer-cartera.png",
    16 / 9
  );

  await cerrarSesion(page);

  // ── 2. Un residente de Las Playas ──────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 });
  await esperarSesion(page, "RESIDENTE de Las Playas");

  await foto(page, "/resident/account", "perspectives-resident-account.png");
  await foto(page, "/resident/reservations", "perspectives-resident-reservations.png");
  await foto(page, "/resident/visitors", "perspectives-resident-visitor.png");

  aviso("Listo. Ahora: node scripts/optimize-product-images.mjs");
} finally {
  await navegador.close();
}
