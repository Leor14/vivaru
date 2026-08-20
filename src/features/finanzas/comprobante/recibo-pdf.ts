import type { PaymentVoucher } from "@/types/domain";

/**
 * Genera y descarga el PDF de un comprobante/recibo. jspdf se importa de forma
 * dinámica para no incluirlo en el bundle del servidor (usa APIs de navegador).
 */
export async function renderReciboPdf(
  voucher: PaymentVoucher,
  formatMoney: (value: number) => string,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const docpdf = new jsPDF({ unit: "pt", format: "a4" });

  const left = 48;
  let y = 56;
  const lineGap = 18;

  // Un recibo es un recibo en los tres países. Hasta el 20 de agosto de 2026
  // Ecuador llevaba «COMPROBANTE DE PAGO DE ALÍCUOTA», que era el nombre del
  // documento del SRI; al no emitir Vivaru documentos fiscales, ese título
  // prometía algo que el papel no es.
  const title = voucher.type === "ingreso" ? "RECIBO DE PAGO" : "COMPROBANTE DE EGRESO";

  // Emisor
  docpdf.setFontSize(13);
  docpdf.text(voucher.issuerLegalName || "Conjunto residencial", left, y);
  y += lineGap;
  docpdf.setFontSize(9);
  if (voucher.issuerTaxId) {
    docpdf.text(`ID fiscal: ${voucher.issuerTaxId}`, left, y);
    y += 13;
  }
  if (voucher.issuerAddress) {
    docpdf.text(voucher.issuerAddress, left, y);
    y += 13;
  }

  // Título + número
  y += 10;
  docpdf.setFontSize(14);
  docpdf.text(title, left, y);
  y += lineGap;
  docpdf.setFontSize(10);
  docpdf.text(`No. ${voucher.code}`, left, y);
  docpdf.text(`Fecha: ${voucher.issueDate}`, 360, y);
  y += lineGap + 6;

  // Un recibo anulado se puede seguir descargando —es parte del histórico— pero
  // tiene que decirlo en la cara, no en una nota al pie.
  if (voucher.anulado) {
    docpdf.setFontSize(13);
    docpdf.text("ANULADO", left, y);
    docpdf.setFontSize(10);
    y += lineGap;
  }

  // Cuerpo
  docpdf.setDrawColor(200);
  docpdf.line(left, y, 548, y);
  y += lineGap;

  docpdf.setFontSize(10);
  if (voucher.payerName) {
    docpdf.text(`Recibí de: ${voucher.payerName}`, left, y);
    y += lineGap;
  }
  if (voucher.payerUnitLabel) {
    docpdf.text(`Unidad: ${voucher.payerUnitLabel}`, left, y);
    y += lineGap;
  }
  if (voucher.payerTaxId) {
    docpdf.text(`Identificación: ${voucher.payerTaxId}`, left, y);
    y += lineGap;
  }
  docpdf.text(`Concepto: ${voucher.concept}`, left, y);
  y += lineGap + 6;

  docpdf.setFontSize(13);
  docpdf.text(`Valor: ${formatMoney(voucher.amount)}`, left, y);
  y += lineGap + 16;

  docpdf.setFontSize(8);
  docpdf.setTextColor(120);
  docpdf.text(
    "Documento generado por Vivaru. Conserve este comprobante como soporte de su pago.",
    left,
    y,
  );

  docpdf.save(`recibo-${voucher.code}.pdf`);
}
