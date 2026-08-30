/**
 * `PRD-V-FEAT-004` — PDF del certificado de paz y salvo.
 *
 * **Tercer hermano de `recibo-pdf.ts`**, con el mismo `jspdf` y el mismo import
 * dinámico: §11.3 pide que no haya una segunda forma de hacer PDF.
 *
 * **Este es el documento que sale del sistema.** El estado de cuenta es un
 * resumen informativo y lo dice; este acredita. Por eso lleva el código
 * verificable, la fecha a la que aplica **dicha en el cuerpo y no al pie**, y —si
 * está anulado— la palabra ANULADO en la cara, no en una nota. La lección viene
 * del recibo: el 20 de agosto de 2026 un PDF anulado seguía diciendo al pie
 * «conserve este comprobante como soporte de su pago», y ese papel se guarda y
 * se saca meses después creyendo que vale.
 */

export type CertificadoParaPdf = {
  code: string;
  unidad: string;
  conjunto: string;
  /** `YYYY-MM-DD` · la fecha a la que acredita. */
  asOfDate: string;
  issuedAt: string;
  /** Saldo a favor, si lo había (R4). */
  creditBalance?: number;
  anulado?: boolean;
  anuladoMotivo?: string;
};

/**
 * El título viene del vocabulario del país del conjunto (decidido el 30 ago
 * 2026): CERTIFICADO DE PAZ Y SALVO en Colombia, CONSTANCIA DE NO ADEUDO en
 * México, CERTIFICADO DE EXPENSAS en Ecuador. El cuerpo es neutro a propósito
 * —«cuotas ordinarias, extraordinarias»— porque esa fórmula está en la ley de
 * los tres países; el país lo dice el encabezado.
 */
export async function renderPazYSalvoPdf(
  cert: CertificadoParaPdf,
  formatMoney: (value: number) => string,
  terminos: { titulo: string },
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const docpdf = new jsPDF({ unit: "pt", format: "a4" });

  const left = 48;
  const right = 548;
  const salto = 18;
  let y = 56;

  docpdf.setFontSize(13);
  docpdf.text(cert.conjunto || "Conjunto residencial", left, y);
  y += salto + 10;

  docpdf.setFontSize(15);
  docpdf.text(terminos.titulo, left, y);
  y += salto;

  docpdf.setFontSize(10);
  docpdf.text(`No. ${cert.code}`, left, y);
  docpdf.text(`Emitido: ${cert.issuedAt}`, 360, y);
  y += salto;

  // Un certificado anulado se puede seguir descargando —es parte del histórico—
  // pero tiene que decirlo en la cara. Mismo criterio que el recibo.
  if (cert.anulado) {
    y += 6;
    docpdf.setFontSize(14);
    docpdf.text("ANULADO", left, y);
    y += salto;
    if (cert.anuladoMotivo) {
      docpdf.setFontSize(9);
      docpdf.text(`Motivo: ${cert.anuladoMotivo}`, left, y);
      y += salto;
    }
    docpdf.setFontSize(10);
  }

  y += 6;
  docpdf.setDrawColor(200);
  docpdf.line(left, y, right, y);
  y += salto + 8;

  // El cuerpo se redacta como una afirmación, porque eso es lo que es. La fecha
  // va DENTRO de la frase: un certificado que la deja en una esquina invita a
  // leerlo como si acreditara para siempre.
  docpdf.setFontSize(11);
  const cuerpo = cert.anulado
    ? `Este documento fue ANULADO y no acredita nada. Se emitió para la unidad ${cert.unidad}.`
    : `Se hace constar que la unidad ${cert.unidad} NO ADEUDA valor alguno por concepto de cuotas ordinarias, extraordinarias ni demás obligaciones de cartera con ${cert.conjunto || "el conjunto"}, con corte al ${cert.asOfDate}.`;
  for (const linea of docpdf.splitTextToSize(cuerpo, right - left) as string[]) {
    docpdf.text(linea, left, y);
    y += salto;
  }

  // R4 · el saldo a favor se nombra en el documento, no se calla.
  if (!cert.anulado && cert.creditBalance && cert.creditBalance > 0) {
    y += 6;
    docpdf.setFontSize(10);
    for (const linea of docpdf.splitTextToSize(
      `A la fecha de corte, la unidad mantiene un saldo a favor de ${formatMoney(cert.creditBalance)}.`,
      right - left,
    ) as string[]) {
      docpdf.text(linea, left, y);
      y += salto;
    }
  }

  y += salto;
  docpdf.setFontSize(9);
  docpdf.setTextColor(120);
  // **Se dice qué NO cubre.** Un paz y salvo que no acota su alcance se lee como
  // si cubriera todo, y este solo habla de cartera: no dice nada de servicios
  // públicos a nombre del propietario ni de obligaciones fuera del conjunto.
  for (const linea of docpdf.splitTextToSize(
    "Este documento se refiere exclusivamente a las obligaciones de cartera registradas en Vivaru para la unidad indicada, y con corte a la fecha señalada. No cubre obligaciones posteriores ni ajenas a la administración del conjunto.",
    right - left,
  ) as string[]) {
    docpdf.text(linea, left, y);
    y += 13;
  }

  y += 8;
  docpdf.text(`Documento generado por Vivaru. Código de verificación: ${cert.code}`, left, y);

  docpdf.save(`paz-y-salvo-${cert.unidad}-${cert.asOfDate}.pdf`);
}
