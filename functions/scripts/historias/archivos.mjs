// Archivos de la semilla: imágenes y documentos GENERADOS (nunca un documento real), subidos a
// Storage con token de descarga, igual que `archiveBuffer` (functions/src/index.ts) y
// `sembrar-demo-finanzas.mjs`. La URL que se guarda es la de `getDownloadURL`: host de Storage +
// ruta codificada + token. Contra el emulador, el host es el del emulador.
//
// `sharp` no está en `functions/package.json`: se resuelve desde el `node_modules` de la raíz.

import { createHash } from "node:crypto";

import PDFDocument from "pdfkit";
import sharp from "sharp";

/**
 * Un token (con forma de UUID) estable por texto: la segunda corrida escribe exactamente la misma
 * URL. Sirve también para los UUID que el producto saca de `crypto.randomUUID()`.
 */
export function tokenDe(ruta) {
  const h = createHash("sha256").update(`semilla:${ruta}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function urlDe(bucket, ruta, token) {
  const emulador = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const host = emulador ? `http://${emulador}` : "https://firebasestorage.googleapis.com";
  return `${host}/v0/b/${bucket.name}/o/${encodeURIComponent(ruta)}?alt=media&token=${token}`;
}

/**
 * Sube `contenido` a `ruta` si no está, y devuelve su URL con token. Con `reemplazar`, lo escribe
 * aunque ya esté (el PDF del informe se rehace con cada firma en la misma ruta, como en el producto),
 * conservando el token: la URL guardada en el documento sigue valiendo. En simulación no sube nada.
 */
export async function subir(ctx, ruta, contenido, contentType, { reemplazar = false } = {}) {
  const token = tokenDe(ruta);
  const url = urlDe(ctx.bucket, ruta, token);
  if (!ctx.escribir) {
    ctx.cuenta("storage", "crearia");
    return url;
  }
  const archivo = ctx.bucket.file(ruta);
  const [existe] = await archivo.exists();
  if (existe && !reemplazar) {
    ctx.cuenta("storage", "existe");
    return url;
  }
  await archivo.save(contenido, { contentType, metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
  if (!existe) ctx.manifiesto.anotarArchivo(ruta);
  ctx.cuenta("storage", existe ? "existe" : "creado");
  return url;
}

const escapar = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Una imagen de ejemplo con texto: comprobantes de transferencia y fotos de medidor. Lleva la
 * palabra EJEMPLO a la vista: es de una demo y no debe pasar por un documento real.
 */
export async function imagenDeEjemplo({ titulo, lineas = [], ancho = 720, alto = 960, fondo = "#F7F5EF", tinta = "#1F2A24" }) {
  // Lo que cabe a lo ancho: el primer comprobante generado cortaba «SPEI» y el beneficiario.
  const cabe = (texto, px) => {
    const max = Math.floor((ancho - 96) / (px * 0.56));
    return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
  };
  const filas = lineas
    .map((l, i) => `<text x="48" y="${240 + i * 54}" font-family="Helvetica, Arial, sans-serif" font-size="27" fill="${tinta}">${escapar(cabe(l, 27))}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">
    <rect width="100%" height="100%" fill="${fondo}"/>
    <rect x="24" y="24" width="${ancho - 48}" height="${alto - 48}" fill="none" stroke="${tinta}" stroke-opacity="0.25" stroke-width="3"/>
    <text x="48" y="140" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="bold" fill="${tinta}">${escapar(cabe(titulo, 34))}</text>
    ${filas}
    <text x="${ancho / 2}" y="${alto - 70}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="46" font-weight="bold" fill="#B4442F" fill-opacity="0.55">EJEMPLO · DEMO VIVARU</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 70 }).toBuffer();
}

/**
 * Un PDF de texto (actas, reglamento, pólizas, planos), con la marca de demo en cada página. Las
 * fuentes estándar de PDF solo pintan WinAnsi: nada de «−» ni «≤» en los textos (un menos salió
 * como «ˆ» en el informe mensual; ver la memoria «Mirar el artefacto generado»).
 */
export function documentoPdf({ titulo, subtitulo = "", parrafos = [], pie = "" }) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "LETTER",
      margin: 64,
      bufferPages: true,
      info: { Title: titulo, Author: "Vivaru (demostración)", CreationDate: new Date(Date.UTC(2026, 4, 29)) },
    });
    const partes = [];
    pdf.on("data", (b) => partes.push(b));
    pdf.on("end", () => resolve(Buffer.concat(partes)));
    pdf.on("error", reject);
    pdf.font("Helvetica-Bold").fontSize(17).fillColor("#1F2A24").text(titulo);
    if (subtitulo) pdf.moveDown(0.3).font("Helvetica").fontSize(10.5).fillColor("#55605A").text(subtitulo);
    pdf.moveDown(1.2).font("Helvetica").fontSize(11).fillColor("#1F2A24");
    for (const p of parrafos) pdf.text(p, { align: "justify", lineGap: 2 }).moveDown(0.8);
    if (pie) pdf.moveDown(1).fontSize(9).fillColor("#55605A").text(pie);
    const { start, count } = pdf.bufferedPageRange();
    for (let i = start; i < start + count; i += 1) {
      pdf.switchToPage(i);
      pdf.font("Helvetica-Bold").fontSize(9).fillColor("#B4442F")
        .text("EJEMPLO · DEMO VIVARU · documento generado, no es de ninguna comunidad real", 64, pdf.page.height - 48, { lineBreak: false });
    }
    pdf.end();
  });
}
