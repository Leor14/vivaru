import type { EstadoDeCuenta } from "@/features/billing/estado-de-cuenta";

/**
 * `PRD-V-FEAT-004` — PDF del estado de cuenta de la unidad.
 *
 * **Hermano de `recibo-pdf.ts`, y a propósito.** §11.3 dice «reutiliza el
 * generador de PDF del recibo; no se introduce una segunda forma de hacer PDF»,
 * así que esto usa el mismo `jspdf` con el mismo import dinámico —fuera del
 * bundle del servidor, que no tiene APIs de navegador— y la misma retícula de
 * puntos. Lo que cambia es el contenido, no la técnica.
 *
 * **Este documento NO acredita nada.** Es una foto de la cuenta; el que acredita
 * es el paz y salvo, que lo emite el servidor porque su única condición —saldo
 * cero— no puede comprobarla el cliente. El pie lo dice, para que nadie lo
 * presente ante un tercero como si fuera lo otro.
 */

export type CabeceraEstadoDeCuenta = {
  conjunto: string;
  unidad: string;
  /** Rango pedido, si lo hubo. Ausente = historia completa. */
  desde?: string;
  hasta?: string;
  /** `YYYY-MM-DD`. Se pasa desde fuera: el PDF no decide qué día es hoy. */
  emitidoEl: string;
  /** Saldo a favor de la unidad (`FLOW-002`), si lo hay. */
  saldoAFavor?: number;
};

export async function renderEstadoDeCuentaPdf(
  estado: EstadoDeCuenta,
  cabecera: CabeceraEstadoDeCuenta,
  formatMoney: (value: number) => string,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const docpdf = new jsPDF({ unit: "pt", format: "a4" });

  const left = 48;
  const right = 548;
  const salto = 18;
  let y = 56;

  docpdf.setFontSize(13);
  docpdf.text(cabecera.conjunto || "Conjunto residencial", left, y);
  y += salto;

  docpdf.setFontSize(14);
  docpdf.text("ESTADO DE CUENTA", left, y);
  y += salto;

  docpdf.setFontSize(10);
  docpdf.text(`Unidad: ${cabecera.unidad}`, left, y);
  docpdf.text(`Emitido: ${cabecera.emitidoEl}`, 360, y);
  y += salto;

  docpdf.text(
    cabecera.desde || cabecera.hasta
      ? `Período: ${cabecera.desde ?? "inicio"} a ${cabecera.hasta ?? "hoy"}`
      : "Período: historia completa",
    left,
    y,
  );
  y += salto + 6;

  docpdf.setDrawColor(200);
  docpdf.line(left, y, right, y);
  y += salto;

  // Cabecera de la tabla.
  docpdf.setFontSize(9);
  docpdf.text("Período", left, y);
  docpdf.text("Concepto", left + 70, y);
  docpdf.text("Cargo", 330, y, { align: "right" });
  docpdf.text("Pagado", 410, y, { align: "right" });
  docpdf.text("Saldo", right, y, { align: "right" });
  y += 6;
  docpdf.line(left, y, right, y);
  y += 14;

  docpdf.setFontSize(9);
  for (const l of estado.lineas) {
    // Salto de página: sin esto, un histórico largo escribe fuera del papel y
    // las últimas líneas —que son las que traen el saldo actual— desaparecen.
    if (y > 760) {
      docpdf.addPage();
      y = 56;
    }
    docpdf.text(l.periodo, left, y);
    docpdf.text(String(l.concepto).slice(0, 28), left + 70, y);
    docpdf.text(formatMoney(l.cargo), 330, y, { align: "right" });
    docpdf.text(l.pagado > 0 ? formatMoney(l.pagado) : "—", 410, y, { align: "right" });
    docpdf.text(formatMoney(l.saldoAcumulado), right, y, { align: "right" });
    y += 15;
  }

  if (estado.lineas.length === 0) {
    docpdf.text("Esta unidad no tiene movimientos en el período consultado.", left, y);
    y += 15;
  }

  y += 6;
  docpdf.line(left, y, right, y);
  y += salto;

  docpdf.setFontSize(10);
  docpdf.text("Total cargado", left, y);
  docpdf.text(formatMoney(estado.totalCargado), right, y, { align: "right" });
  y += salto;
  docpdf.text("Total pagado", left, y);
  docpdf.text(formatMoney(estado.totalPagado), right, y, { align: "right" });
  y += salto;

  docpdf.setFontSize(12);
  docpdf.text("Saldo pendiente", left, y);
  docpdf.text(formatMoney(estado.saldoFinal), right, y, { align: "right" });
  y += salto;

  // R4 · el saldo a favor se NOMBRA. Callarlo en un documento que dice «saldo
  // pendiente: 0» dejaría al residente sin saber que tiene dinero puesto.
  if (cabecera.saldoAFavor && cabecera.saldoAFavor > 0) {
    docpdf.setFontSize(10);
    docpdf.text("Saldo a favor", left, y);
    docpdf.text(formatMoney(cabecera.saldoAFavor), right, y, { align: "right" });
    y += salto;
  }

  // Se dice cuántos cargos anulados quedaron fuera. Un total que no cuadra con
  // lo que alguien recuerda haber recibido necesita explicarse en el papel: si
  // no, la pregunta llega al administrador.
  if (estado.anuladosExcluidos > 0) {
    docpdf.setFontSize(8);
    docpdf.setTextColor(120);
    docpdf.text(
      `No se incluyen ${estado.anuladosExcluidos} cargo(s) anulado(s), que no generan deuda.`,
      left,
      y,
    );
    docpdf.setTextColor(0);
    y += salto;
  }

  y += 10;
  docpdf.setFontSize(8);
  docpdf.setTextColor(120);
  docpdf.text(
    "Documento generado por Vivaru. Es un resumen informativo de la cuenta y NO acredita estar a paz y salvo.",
    left,
    y,
  );

  docpdf.save(`estado-de-cuenta-${cabecera.unidad}-${cabecera.emitidoEl}.pdf`);
}
