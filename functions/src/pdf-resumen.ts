import PDFDocument from "pdfkit";

/**
 * Constructor de PDF de texto: un título, un subtítulo y pares etiqueta/valor.
 *
 * **Vivía dentro de `index.ts` con un solo llamador** (el informe mensual de comité). Se sacó aquí
 * al necesitarlo también el adjunto del estado de cuenta de `PRD-V-FLOW-003`: duplicar la
 * fontanería de `pdfkit` para el segundo caso habría dejado dos sitios donde arreglar el mismo
 * defecto de tipografía o de márgenes.
 */
export function buildSummaryPdf(title: string, subtitle: string, rows: [string, string][]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const docpdf = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    docpdf.on("data", (c: Buffer) => chunks.push(c));
    docpdf.on("end", () => resolve(Buffer.concat(chunks)));
    docpdf.on("error", reject);
    docpdf.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a").text(title);
    docpdf.moveDown(0.3);
    docpdf.font("Helvetica").fontSize(11).fillColor("#475569").text(subtitle);
    docpdf.moveDown(1);
    for (const [label, value] of rows) {
      const y = docpdf.y;
      docpdf.font("Helvetica").fontSize(10).fillColor("#475569").text(label, 48, y);
      docpdf.font("Helvetica-Bold").fillColor("#0f172a").text(value, 48, y, { align: "right" });
      docpdf.moveDown(0.4);
    }
    docpdf.end();
  });
}

/**
 * `PRD-V-FLOW-007` entrega 2 — el PDF del informe mensual emitido (`CA13`).
 *
 * **Por qué no basta `buildSummaryPdf`.** Aquél pinta pares etiqueta/valor y ya,
 * que es lo que necesitan el resumen automático y el estado de cuenta. Este
 * documento tiene que llevar **tres cosas más** que el otro no sabe hacer: el
 * logo del conjunto, secciones con su propio desglose, y el **bloque de firmas**.
 * La fontanería de `pdfkit` sí se comparte —márgenes, tipografía y colores son
 * los mismos— para que los dos documentos del producto no se vean distintos.
 */

export type SeccionDelInforme = {
  title: string;
  rows: [string, string][];
  /** Se pinta bajo la sección, en negrita y con una línea encima. */
  total?: [string, string];
};

export type FirmaParaPdf = {
  name: string;
  role: string;
  /** Ya formateada: este módulo no decide cómo se escribe una fecha. */
  signedAt: string;
};

export type InformePdfInput = {
  tenantName: string;
  period: string;
  /** Descargado por el llamador. `undefined` = se pinta sin logo. */
  logo?: Buffer;
  /** Estado del informe, para el sello de la cabecera. */
  statusLabel: string;
  /** Cifras de cabecera: saldo inicial, final, totales. */
  headline: [string, string][];
  sections: SeccionDelInforme[];
  signatures: FirmaParaPdf[];
  /** Pie legal. `RN-12`: constancia, no firma electrónica certificada. */
  footNote: string;
  /** Si el informe está anulado, el motivo va en la cara del documento (`RN-14`). */
  voidNotice?: string;
};

export function buildInformeMensualPdf(input: InformePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 48;
    const right = doc.page.width - 48;

    // ── Cabecera con logo ──
    if (input.logo) {
      try {
        // Alto fijo y ancho libre: un logo apaisado y uno cuadrado tienen que
        // caber los dos sin deformarse, y `fit` conserva la proporción.
        doc.image(input.logo, left, doc.y, { fit: [120, 40] });
        doc.y += 48;
      } catch {
        // **Un logo ilegible no impide emitir.** Este documento cumple una
        // obligación legal cuya sanción es la remoción del administrador;
        // bloquearlo porque un PNG está corrupto sería cambiar un problema
        // cosmético por uno grave. `pdfkit` lanza síncrono al no reconocer el
        // formato, así que se traga aquí y el informe sale sin logo.
        doc.y += 4;
      }
    }

    doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a").text("Informe económico mensual");
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(11).fillColor("#475569")
      .text(`${input.tenantName} · ${input.period} · ${input.statusLabel}`);
    doc.moveDown(0.8);

    if (input.voidNotice) {
      // El anulado se ve ANTES que las cifras, no en una nota al pie: quien abre
      // el papel tiene que saber que no vale antes de leer un número.
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#b91c1c").text(input.voidNotice, { width: right - left });
      doc.moveDown(0.8);
    }

    const par = (label: string, value: string, bold = false) => {
      const y = doc.y;
      doc.font("Helvetica").fontSize(10).fillColor("#475569").text(label, left, y, { width: (right - left) * 0.62 });
      const yLabel = doc.y;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor("#0f172a")
        .text(value, left, y, { align: "right", width: right - left });
      doc.y = Math.max(yLabel, doc.y);
      doc.moveDown(0.25);
    };

    for (const [label, value] of input.headline) par(label, value, true);

    for (const s of input.sections) {
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(s.title, left);
      doc.moveDown(0.3);
      if (s.rows.length === 0) {
        // **Una sección vacía se dice, no se omite** (`RN-09`, `CA8`): un cero
        // calculado significa «no se debe nada» y una sección ausente significa
        // «esto no se mide», y para un consejo son dos cosas distintas.
        doc.font("Helvetica-Oblique").fontSize(10).fillColor("#64748b").text("Sin movimientos en el período.", left);
        doc.moveDown(0.25);
      }
      for (const [label, value] of s.rows) par(label, value);
      if (s.total) {
        doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#cbd5e1").lineWidth(0.5).stroke();
        doc.moveDown(0.25);
        par(s.total[0], s.total[1], true);
      }
    }

    // ── Bloque de firmas ──
    doc.moveDown(1.2);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text("Firmas", left);
    doc.moveDown(0.4);
    if (input.signatures.length === 0) {
      // `CA13` lo pide con estas palabras: «sin firmas, el bloque aparece vacío
      // y NO se omite». Un informe sin firmar tiene que verse sin firmar.
      doc.font("Helvetica-Oblique").fontSize(10).fillColor("#64748b")
        .text("Este informe todavía no ha sido firmado.", left);
      doc.moveDown(0.4);
    }
    for (const f of input.signatures) {
      doc.moveDown(0.8);
      doc.moveTo(left, doc.y).lineTo(left + 220, doc.y).strokeColor("#94a3b8").lineWidth(0.5).stroke();
      doc.moveDown(0.2);
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(f.name, left);
      doc.font("Helvetica").fontSize(9).fillColor("#475569").text(`${f.role} · ${f.signedAt}`, left);
    }

    doc.moveDown(1.2);
    doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(input.footNote, left, doc.y, { width: right - left });

    doc.end();
  });
}
