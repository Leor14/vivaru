"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSummaryPdf = buildSummaryPdf;
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
