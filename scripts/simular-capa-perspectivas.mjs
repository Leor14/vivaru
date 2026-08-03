/**
 * Simula la capa de fondo de «Una plataforma, cuatro experiencias» y MIDE.
 *
 * Existe porque el contraste de texto blanco sobre una foto no se decide
 * mirando la foto: se decide mirando la foto YA compuesta con su color base, su
 * tinte y su degradado. Aquí se apila exactamente lo que llevará el navegador y
 * se mide la luminancia real en la franja donde cae el texto.
 *
 * Saca dos cosas por perfil: el PNG compuesto, para verlo, y el contraste
 * mínimo contra blanco en la zona de texto.
 *
 *   node scripts/simular-capa-perspectivas.mjs
 */

import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGEN = "/Users/david/Vivaru_Rep/vivaru-landing/imagenes langing";
const SALIDA = path.join(RAIZ, ".simulacion-perspectivas");

// Tamaño de la banda en una pantalla grande.
const ANCHO = 1920;
const ALTO = 900;

/**
 * La franja donde cae el texto, en fracción del ancho del viewport.
 *
 * NO es 0–42 %. La columna ocupa el 42 % del `container`, que está centrado con
 * un máximo de 1280 px: en un viewport de 1920 el contenedor va de 320 a 1600,
 * así que el texto cae entre el 17 % y el 45 % de la PANTALLA. Medir de 0 a 42 %
 * mediría bordes donde no hay letras y daría un falso aprobado.
 */
const TEXTO = { desde: 0.17, hasta: 0.45, arriba: 0.18, abajo: 0.86 };

/**
 * `opacidad` NO es igual para los cuatro, y ese es el punto.
 *
 * Con un 0,55 uniforme, la luminancia media de la mitad derecha iba de 0,0065
 * en portería a 0,0142 en residente: más del doble. Al cambiar de pestaña eso
 * se siente como si subieran y bajaran las luces de la sala. Estos valores
 * salen de igualar esa luminancia, no de mirar y decidir.
 */
const PERFILES = [
  { key: "admin", archivo: "Admin — azul petróleo.jpg", base: "#04121C", tinte: "#0B3C5D", opacidad: 0.65 },
  { key: "residente", archivo: "Residente — verde bosqu.png", base: "#04160D", tinte: "#1A7A45", opacidad: 0.43 },
  { key: "porteria", archivo: "Portería — ciruela.jpg", base: "#12061D", tinte: "#3D1460", opacidad: 0.85 },
  { key: "comite", archivo: "Comité — índigo.jpg", base: "#0A0D22", tinte: "#4B5FD4", opacidad: 0.43 },
];
/** Opacidad del tinte del perfil. */
const OPACIDAD_TINTE = 0.34;

const aHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Luminancia relativa según WCAG. */
function luminancia([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

const contrasteConBlanco = (rgb) => 1.05 / (luminancia(rgb) + 0.05);

/** Capa lisa de un color con una opacidad. */
function capa(hex, alpha, ancho = ANCHO, alto = ALTO) {
  const [r, g, b] = aHex(hex);
  return sharp({
    create: { width: ancho, height: alto, channels: 4, background: { r, g, b, alpha } },
  })
    .png()
    .toBuffer();
}

/**
 * El degradado direccional: la garantía de contraste.
 *
 * La meseta alta llega al 48 % porque ahí termina la columna de texto. Si se
 * acorta, el final de las líneas largas cae en la zona clara y deja de cumplir.
 */
function degradado(hex) {
  const [r, g, b] = aHex(hex);
  const c = (a) => `rgba(${r},${g},${b},${a})`;
  const svg = `<svg width="${ANCHO}" height="${ALTO}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="0.16">
        <stop offset="0%"   stop-color="${c(0.93)}"/>
        <stop offset="48%"  stop-color="${c(0.86)}"/>
        <stop offset="70%"  stop-color="${c(0.42)}"/>
        <stop offset="100%" stop-color="${c(0.2)}"/>
      </linearGradient>
    </defs>
    <rect width="${ANCHO}" height="${ALTO}" fill="url(#g)"/>
  </svg>`;
  return Buffer.from(svg);
}

fs.mkdirSync(SALIDA, { recursive: true });

console.log(
  `zona medida: ${Math.round(TEXTO.desde * 100)}–${Math.round(TEXTO.hasta * 100)}% del ancho\n`
);

for (const p of PERFILES) {
  const origen = path.join(ORIGEN, p.archivo);
  if (!fs.existsSync(origen)) {
    console.error(`✗ falta ${p.archivo}`);
    continue;
  }

  const foto = await sharp(origen).resize(ANCHO, ALTO, { fit: "cover" }).png().toBuffer();

  const compuesta = await sharp({
    create: {
      width: ANCHO,
      height: ALTO,
      channels: 4,
      background: { ...Object.fromEntries(["r", "g", "b"].map((k, i) => [k, aHex(p.base)[i]])), alpha: 1 },
    },
  })
    .composite([
      { input: await sharp(foto).ensureAlpha(p.opacidad).png().toBuffer(), blend: "over" },
      { input: await capa(p.tinte, OPACIDAD_TINTE), blend: "over" },
      { input: degradado(p.base), blend: "over" },
    ])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(SALIDA, `${p.key}.png`), compuesta);

  // Se mide en columnas estrechas y se guarda la PEOR, no la media: un solo
  // punto claro bajo una línea de texto ya la vuelve ilegible, y promediar toda
  // la franja lo escondería.
  let peor = Infinity;
  let dondePeor = 0;
  const pasos = 14;
  const x0 = Math.round(TEXTO.desde * ANCHO);
  const ancho = Math.round((TEXTO.hasta - TEXTO.desde) * ANCHO);
  const y0 = Math.round(TEXTO.arriba * ALTO);
  const alto = Math.round((TEXTO.abajo - TEXTO.arriba) * ALTO);

  for (let i = 0; i < pasos; i++) {
    const cw = Math.floor(ancho / pasos);
    // `stats()` mide la ENTRADA, no el pipeline: hay que materializar el
    // recorte antes, o cada franja devuelve el valor de la imagen completa.
    const recorte = await sharp(compuesta)
      .extract({ left: x0 + i * cw, top: y0, width: cw, height: alto })
      .toBuffer();
    const franja = await sharp(recorte).stats();
    const rgb = franja.channels.slice(0, 3).map((c) => c.mean);
    const cr = contrasteConBlanco(rgb);
    if (cr < peor) {
      peor = cr;
      dondePeor = Math.round(((x0 + i * cw) / ANCHO) * 100);
    }
  }

  const veredicto = peor >= 7 ? "AAA ✅" : peor >= 4.5 ? "AA ✅" : "INSUFICIENTE ❌";
  console.log(
    `${p.key.padEnd(10)} peor contraste ${peor.toFixed(1)}:1  (al ${dondePeor}% del ancho)  ${veredicto}`
  );
}

console.log(`\ncompuestas en ${SALIDA}`);
