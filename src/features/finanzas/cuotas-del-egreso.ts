/**
 * **Estas cinco viven en el NÚCLEO y aquí solo se reexportan**, no se copian: las
 * necesitan el cliente —para no dejar teclear un plan que no cuadra— y el
 * servidor, que es quien de verdad lo guarda desde que la edición del plan pasó a
 * callable (`R8`). El núcleo tiene que ser autocontenido para espejarse byte a
 * byte en `functions/`, así que reexportar deja **una sola definición**. Es lo
 * mismo que hace `codigo-de-cuenta.ts` con `compararCodigos`.
 */
export {
  explicarProblemaDelPlan as explicarProblema,
  fundirPlan,
  sumaDelPlan,
  validarPlan,
  type ProblemaDelPlan,
} from "@/lib/finanzas/nucleo-estado-financiero";

import { aCentimos } from "@/lib/finanzas/nucleo-estado-financiero";
import type { Expense, Installment } from "@/types/domain";

/**
 * `PRD-V-FLOW-008` — el calendario de cuotas de una cuenta por pagar.
 *
 * ## Qué resuelve
 *
 * La administradora paga la póliza del seguro **en once cuotas** y hoy teclea el
 * cuadro de pagos a mano, porque en Vivaru un egreso es **un importe con UNA
 * fecha**. Aquí vive la aritmética del plan: validarlo, y decir qué está vencido.
 *
 * ## Por qué la validación vive aparte de la pantalla
 *
 * Un plan que no suma la factura **descuadra la deuda del conjunto para
 * siempre**, y esa cifra la lee el consejo en el informe mensual. La regla tiene
 * que poder comprobarse sin montar un formulario, y la comprueban a la vez el
 * cliente (para no dejar escribir) y el banco de pruebas (para que no se rompa).
 *
 * **Lo que NO está aquí es pagar.** La entrega 1 declara el plan y lo enseña; el
 * pago es la entrega 2 y va **por callable**, porque escribe en dos sitios y
 * sella `paidAmount`.
 */

// ── El envejecimiento ────────────────────────────────────────────────────────

export type Envejecimiento = { vencido: number; proximo: number };

/**
 * Lo vencido y lo próximo a vencer **de un egreso**, mirando cada cuota.
 *
 * **Con plan, la fecha que manda es la de cada cuota, no la de la factura**
 * (`RN-09` y §4.4). Una póliza de once cuotas tiene tres vencidas y ocho por
 * venir; contarla entera por el `dueDate` de la factura la pone toda de un lado.
 *
 * **Sin plan se comporta exactamente como hasta hoy**: el `dueDate` del egreso
 * decide, y sin `dueDate` no cuenta en ninguno de los dos — no se sabe cuándo
 * vencía, y afirmarlo sería inventarlo.
 */
export function envejecerEgreso(
  egreso: Pick<Expense, "amount" | "dueDate" | "status" | "installments" | "paidAmount">,
  asOf: string,
  corte: string,
): Envejecimiento {
  if (egreso.status !== "registrado") return { vencido: 0, proximo: 0 };

  const cuotas = egreso.installments;
  if (!cuotas || cuotas.length === 0) {
    const pendiente = (egreso.amount ?? 0) - (egreso.paidAmount ?? 0);
    const importe = pendiente > 0 ? pendiente : 0;
    if (!egreso.dueDate) return { vencido: 0, proximo: 0 };
    if (egreso.dueDate < asOf) return { vencido: importe, proximo: 0 };
    if (egreso.dueDate <= corte) return { vencido: 0, proximo: importe };
    return { vencido: 0, proximo: 0 };
  }

  let vencido = 0;
  let proximo = 0;
  for (const c of cuotas) {
    // Solo lo que de verdad se debe: una cuota pagada ya no vence, y una anulada
    // dejó de existir.
    if (c.status !== "pendiente") continue;
    if (!c.dueDate) continue;
    if (c.dueDate < asOf) vencido += c.amount ?? 0;
    else if (c.dueDate <= corte) proximo += c.amount ?? 0;
  }
  return { vencido: aCentimos(vencido), proximo: aCentimos(proximo) };
}

/**
 * La cuota que toca pagar. Es lo que el administrador busca al abrir la pantalla:
 * de once, cuál va ahora.
 *
 * **La más antigua sin pagar, no la siguiente por número.** Se puede pagar la 5
 * antes que la 3 —la vida real no siempre paga en orden, y bloquearlo obligaría a
 * mentir en el registro—, así que lo que toca es la más vieja que siga debiéndose.
 */
export function proximaCuota(cuotas: ReadonlyArray<Installment> | undefined): Installment | undefined {
  if (!cuotas) return undefined;
  return [...cuotas]
    .filter((c) => c.status === "pendiente")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.number - b.number)[0];
}

/**
 * Lo ya pagado de una factura, **para enseñarlo**.
 *
 * Con plan sale de `paidAmount`, que sella el servidor; sin plan, del estado —un
 * egreso `pagado` se pagó entero—. **Existe porque «pagado» dejó de ser binario**:
 * una factura en `registrado` con tres cuotas saldadas SÍ ha pagado algo, y el
 * bucle que sumaba solo los `pagado` la contaba como cero.
 */
export function pagadoDelEgreso(
  egreso: Pick<Expense, "amount" | "status" | "paidAmount" | "installments">,
): number {
  if (egreso.status === "anulado") return 0;
  if (egreso.installments && egreso.installments.length > 0) {
    return aCentimos(egreso.paidAmount ?? 0);
  }
  return egreso.status === "pagado" ? (egreso.amount ?? 0) : 0;
}

