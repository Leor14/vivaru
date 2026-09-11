import { describe, expect, it } from "vitest";

import { calcularTramosCandidatos, porQueNoEsCandidatoElTramo, tramosDe } from "@/features/finanzas/conciliacion-reglas";
import type { BankStatementLine, TreasuryTransfer } from "@/types/domain";

/**
 * `PRD-V-FEAT-010` 2b · el ESPEJO de los tramos, el que decide qué ofrece la
 * bandeja. Los mismos casos que `functions/tests/conciliacion-tramos.test.ts`:
 * si el espejo ofreciera un tramo que el servidor rechaza —o escondiera uno que
 * vale—, nadie lo vería, porque no se ve lo que no está.
 */

const T = "conjunto";
const traspaso = (extra: Partial<TreasuryTransfer> = {}) =>
  ({ id: "tr-1", tenantId: T, fromAccountId: "banco-a", toAccountId: "banco-b", amount: 300000, date: "2026-09-10", kind: "traspaso", status: "registrado", ...extra }) as TreasuryTransfer;
const linea = (extra: Partial<BankStatementLine> = {}) =>
  ({ id: "l-1", tenantId: T, bankAccountId: "banco-a", date: "2026-09-10", description: "TRASPASO", amount: -300000, reconciled: false, ...extra }) as BankStatementLine;
const [salida, entrada] = tramosDe(traspaso());

describe("la bandeja ofrece cada tramo en el extracto de SU banco", () => {
  it("`CA7` · la salida en A con −300.000, la entrada en B con +300.000", () => {
    expect(porQueNoEsCandidatoElTramo(linea(), salida)).toBeNull();
    expect(porQueNoEsCandidatoElTramo(linea({ bankAccountId: "banco-b", amount: 300000 }), entrada)).toBeNull();
  });

  it("cruzados o con el sentido cambiado, no", () => {
    expect(porQueNoEsCandidatoElTramo(linea({ amount: 300000 }), entrada)).toBe("otra_cuenta");
    expect(porQueNoEsCandidatoElTramo(linea({ amount: 300000 }), salida)).toBe("efecto");
  });

  it("ni fuera de ventana, ni ya conciliado, ni anulado", () => {
    expect(porQueNoEsCandidatoElTramo(linea({ date: "2026-09-14" }), salida)).toBe("fecha");
    expect(porQueNoEsCandidatoElTramo(linea(), tramosDe(traspaso({ salidaLineId: "l-9" }))[0])).toBe("ya_conciliado");
    expect(porQueNoEsCandidatoElTramo(linea(), tramosDe(traspaso({ status: "anulado" }))[0])).toBe("anulado");
  });

  it("el lado de la caja chica nunca se ofrece", () => {
    const tramos = tramosDe(traspaso({ toAccountId: "caja-porteria", kind: "apertura" }));
    expect(calcularTramosCandidatos(linea(), tramos).map((t) => t.id)).toEqual(["tr-1:salida"]);
    expect(calcularTramosCandidatos(linea({ amount: 300000 }), tramos)).toEqual([]);
  });
});
