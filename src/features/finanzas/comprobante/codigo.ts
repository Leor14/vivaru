import type { PaymentVoucher } from "@/types/domain";

/**
 * Cómo se llama un recibo en pantalla y en el PDF.
 *
 * **Por qué existe.** El 20 de agosto de 2026 el recibo dejó de llevar
 * secuencial correlativo y pasó a llevar un `code` derivado de su id. Los
 * recibos emitidos ANTES no tienen `code`: tienen `sequentialNumber`. Leer solo
 * el campo nuevo pintaba **«No. undefined»** en el PDF y descargaba un archivo
 * llamado `recibo-undefined.pdf`.
 *
 * Lo destapó David en producción, sobre el único recibo que existía allí. Es la
 * misma familia que los asientos sin `operationKey`: **un cambio de forma no
 * migra lo que ya está escrito**, y aquí no hacía falta migrarlo —basta con
 * saber leer las dos formas—.
 *
 * No se migran los recibos viejos a propósito: reescribir un documento que
 * alguien ya descargó cambiaría el número de un papel que está impreso.
 */
export function codigoDeRecibo(voucher: Pick<PaymentVoucher, "code" | "sequentialNumber">): string {
  return voucher.code || voucher.sequentialNumber || "—";
}
