"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSummaryPdf = buildSummaryPdf;
exports.buildInformeMensualPdf = buildInformeMensualPdf;
const pdfkit_1 = __importDefault(require("pdfkit"));
/**
 * Constructor de PDF de texto: un título, un subtítulo y pares etiqueta/valor.
 *
 * **Vivía dentro de `index.ts` con un solo llamador** (el informe mensual de comité). Se sacó aquí
 * al necesitarlo también el adjunto del estado de cuenta de `PRD-V-FLOW-003`: duplicar la
 * fontanería de `pdfkit` para el segundo caso habría dejado dos sitios donde arreglar el mismo
 * defecto de tipografía o de márgenes.
 */
function buildSummaryPdf(title, subtitle, rows) {
    return new Promise((resolve, reject) => {
        const docpdf = new pdfkit_1.default({ size: "A4", margin: 48 });
        const chunks = [];
        docpdf.on("data", (c) => chunks.push(c));
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
function buildInformeMensualPdf(input) {
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({ size: "A4", margin: 48 });
        const chunks = [];
        doc.on("data", (c) => chunks.push(c));
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
            }
            catch {
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
        const par = (label, value, bold = false) => {
            const y = doc.y;
            doc.font("Helvetica").fontSize(10).fillColor("#475569").text(label, left, y, { width: (right - left) * 0.62 });
            const yLabel = doc.y;
            doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor("#0f172a")
                .text(value, left, y, { align: "right", width: right - left });
            doc.y = Math.max(yLabel, doc.y);
            doc.moveDown(0.25);
        };
        for (const [label, value] of input.headline)
            par(label, value, true);
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
            for (const [label, value] of s.rows)
                par(label, value);
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
