/**
 * Verifica los fondos de «Una plataforma, cuatro experiencias» en el render
 * REAL, no en la simulación.
 *
 * La simulación (`simular-capa-perspectivas.mjs`) compone las capas a mano con
 * sharp para elegir los parámetros. Esto comprueba que el navegador produce lo
 * mismo: recorre las cuatro pestañas, fotografía la sección y mide la
 * luminancia de los píxeles reales bajo cada bloque de texto.
 *
 * Va con Playwright y no con el panel del navegador porque ese panel sirvió
 * varias veces un render viejo durante esta sesión; aquí el contexto es nuevo y
 * sin caché en cada pasada.
 *
 *   node scripts/verificar-fondos-perspectivas.mjs [url]
 */

import { chromium } from "playwright";
import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = path.join(RAIZ, ".verificacion-perspectivas");
const BASE = process.argv[2] ?? "http://localhost:3000";
const PESTANAS = ["Admin", "Residente", "Portería", "Comité"];

function luminancia([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contraste = (rgb) => 1.05 / (luminancia(rgb) + 0.05);

fs.mkdirSync(SALIDA, { recursive: true });

const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 1920, height: 1080 },
  bypassCSP: true,
});
const page = await contexto.newPage();

try {
  await page.goto(`${BASE}/mx`, { waitUntil: "load" });
  await page.waitForSelector("#perspectivas", { timeout: 30_000 });
  // La sección llega por `dynamic(..., { ssr: false })`: monta, se sustituye y
  // el nodo anterior se desprende. Desplazar por ventana en vez de por el
  // elemento evita el «Element is not attached to the DOM».
  await page.evaluate(() => {
    document.querySelector("#perspectivas")?.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(3000);

  const clases = await page.locator("#perspectivas").getAttribute("class");
  console.log(`sección: ${clases}\n`);

  const luminancias = [];

  for (const nombre of PESTANAS) {
    await page.getByRole("tab", { name: nombre, exact: true }).click();
    // El fondo cruza en 450 ms; se espera al doble para medir ya estabilizado.
    await page.waitForTimeout(1400);

    const caja = await page.locator("#perspectivas").boundingBox();
    const archivo = path.join(SALIDA, `${nombre.toLowerCase()}.png`);
    await page.screenshot({ path: archivo, clip: caja });

    const meta = await sharp(archivo).metadata();

    // Zona de texto: la columna izquierda del contenedor, sin los bordes.
    const zona = {
      left: Math.round(meta.width * 0.17),
      top: Math.round(meta.height * 0.3),
      width: Math.round(meta.width * 0.26),
      height: Math.round(meta.height * 0.5),
    };
    let peor = Infinity;
    for (let i = 0; i < 12; i++) {
      const cw = Math.floor(zona.width / 12);
      // OJO: `stats()` en sharp se calcula sobre la ENTRADA e ignora el
      // pipeline. Sin materializar el recorte a buffer, mide la imagen
      // entera y devuelve el mismo número para cualquier región.
      const recorte = await sharp(archivo)
        .extract({ left: zona.left + i * cw, top: zona.top, width: cw, height: zona.height })
        .toBuffer();
      const st = await sharp(recorte).stats();
      const c = contraste(st.channels.slice(0, 3).map((x) => x.mean));
      if (c < peor) peor = c;
    }

    // Luminancia del FONDO, para comprobar que los cuatro pesan igual.
    //
    // Se mide la banda superior derecha —encima del panel, al lado del titular—
    // y NO la mitad derecha entera: ahí viven las capturas del producto, que son
    // interfaz clara. Midiendo eso, comité salía un 72 % más luminoso que el
    // resto y la culpa era de sus tableros blancos, no del fondo.
    const bandaSuperior = await sharp(archivo)
      .extract({
        left: Math.round(meta.width * 0.55),
        top: Math.round(meta.height * 0.02),
        width: Math.round(meta.width * 0.4),
        height: Math.round(meta.height * 0.13),
      })
      .toBuffer();
    const derecha = await sharp(bandaSuperior).stats();
    const L = luminancia(derecha.channels.slice(0, 3).map((x) => x.mean));
    luminancias.push(L);

    const v = peor >= 7 ? "AAA ✅" : peor >= 4.5 ? "AA ✅" : "INSUFICIENTE ❌";
    console.log(
      `${nombre.padEnd(11)} contraste ${peor.toFixed(1).padStart(5)}:1  ${v}   luminancia imagen ${L.toFixed(4)}`
    );
  }

  const disp = Math.max(...luminancias) / Math.min(...luminancias);
  console.log(`\ndispersión entre perfiles: ${disp.toFixed(2)}x  ${disp <= 1.5 ? "✅" : "⚠️ se notará el cambio de luz"}`);
  console.log(`capturas en ${SALIDA}`);
} finally {
  await navegador.close();
}
