/**
 * optimize-product-images.mjs
 *
 * Convierte los PNG de `public/product/` a WebP redimensionado y borra el PNG.
 * Ejecutar después de `npx playwright test tests/capture-product-screenshots.spec.ts`,
 * que deja las capturas en PNG @2x (hasta 2880px de ancho).
 *
 *   npm run images:optimize          # convierte y borra los PNG
 *   npm run images:optimize -- --dry # solo mide, no toca nada
 *
 * ── POR QUÉ ESTE PASO EXISTE ────────────────────────────────────────────────
 * En Firebase App Hosting el optimizador de Next (`/_next/image`) está
 * DESACTIVADO: el adaptador reescribe `next.config.ts` e inyecta
 * `images.unoptimized = true` durante el build. Ver el comentario en
 * `next.config.ts` y `wiki-producto/wiki/decisiones/trampas-conocidas.md`.
 *
 * Consecuencia: lo que hay en `public/` llega al navegador TAL CUAL, byte a
 * byte. No hay red de seguridad que redimensione ni recomprima en runtime, así
 * que el tamaño del archivo en disco es el que paga el visitante.
 *
 * ── POR QUÉ WEBP Y NO PNG/JPEG ──────────────────────────────────────────────
 * Medido sobre estas mismas capturas (dashboard denso, tarjetas con gráficas,
 * pantallas de móvil), reduciendo a los anchos de la tabla de abajo:
 *
 *   PNG cuantizado (libimagequant, q80)  −79 %   ← y con una trampa, ver abajo
 *   WebP q90                             −93 %
 *   AVIF q70                             −95 %
 *
 * - JPEG queda descartado: son capturas de interfaz, con mucho color plano y
 *   bordes duros. `sips -s format jpeg` sobre estos archivos AUMENTA el peso.
 * - PNG cuantizado tiene una trampa medida: en las capturas más planas,
 *   redimensionar ANTES de cuantizar sube el peso (perspectives-comite-tablero
 *   pasó de 112 KB a 136 KB), porque la interpolación inventa colores
 *   intermedios y rompe la paleta. WebP no sufre eso.
 * - AVIF comprime algo más, pero emborrona el texto pequeño de los pantallazos
 *   y decodifica más lento. Para capturas de UI, WebP q90 conserva el texto
 *   nítido, que es justo lo que el landing está vendiendo.
 */

import { createRequire } from "node:module";
import { readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "product");
const DRY = process.argv.includes("--dry");

/** Calidad WebP. Alta a propósito: el texto de las capturas debe leerse. */
const QUALITY = 90;

/**
 * Ancho máximo por familia de captura, en píxeles.
 *
 * El número sale de medir cuánto ocupa la imagen en pantalla (CSS px) y dejar
 * margen para pantallas @2x. El contenedor del landing es `max-width: 1280px`
 * con `padding-inline: 2rem`, así que el ancho útil tope es 1216 px.
 *
 * `withoutEnlargement` protege del error contrario: varias capturas YA son más
 * pequeñas que su tope (porteria a 1024, los móviles a 390) y ampliarlas sería
 * peso puro sin un solo píxel de detalle nuevo.
 */
const ANCHO_MAXIMO = [
  // Hero: columna de 6/12 dentro del contenedor → ~584 CSS px en desktop.
  ["hero-admin-dashboard", 1200],
  // Ranura de 180 CSS px con `sizes="180px"`. El origen ya está a 390.
  ["hero-resident-reservations", 390],
  // Perspectivas, panel de escritorio: ~560 CSS px en desktop, ~976 en el
  // salto de 1024px. 1440 cubre @2.5x el primero y @1.5x el segundo.
  ["perspectives-admin", 1440],
  ["perspectives-comite", 1440],
  // El origen ya está a 1024: no se toca el ancho, solo se recomprime.
  ["perspectives-porteria", 1024],
  // Trío de móviles: ranuras del 30 % y 35,4 % de un bloque de 672 px
  // → 202 y 238 CSS px. 780 da @3x sobrado.
  ["perspectives-resident", 780],
  // Fondos por perfil: banda a ancho completo, pero se ven bajo un velo del
  // 86–93 % en la mitad izquierda. El detalle fino ahí es invisible por
  // definición, así que 1920 y calidad baja no cuestan nada de calidad
  // percibida y sí mucho peso. Van con `blur(0.7)` desde el origen por lo
  // mismo. IMPORTANTE: esta regla va ANTES que la de `perspectives-resident`
  // solo si el prefijo pudiera colisionar; aquí no, pero conviene no renombrar
  // los archivos a algo que empiece por «perspectives-resident».
  ["perspectives-fondo", 1920],
  // Dos tarjetas de marca en subrejilla: ~512 CSS px como mucho.
  ["multiconjunto", 1200],
  // Rejilla de 4 columnas: 304 CSS px en desktop, 592 en móvil a 640px.
  ["trust", 1280],
];

/** Capturas verticales sueltas sin familia propia (hero-resident-home, alt-*). */
const TOPE_VERTICAL = 780;
const TOPE_HORIZONTAL = 1440;

function anchoDestino(nombre, meta) {
  const regla = ANCHO_MAXIMO.find(([prefijo]) => nombre.startsWith(prefijo));
  if (regla) return regla[1];
  return meta.height > meta.width ? TOPE_VERTICAL : TOPE_HORIZONTAL;
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

const pngs = readdirSync(DIR)
  .filter((f) => f.toLowerCase().endsWith(".png"))
  .sort();

if (pngs.length === 0) {
  console.log("No hay PNG en public/product/ — nada que hacer.");
  process.exit(0);
}

let antes = 0;
let despues = 0;

for (const archivo of pngs) {
  const origen = join(DIR, archivo);
  const destino = join(DIR, `${basename(archivo, ".png")}.webp`);

  const pesoOrigen = statSync(origen).size;
  const meta = await sharp(origen).metadata();
  const ancho = anchoDestino(archivo, meta);

  const buffer = await sharp(origen)
    .resize({ width: ancho, withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 6 })
    .toBuffer();

  const metaFinal = await sharp(buffer).metadata();

  antes += pesoOrigen;
  despues += buffer.length;

  const reduccion = ((1 - buffer.length / pesoOrigen) * 100).toFixed(0);
  console.log(
    `${archivo.padEnd(40)} ${String(meta.width).padStart(4)}px ${kb(pesoOrigen).padStart(8)}` +
      `  →  ${String(metaFinal.width).padStart(4)}px ${kb(buffer.length).padStart(8)}  (-${reduccion}%)`,
  );

  if (DRY) continue;

  // `writeFileSync`, NO `sharp(buffer).toFile(destino)`: pasar el buffer otra
  // vez por sharp lo RE-CODIFICA (decodifica el WebP q90 y lo vuelve a
  // comprimir con la calidad por defecto, 80). Dos pérdidas encadenadas y un
  // archivo distinto del que se acaba de medir.
  writeFileSync(destino, buffer);
  // Solo después de escribir el WebP: si algo falla arriba, el PNG sigue ahí.
  unlinkSync(origen);
}

console.log(
  `\n${pngs.length} archivos · ${kb(antes)} → ${kb(despues)} ` +
    `(-${((1 - despues / antes) * 100).toFixed(0)} %)${DRY ? "  [simulacro: no se escribió nada]" : ""}`,
);
