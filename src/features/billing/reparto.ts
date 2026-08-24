/**
 * `PRD-V-FLOW-002` R7 — el reparto sugerido de un pago entre varios cargos.
 *
 * **Esto SUGIERE; no decide.** Lo que de verdad se aplica lo calcula el servidor
 * dentro de la transacción (`aplicarPago`): topa cada línea al saldo del cargo y
 * manda el resto al anticipo, mire lo que mire esta pantalla. Aquí solo se
 * construye la propuesta que el administrador ve y puede editar antes de
 * confirmar, y **el número que se enseña después es el que devuelve el
 * servidor**, no este.
 *
 * **Por qué vive en el navegador, y qué habría que hacer con ello.** §11.3
 * recomienda pedirle la vista previa al servidor en vez de calcularla, y tiene
 * razón: hoy el orden de R7 lo decide quien llama. No se hizo así porque la
 * callable no existe y esta entrega no toca `functions/`. Lo que se puede hacer
 * mientras tanto es lo que se hizo: **una sola función pura**, con la deuda
 * calculada por `computeBalanceStatus` —el espejo declarado de `calcularSaldo`—
 * y no por una resta escrita a mano en la pantalla. Cuando exista la callable,
 * esto se borra entero; mientras no exista, al menos hay un solo sitio donde
 * mirar.
 */

import { computeBalanceStatus } from "@/features/finanzas/use-payments";
import type { BillingStatement } from "@/types/domain";

/**
 * Lo mínimo que hace falta de un cargo para repartir sobre él.
 *
 * Solo el `id` es obligatorio: un `BillingStatement` real siempre trae período,
 * pero exigirlo aquí obligaría a construir cargos completos para probar la
 * aritmética, y una prueba difícil de escribir es una prueba que no se escribe.
 */
export type CargoParaReparto = Pick<BillingStatement, "id"> &
  Partial<Pick<BillingStatement, "amount" | "paymentAmount" | "advanceAppliedAmount" | "dueDate" | "period">>;

export type LineaDeReparto = {
  statementId: string;
  /** Lo que se propone aplicar a este cargo. */
  amount: number;
};

export type Reparto = {
  lineas: LineaDeReparto[];
  /** Lo que no cabe en ningún cargo. Con la bandera encendida, será anticipo (R2). */
  sobrante: number;
};

function numero(valor: unknown): number {
  const n = typeof valor === "number" ? valor : Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lo que le falta a un cargo para quedar saldado.
 *
 * **Se pregunta a `computeBalanceStatus` y no se resta a mano.** Es el espejo
 * declarado de `calcularSaldo` (§11.3), y es quien sabe que lo cubierto con
 * anticipos cuenta para saldar aunque no esté en `paymentAmount` (R4). Una resta
 * escrita aquí sería un tercer sitio donde se calcula lo mismo, y el tercero es
 * el que se olvida de actualizar.
 *
 * Hasta hoy `computeBalanceStatus` no la llamaba nadie —medido el 23 de agosto
 * de 2026—; esta es la decisión abierta que la sesión A dejó anotada, resuelta
 * cableándola en vez de borrándola.
 */
export function deudaDelCargo(cargo: CargoParaReparto): number {
  return computeBalanceStatus(
    numero(cargo.amount),
    numero(cargo.paymentAmount),
    numero(cargo.advanceAppliedAmount),
    cargo.dueDate,
  ).balance;
}

/**
 * Del más antiguo por vencimiento al más nuevo (R7).
 *
 * Un cargo **sin `dueDate` cae al período**, que es `YYYY-MM`: es lo que ya hace
 * `computeStatementStatus` para decidir la mora, y separarse de ese criterio
 * dejaría a un mismo cargo «vencido» en una pantalla y «el más nuevo» en la
 * siguiente. Se compara el período como `YYYY-MM-01`, que es la fecha más
 * temprana compatible con él.
 *
 * El desempate por `id` no es estética: sin él, dos cargos del mismo mes se
 * ordenarían según cómo los devolviera Firestore, y la propuesta cambiaría entre
 * dos aperturas del mismo formulario sin que nadie hubiera tocado nada.
 */
export function ordenarPorAntiguedad<T extends CargoParaReparto>(cargos: readonly T[]): T[] {
  const clave = (c: CargoParaReparto) => c.dueDate ?? (c.period ? `${c.period}-01` : "9999-12-31");
  return [...cargos].sort((a, b) => clave(a).localeCompare(clave(b)) || a.id.localeCompare(b.id));
}

/**
 * Reparte `importe` entre `cargos`, del más antiguo al más nuevo.
 *
 * **Un cargo sin deuda no genera línea**, ni siquiera de cero: el servidor no
 * escribe asientos de importe cero y una línea de cero en la vista previa haría
 * creer que ese cargo recibió algo. Un pago que no cabe en ninguno sale con
 * `lineas: []` y todo en `sobrante`, que es CA8.
 */
export function repartirPago(cargos: readonly CargoParaReparto[], importe: number): Reparto {
  let restante = numero(importe);
  if (restante <= 0) return { lineas: [], sobrante: 0 };

  const lineas: LineaDeReparto[] = [];
  for (const cargo of ordenarPorAntiguedad(cargos)) {
    if (restante <= 0) break;
    const deuda = deudaDelCargo(cargo);
    if (deuda <= 0) continue;
    const aplicar = Math.min(restante, deuda);
    lineas.push({ statementId: cargo.id, amount: aplicar });
    restante -= aplicar;
  }

  return { lineas, sobrante: restante };
}

/**
 * ¿Cuadra un reparto editado a mano? (CF5)
 *
 * **La suma puede ser MENOR que el importe y eso es correcto**: la diferencia es
 * sobrante y se convierte en anticipo (R2). Lo que el servidor rechaza es que se
 * pase. Escribirlo como «tiene que ser exactamente igual» es el error fácil, y
 * dejaría al administrador sin poder repartir 100 entre dos cargos de 30
 * dejando 40 a favor, que es un caso normal.
 */
export function repartoCuadra(lineas: readonly LineaDeReparto[], importe: number): boolean {
  const suma = lineas.reduce((s, l) => s + numero(l.amount), 0);
  return lineas.every((l) => numero(l.amount) > 0) && suma <= numero(importe) + 0.005;
}
