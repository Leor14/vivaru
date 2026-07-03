/**
 * Fórmula ÚNICA del recaudo (VIV-103/1103): "facturado", "recaudado" y
 * "% recaudo" se calculan aquí y solo aquí. Antes Dashboard, Cartera y el
 * Reporte de Comité tenían tres fórmulas distintas de "facturado" (con y sin
 * fallback a balance+pago) y redondeos diferentes, y el mismo indicador
 * mostraba tres valores. Los consumidores solo eligen el RANGO y el redondeo
 * de presentación.
 */

type StatementLike = {
  amount?: number | null;
  balance?: number | null;
  paymentAmount?: number | null;
};

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Monto facturado de un cobro. Fallback para registros legados sin `amount`:
 *  saldo pendiente + lo ya pagado reconstruye el facturado original. */
export function statementChargedAmount(statement: StatementLike): number {
  const amount = toNumber(statement.amount);
  if (amount > 0) return amount;
  return Math.max(toNumber(statement.balance) + toNumber(statement.paymentAmount), 0);
}

/** Monto recaudado de un cobro. */
export function statementCollectedAmount(statement: StatementLike): number {
  return Math.max(toNumber(statement.paymentAmount), 0);
}

export type CollectionSummary = {
  charged: number;
  collected: number;
  /** % recaudo SIN redondear (0 cuando no hay facturado). El consumidor decide
   *  la presentación (Math.round para reportes, decimales para tableros). */
  rate: number;
};

/** Resumen de recaudo de un conjunto de cobros (el caller define el rango). */
export function computeCollectionSummary(statements: readonly StatementLike[]): CollectionSummary {
  let charged = 0;
  let collected = 0;
  for (const statement of statements) {
    charged += statementChargedAmount(statement);
    collected += statementCollectedAmount(statement);
  }
  return { charged, collected, rate: charged > 0 ? (collected / charged) * 100 : 0 };
}
