/**
 * Saca un mosaico de fotogramas de un .webm para poder MIRAR lo que se publica.
 *
 * Existe porque un vídeo en el repo es opaco: no se revisa en un diff, y aquí
 * lleva datos de un conjunto real. Antes de montarlo hay que ver qué sale en
 * pantalla, y para eso hace falta verlo, no confiar en que la grabación hizo
 * lo que se le pidió.
 *
 * Sin ffmpeg —no está instalado— así que el trabajo lo hace el propio
 * navegador: carga el vídeo, salta a N instantes y pinta cada uno en un canvas.
 *
 *   node scripts/revisar-video.mjs [ruta.webm] [columnas] [filas]
 */

import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const video = process.argv[2] ?? path.join(RAIZ, "public/product/multiconjunto-recorrido.webm");
const COLUMNAS = Number(process.argv[3] ?? 3);
const FILAS = Number(process.argv[4] ?? 4);

const navegador = await chromium.launch();
const page = await navegador.newPage({ viewport: { width: 1400, height: 1000 } });

const datos = fs.readFileSync(video).toString("base64");

const mosaico = await page.evaluate(
  async ([b64, columnas, filas]) => {
    const v = document.createElement("video");
    v.src = `data:video/webm;base64,${b64}`;
    v.muted = true;
    await new Promise((ok, mal) => {
      v.onloadedmetadata = ok;
      v.onerror = () => mal(new Error("no pude cargar el vídeo"));
    });

    // Playwright escribe el WebM sin duración en la cabecera, como si fuera una
    // emisión en directo, así que `duration` llega como Infinity y cualquier
    // cálculo sobre ella acaba en «non-finite value». Se obliga al navegador a
    // recorrerlo saltando muy al final; entonces sí la calcula.
    if (!Number.isFinite(v.duration)) {
      await new Promise((ok) => {
        const listo = () => {
          if (Number.isFinite(v.duration)) {
            v.removeEventListener("durationchange", listo);
            v.currentTime = 0;
            ok();
          }
        };
        v.addEventListener("durationchange", listo);
        v.currentTime = 1e6;
      });
    }

    const total = columnas * filas;
    const ancho = 480;
    const alto = Math.round((v.videoHeight / v.videoWidth) * ancho);

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho * columnas;
    lienzo.height = alto * filas;
    const ctx = lienzo.getContext("2d");
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);

    for (let i = 0; i < total; i++) {
      // Repartidos por toda la duración, sin pegarse a los extremos.
      const t = (v.duration * (i + 0.5)) / total;
      await new Promise((ok) => {
        v.onseeked = ok;
        v.currentTime = t;
      });
      const x = (i % columnas) * ancho;
      const y = Math.floor(i / columnas) * alto;
      ctx.drawImage(v, x, y, ancho, alto);
      ctx.fillStyle = "rgba(0,0,0,.75)";
      ctx.fillRect(x, y, 70, 22);
      ctx.fillStyle = "#fff";
      ctx.font = "14px monospace";
      ctx.fillText(`${t.toFixed(1)}s`, x + 6, y + 16);
    }

    return {
      png: lienzo.toDataURL("image/png").split(",")[1],
      duracion: +v.duration.toFixed(1),
      resolucion: `${v.videoWidth}x${v.videoHeight}`,
    };
  },
  [datos, COLUMNAS, FILAS]
);

const destino = path.join(RAIZ, ".mosaico-video.png");
fs.writeFileSync(destino, Buffer.from(mosaico.png, "base64"));
console.log(`${mosaico.duracion}s · ${mosaico.resolucion} · ${COLUMNAS * FILAS} fotogramas`);
console.log(destino);

await navegador.close();
