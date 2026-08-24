/**
 * Fórmula ÚNICA del recaudo (VIV-103/1103): "facturado", "recaudado",
 * "liquidado" y "% recaudo" se calculan aquí y solo aquí.
 *
 * **Desde `FLOW-002` R16 son DOS números y no uno.** "Recaudado" es el dinero
 * que entró (Σ `paymentAmount`); el "% recaudo" mide cuánto de lo facturado ha
 * dejado de deberse, que con anticipos por medio ya no es lo mismo.
 *
 * Antes Dashboard, Cartera y el Reporte de Comité tenían tres fórmulas distintas
 * de "facturado" (con y sin fallback a balance+pago) y redondeos diferentes, y
 * el mismo indicador mostraba tres valores. Los consumidores solo eligen el
 * RANGO y el redondeo de presentación.
 */

type StatementLike = {
  amount?: number | null;
  balance?: number | null;
  paymentAmount?: number | null;
  /** `FLOW-002` R4. Lo cubierto con anticipos cruzados, aparte de `paymentAmount`. */
  advanceAppliedAmount?: number | null;
};

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Monto facturado de un cobro. Fallback para registros legados sin `amount`:
 *  saldo pendiente + lo ya saldado reconstruye el facturado original.
 *
 *  Lo saldado incluye `advanceAppliedAmount` (`FLOW-002` R4): sin él, un cargo
 *  legado cubierto con un anticipo reconstruiría un facturado más pequeño del
 *  real, y el «% de recaudo» saldría por encima del 100 %. */
export function statementChargedAmount(statement: StatementLike): number {
  const amount = toNumber(statement.amount);
  if (amount > 0) return amount;
  return Math.max(
    toNumber(statement.balance) + toNumber(statement.paymentAmount) + toNumber(statement.advanceAppliedAmount),
    0,
  );
}

/** Monto recaudado de un cobro: **el dinero que entró por Cartera**. Sigue
 *  siendo Σ `paymentAmount` y `FLOW-002` no lo cambia — lo del anticipo entró
 *  por el libro, y sumarlo aquí lo contaría dos veces (R4). */
export function statementCollectedAmount(statement: StatementLike): number {
  return Math.max(toNumber(statement.paymentAmount), 0);
}

/**
 * Monto **liquidado** de un cobro: cuánto de lo facturado ha dejado de deberse,
 * venga de donde venga el dinero.
 *
 * **`FLOW-002` R16 — es lo que mide el «% de recaudo», y no es lo recaudado.**
 * En cuanto existen anticipos, «cuánto dinero entró» y «cuánto de lo facturado
 * está saldado» dejan de ser el mismo número, y hasta hoy el informe respondía a
 * los dos con uno solo. Una unidad que cubre julio con un anticipo de junio
 * saldría al **0 % de recaudo con la cuota saldada**: el cruce no toca
 * `paymentAmount` a propósito (R4), porque subirlo contaría el anticipo dos
 * veces sin crear ningún asiento.
 *
 * **Se calcula `facturado − saldo`, y no `pagado + anticipo`.** Los dos dan lo
 * mismo mientras nadie pague de más; con un sobrepago viejo —de los que
 * `paymentAmount: 200` sobre un cargo de 140, anteriores a `FLOW-002`— el
 * segundo daría más del 100 % de recaudo. El saldo ya viene topado en cero por
 * `calcularSaldo`, así que restarlo clava el techo donde tiene que estar.
 */
export function statementSettledAmount(statement: StatementLike): number {
  const charged = statementChargedAmount(statement);
  const balance = Math.max(toNumber(statement.balance), 0);
  return Math.min(Math.max(charged - balance, 0), charged);
}

export type CollectionSummary = {
  charged: number;
  /** El dinero que entró por Cartera. Es el INGRESO, y no es lo que mide `rate`. */
  collected: number;
  /** Lo facturado que ha dejado de deberse, venga de donde venga (`FLOW-002` R16). */
  settled: number;
  /** % recaudo SIN redondear (0 cuando no hay facturado). El consumidor decide
   *  la presentación (Math.round para reportes, decimales para tableros).
   *
   *  **Mide liquidación, no ingreso** (R16). Los dos números coinciden mientras
   *  no haya anticipos; en cuanto los hay, el informe tiene que dejar de
   *  responder a las dos preguntas con uno solo. */
  rate: number;
};

/** Resumen de recaudo de un conjunto de cobros (el caller define el rango). */
export function computeCollectionSummary(statements: readonly StatementLike[]): CollectionSummary {
  let charged = 0;
  let collected = 0;
  let settled = 0;
  for (const statement of statements) {
    charged += statementChargedAmount(statement);
    collected += statementCollectedAmount(statement);
    settled += statementSettledAmount(statement);
  }
  return { charged, collected, settled, rate: charged > 0 ? (settled / charged) * 100 : 0 };
}
