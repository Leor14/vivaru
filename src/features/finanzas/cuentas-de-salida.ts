import type { BankAccount, PettyCashFund } from "@/types/domain";

/**
 * De dónde puede SALIR el dinero de un egreso: lo que ofrece «Sale de» (`PRD-V-FEAT-010`).
 *
 * Una cuenta bancaria activa o una caja chica abierta, las dos del conjunto —lo mismo que acepta
 * el servidor al pagar una cuota (`comprobarCuentaDeSalida` en `functions/src/egresos-en-cuotas.ts`)—.
 * **La que el egreso ya lleva se conserva** aunque la cuenta se haya dado de baja o la caja se haya
 * cerrado: si no, el selector la borraría en silencio al guardar un gasto viejo.
 *
 * Vivía escrita dentro del formulario de egresos. Salió cuando el pago de una cuota ganó su propio
 * «Sale de» (11 sep 2026), para que las dos pantallas no ofrezcan cosas distintas.
 */
export function cuentasDeSalida(
  bancos: BankAccount[],
  cajas: PettyCashFund[],
  actual?: string | null,
): { bancos: BankAccount[]; cajas: PettyCashFund[] } {
  return {
    bancos: bancos.filter((b) => b.active !== false || b.id === actual),
    cajas: cajas.filter((c) => c.status === "abierta" || c.id === actual),
  };
}
