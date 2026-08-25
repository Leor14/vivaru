export type StatementStatus = "paid" | "pending" | "overdue" | "cancelled";

/**
 * Estado de un estado de cuenta de cartera.
 * - "paid": sin saldo.
 * - "overdue" (En mora): saldo pendiente y vencido.
 * - "pending": saldo pendiente aún no vencido.
 *
 * Si hay fecha de recaudo (`dueDate`) se usa esa para decidir el vencimiento.
 * Si NO hay fecha, se usa el `period` (mes del cobro, "YYYY-MM"): un mes ya
 * pasado con saldo queda en mora. Antes la mora exigía `dueDate`, así que los
 * cobros registrados sin fecha quedaban como "pendiente" aunque debieran meses.
 * `asOf` se inyecta en pruebas; por defecto usa hoy.
 *
 * **`cancelled` (FLOW-001) NO se deriva del saldo, se conserva.** Un cargo
 * anulado queda con `balance = 0`, y sin esta salida temprana esta función lo
 * recalcularía como «paid»: diría que se pagó algo que se anuló. Por eso el
 * estado actual entra como opción y manda sobre la aritmética.
 */
export function computeStatementStatus(
  balance: number,
  opts: { dueDate?: string; period?: string; asOf?: string; current?: StatementStatus } = {},
): StatementStatus {
  if (opts.current === "cancelled") return "cancelled";
  if (balance <= 0) return "paid";
  // Hora LOCAL (no UTC): `toISOString` desfasaría el "hoy" cerca de medianoche en
  // zonas != UTC (p. ej. México UTC-6) y marcaría cobros como vencidos un día antes.
  const now = new Date();
  const today =
    opts.asOf ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (opts.dueDate) return opts.dueDate < today ? "overdue" : "pending";
  if (opts.period && opts.period < today.slice(0, 7)) return "overdue";
  return "pending";
}
