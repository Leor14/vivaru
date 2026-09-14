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

/** La huella de un contenido: si no cambia, el archivo tampoco se vuelve a subir. */
export function huellaDe(valor) {
  return createHash("sha256").update(JSON.stringify(valor)).digest("hex").slice(0, 32);
}

/**
 * Sube `contenido` a `ruta` solo si su `huella` es otra que la del archivo que ya está (va en los
 * metadatos del archivo). Conserva el token: la URL guardada en su documento sigue valiendo, y el
 * espejo en Documentos que comparte la ruta cambia con él. Así se reemplazan los archivos delgados
 * de la historia sin mover ninguna URL (plan de documentos, decisión 2).
 *
 * @returns {Promise<{ estado: "igual" | "creado" | "reemplazado" | "crearia" | "reemplazaria", url: string }>}
 */
export async function subirSiCambia(ctx, ruta, contenido, contentType, huella) {
  const archivo = ctx.bucket.file(ruta);
  const token = tokenDe(ruta);
  const url = urlDe(ctx.bucket, ruta, token);
  const [existe] = await archivo.exists();
  if (existe) {
    const [meta] = await archivo.getMetadata();
    if (meta.metadata?.huellaSemilla === huella) return { estado: "igual", url };
  }
  if (!ctx.escribir) return { estado: existe ? "reemplazaria" : "crearia", url };
  await archivo.save(contenido, { contentType, metadata: { metadata: { firebaseStorageDownloadTokens: token, huellaSemilla: huella } } });
  if (!existe) ctx.manifiesto.anotarArchivo(ruta);
  return { estado: existe ? "reemplazado" : "creado", url };
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

// ── El maquetador de documentos con estructura (plan de documentos, T1.1) ─────────────────────

/**
 * Lo que pintan las fuentes estándar de PDF: WinAnsi (Windows-1252). Además de ASCII y Latin-1,
 * estos 27. Todo lo demás sale como basura, y en silencio: un «−» salió como «ˆ» en el informe.
 */
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const EQUIVALENTES = { "−": "-", "≤": "<=", "≥": ">=", "→": "->", "←": "<-", "≈": "~", " ": " ", " ": " " };

/** Los caracteres de `texto` que el PDF no sabe pintar, sin repetir. */
export function fueraDeWinAnsi(texto) {
  const malo = (c) => {
    const n = c.codePointAt(0);
    return !(n === 10 || (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) || WINANSI_EXTRA.includes(c));
  };
  return [...new Set([...String(texto)].filter(malo))];
}

/**
 * El texto listo para el PDF: cambia lo que tiene equivalente y **falla** con lo que no. Fallar es a
 * propósito: un carácter que se pinta mal no se ve hasta que alguien abre el documento.
 */
export function aWinAnsi(texto) {
  const limpio = [...String(texto)].map((c) => EQUIVALENTES[c] ?? c).join("");
  const malos = fueraDeWinAnsi(limpio);
  if (malos.length) {
    const lista = malos.map((c) => `«${c}» U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`).join(", ");
    throw new Error(`Carácter que el PDF no sabe pintar: ${lista}`);
  }
  return limpio;
}

const TINTA = "#1F2A24";
const GRIS = "#55605A";
const ROJO_MARCA = "#B4442F";
const FONDO_CABECERA = "#EEF1EC";
const LINEA = "#C9CFC8";

function pintarTabla(pdf, { columnas, filas, anchos, alinear = [] }, caja) {
  const pesos = anchos ?? columnas.map(() => 1);
  const suma = pesos.reduce((a, b) => a + b, 0);
  const w = pesos.map((p) => (p / suma) * caja.ancho);
  const pad = 5;
  const alto = (celdas, fuente) =>
    Math.max(...celdas.map((c, i) => pdf.font(fuente).fontSize(9.5).heightOfString(aWinAnsi(c), { width: w[i] - 2 * pad }))) + 2 * pad;
  const fila = (celdas, cabecera) => {
    const fuente = cabecera ? "Helvetica-Bold" : "Helvetica";
    const h = alto(celdas, fuente);
    if (pdf.y + h > caja.limite()) {
      pdf.addPage();
      // La cabecera se repite en cada página: una tabla sin columnas no se lee.
      if (!cabecera) fila(columnas, true);
    }
    const y = pdf.y;
    if (cabecera) pdf.rect(caja.izq, y, caja.ancho, h).fill(FONDO_CABECERA);
    let x = caja.izq;
    celdas.forEach((c, i) => {
      pdf.font(fuente).fontSize(9.5).fillColor(TINTA).text(aWinAnsi(c), x + pad, y + pad, { width: w[i] - 2 * pad, align: alinear[i] ?? "left" });
      x += w[i];
    });
    pdf.moveTo(caja.izq, y + h).lineTo(caja.izq + caja.ancho, y + h).lineWidth(0.5).strokeColor(LINEA).stroke();
    pdf.x = caja.izq;
    pdf.y = y + h;
  };
  caja.cabe(60);
  fila(columnas, true);
  for (const f of filas) fila(f.map((c) => String(c)), false);
  pdf.moveDown(0.8);
}

function pintarFirmas(pdf, { firmantes }, caja) {
  const col = (caja.ancho - 32) / 2;
  for (let i = 0; i < firmantes.length; i += 2) {
    const par = firmantes.slice(i, i + 2);
    // Un nombre puede ocupar dos líneas (una razón social): el cargo va debajo del más alto del par.
    pdf.font("Helvetica-Bold").fontSize(9.5);
    const altoNombre = Math.max(...par.map((f) => pdf.heightOfString(aWinAnsi(f.nombre), { width: col })));
    caja.cabe(66 + altoNombre);
    const y = pdf.y + 34;
    par.forEach((f, j) => {
      const x = caja.izq + j * (col + 32);
      pdf.moveTo(x, y).lineTo(x + col, y).lineWidth(0.7).strokeColor(TINTA).stroke();
      pdf.font("Helvetica-Bold").fontSize(9.5).fillColor(TINTA).text(aWinAnsi(f.nombre), x, y + 4, { width: col });
      pdf.font("Helvetica").fontSize(8.5).fillColor(GRIS).text(aWinAnsi(f.cargo), x, y + 6 + altoNombre, { width: col });
    });
    pdf.x = caja.izq;
    pdf.y = y + 24 + altoNombre;
  }
  pdf.moveDown(0.6);
}

/**
 * Un documento con estructura —capítulos, artículos, párrafos, listas, tablas que cruzan de página
 * y firmas—, con encabezado, «Página X de Y» y la marca de demo en cada página.
 *
 * Devuelve también cuántas páginas tiene y cuántas marcas pintó: no hay en el repositorio con qué
 * leer el texto de un PDF, y así una prueba comprueba la marca sin abrirlo. El resto se comprueba
 * mirando el PDF (la memoria «Mirar el artefacto generado»).
 *
 * @param {{ titulo: string, subtitulo?: string, encabezado?: string, fecha?: Date,
 *           bloques: Array<{ tipo: string, [k: string]: unknown }> }} doc
 * @returns {Promise<{ buffer: Buffer, paginas: number, marcas: number }>}
 */
export function documentoEstructurado({ titulo, subtitulo = "", encabezado = "", fecha = new Date(Date.UTC(2026, 4, 29)), bloques = [] }) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "LETTER",
      margins: { top: 72, bottom: 72, left: 64, right: 64 },
      bufferPages: true,
      info: { Title: aWinAnsi(titulo), Author: "Vivaru (demostración)", CreationDate: fecha },
    });
    const partes = [];
    pdf.on("data", (b) => partes.push(b));
    pdf.on("error", reject);
    const izq = pdf.page.margins.left;
    const ancho = pdf.page.width - izq - pdf.page.margins.right;
    const caja = {
      izq,
      ancho,
      limite: () => pdf.page.height - pdf.page.margins.bottom,
      cabe: (h) => { if (pdf.y + h > pdf.page.height - pdf.page.margins.bottom) pdf.addPage(); },
    };

    pdf.font("Helvetica-Bold").fontSize(18).fillColor(TINTA).text(aWinAnsi(titulo), izq, pdf.y, { width: ancho });
    if (subtitulo) pdf.moveDown(0.3).font("Helvetica").fontSize(10.5).fillColor(GRIS).text(aWinAnsi(subtitulo), { width: ancho });
    pdf.moveDown(1.2);

    for (const [i, b] of bloques.entries()) {
      switch (b.tipo) {
        case "capitulo": {
          // Un título no se queda solo al pie: si lo sigue una imagen, tiene que caber con ella.
          const siguiente = bloques[i + 1];
          caja.cabe(70 + (siguiente?.tipo === "imagen" ? (siguiente.alto ?? 300) + 30 : 0));
          pdf.moveDown(0.6).font("Helvetica-Bold").fontSize(12.5).fillColor(TINTA).text(aWinAnsi(b.texto), izq, pdf.y, { width: ancho });
          pdf.moveDown(0.4);
          break;
        }
        case "articulo":
          caja.cabe(40);
          pdf.font("Helvetica-Bold").fontSize(10.5).fillColor(TINTA)
            .text(`${aWinAnsi(b.numero)} `, izq, pdf.y, { width: ancho, align: "justify", continued: true })
            .font("Helvetica").text(aWinAnsi(b.texto), { width: ancho, align: "justify", lineGap: 1.5 });
          pdf.moveDown(0.5);
          break;
        case "parrafo":
          caja.cabe(30);
          pdf.font("Helvetica").fontSize(10.5).fillColor(TINTA).text(aWinAnsi(b.texto), izq, pdf.y, { width: ancho, align: "justify", lineGap: 1.5 });
          pdf.moveDown(0.6);
          break;
        case "lista":
          for (const item of b.items) {
            caja.cabe(20);
            pdf.font("Helvetica").fontSize(10.5).fillColor(TINTA).text(`•  ${aWinAnsi(item)}`, izq + 12, pdf.y, { width: ancho - 12, lineGap: 1.5 });
          }
          pdf.x = izq;
          pdf.moveDown(0.6);
          break;
        case "tabla":
          pintarTabla(pdf, b, caja);
          break;
        case "firmas":
          pintarFirmas(pdf, b, caja);
          break;
        case "salto":
          pdf.addPage();
          break;
        case "imagen": {
          // Una ilustración a lo ancho, con su pie. La huella del documento no lee sus bytes: la
          // describe `clave` (ver `pintarYSubir` en `escritores/documentos.mjs`).
          if (!Buffer.isBuffer(b.buffer)) throw new Error(`La imagen «${b.clave ?? "sin clave"}» del documento «${titulo}» no trae su archivo.`);
          const alto = b.alto ?? 300;
          caja.cabe(alto + (b.pie ? 30 : 12));
          const y = pdf.y;
          pdf.image(b.buffer, izq, y, { fit: [ancho, alto], align: "center", valign: "center" });
          pdf.y = y + alto;
          if (b.pie) pdf.moveDown(0.4).font("Helvetica").fontSize(9).fillColor(GRIS).text(aWinAnsi(b.pie), izq, pdf.y, { width: ancho, align: "center" });
          pdf.x = izq;
          pdf.moveDown(0.8);
          break;
        }
        default:
          throw new Error(`Bloque desconocido en el documento «${titulo}»: ${b.tipo}`);
      }
    }

    const { start, count } = pdf.bufferedPageRange();
    let marcas = 0;
    for (let i = start; i < start + count; i += 1) {
      pdf.switchToPage(i);
      // Sin margen inferior mientras se pinta el pie: si no, pdfkit abre una página nueva.
      const margen = pdf.page.margins.bottom;
      pdf.page.margins.bottom = 0;
      const pie = pdf.page.height - 48;
      if (encabezado) pdf.font("Helvetica").fontSize(8.5).fillColor(GRIS).text(aWinAnsi(encabezado), izq, 38, { width: ancho, lineBreak: false });
      pdf.font("Helvetica-Bold").fontSize(8.5).fillColor(ROJO_MARCA)
        .text("EJEMPLO · DEMO VIVARU · documento generado, no es de ninguna comunidad real", izq, pie, { lineBreak: false });
      pdf.font("Helvetica").fontSize(8.5).fillColor(GRIS).text(`Página ${i - start + 1} de ${count}`, izq, pie, { width: ancho, align: "right", lineBreak: false });
      pdf.page.margins.bottom = margen;
      marcas += 1;
    }
    pdf.on("end", () => resolve({ buffer: Buffer.concat(partes), paginas: count, marcas }));
    pdf.end();
  });
}
