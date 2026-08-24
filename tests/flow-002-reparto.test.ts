import { describe, expect, it } from "vitest";

import {
  deudaDelCargo,
  ordenarPorAntiguedad,
  repartirPago,
  repartoCuadra,
  type CargoParaReparto,
} from "@/features/billing/reparto";
import { saldoAFavor, crucesVigentes } from "@/features/finanzas/use-advances";
import type { Advance, AdvanceApplication } from "@/types/domain";

const cargo = (over: Partial<CargoParaReparto> & { id: string }): CargoParaReparto => ({
  amount: 0,
  paymentAmount: 0,
  advanceAppliedAmount: 0,
  ...over,
});

describe("deudaDelCargo — lo que falta para saldar", () => {
  it("descuenta lo pagado", () => {
    expect(deudaDelCargo(cargo({ id: "a", amount: 140_000, paymentAmount: 40_000 }))).toBe(100_000);
  });

  /**
   * R4. Lo cubierto con anticipos NO está en `paymentAmount` y sí salda. Si esta
   * resta se hubiera escrito a mano en la pantalla, el cargo saldado con
   * anticipo saldría con deuda y el reparto le mandaría dinero otra vez.
   */
  it("lo cubierto con un anticipo cruzado también salda", () => {
    expect(deudaDelCargo(cargo({ id: "a", amount: 140_000, advanceAppliedAmount: 140_000 }))).toBe(0);
    expect(
      deudaDelCargo(cargo({ id: "a", amount: 140_000, paymentAmount: 40_000, advanceAppliedAmount: 60_000 })),
    ).toBe(40_000);
  });

  it("nunca es negativa: un sobrepago viejo no genera deuda al revés", () => {
    expect(deudaDelCargo(cargo({ id: "a", amount: 100_000, paymentAmount: 150_000 }))).toBe(0);
  });
});

describe("ordenarPorAntiguedad — R7", () => {
  it("del vencimiento más antiguo al más nuevo", () => {
    const orden = ordenarPorAntiguedad([
      cargo({ id: "c", dueDate: "2026-08-05" }),
      cargo({ id: "a", dueDate: "2026-06-05" }),
      cargo({ id: "b", dueDate: "2026-07-05" }),
    ]).map((c) => c.id);
    expect(orden).toEqual(["a", "b", "c"]);
  });

  // Mismo criterio que `computeStatementStatus` usa para la mora. Separarse
  // dejaría un cargo «vencido» en una pantalla y «el más nuevo» en la siguiente.
  it("un cargo sin vencimiento cae a su período", () => {
    const orden = ordenarPorAntiguedad([
      cargo({ id: "julio", period: "2026-07" }),
      cargo({ id: "junio", period: "2026-06" }),
    ]).map((c) => c.id);
    expect(orden).toEqual(["junio", "julio"]);
  });

  /**
   * Sin desempate, dos cargos del mismo mes se ordenarían según cómo los
   * devolviera Firestore y la propuesta cambiaría entre dos aperturas del mismo
   * formulario sin que nadie tocara nada.
   */
  it("desempata por id, así que el orden no cambia entre dos aperturas", () => {
    const entrada = [cargo({ id: "z", period: "2026-06" }), cargo({ id: "a", period: "2026-06" })];
    expect(ordenarPorAntiguedad(entrada).map((c) => c.id)).toEqual(["a", "z"]);
    expect(ordenarPorAntiguedad([...entrada].reverse()).map((c) => c.id)).toEqual(["a", "z"]);
  });

  it("no muta lo que recibe", () => {
    const entrada = [cargo({ id: "b", period: "2026-07" }), cargo({ id: "a", period: "2026-06" })];
    ordenarPorAntiguedad(entrada);
    expect(entrada.map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("repartirPago — la propuesta que ve el administrador", () => {
  const junio = cargo({ id: "junio", amount: 100_000, dueDate: "2026-06-05" });
  const julio = cargo({ id: "julio", amount: 100_000, dueDate: "2026-07-05" });
  const agosto = cargo({ id: "agosto", amount: 100_000, dueDate: "2026-08-05" });

  // CA3.
  it("cubre tres cargos en una sola operación, del más viejo al más nuevo", () => {
    const r = repartirPago([agosto, junio, julio], 300_000);
    expect(r.lineas).toEqual([
      { statementId: "junio", amount: 100_000 },
      { statementId: "julio", amount: 100_000 },
      { statementId: "agosto", amount: 100_000 },
    ]);
    expect(r.sobrante).toBe(0);
  });

  it("lo que no alcanza se queda en el más antiguo, y el resto no recibe nada", () => {
    const r = repartirPago([junio, julio], 60_000);
    expect(r.lineas).toEqual([{ statementId: "junio", amount: 60_000 }]);
    expect(r.sobrante).toBe(0);
  });

  // CA1/R2: lo que sobra no se evapora, sale nombrado como sobrante.
  it("lo que sobra sale aparte, no repartido de más", () => {
    const r = repartirPago([cargo({ id: "j", amount: 140_000, dueDate: "2026-06-05" })], 200_000);
    expect(r.lineas).toEqual([{ statementId: "j", amount: 140_000 }]);
    expect(r.sobrante).toBe(60_000);
  });

  // CA8.
  it("un pago sin cargos pendientes es sobrante entero", () => {
    const saldado = cargo({ id: "s", amount: 100_000, paymentAmount: 100_000, dueDate: "2026-06-05" });
    const r = repartirPago([saldado], 50_000);
    expect(r.lineas).toEqual([]);
    expect(r.sobrante).toBe(50_000);
    expect(repartirPago([], 50_000)).toEqual({ lineas: [], sobrante: 50_000 });
  });

  /**
   * Un cargo saldado no genera línea NI DE CERO. El servidor no escribe asientos
   * de importe cero, y una fila de cero en la vista previa haría creer que ese
   * cargo recibió algo.
   */
  it("un cargo ya saldado se salta, no aparece con cero", () => {
    const saldado = cargo({ id: "saldado", amount: 100_000, advanceAppliedAmount: 100_000, dueDate: "2026-05-05" });
    const r = repartirPago([saldado, junio], 100_000);
    expect(r.lineas).toEqual([{ statementId: "junio", amount: 100_000 }]);
  });

  // R1: ni un céntimo se pierde ni se inventa.
  it("lo repartido más el sobrante es exactamente lo pagado", () => {
    for (const importe of [1, 99_999, 100_000, 250_000, 1_000_000]) {
      const r = repartirPago([junio, julio, agosto], importe);
      const suma = r.lineas.reduce((s, l) => s + l.amount, 0);
      expect(suma + r.sobrante).toBe(importe);
    }
  });

  it("un importe de cero o negativo no propone nada", () => {
    expect(repartirPago([junio], 0)).toEqual({ lineas: [], sobrante: 0 });
    expect(repartirPago([junio], -5)).toEqual({ lineas: [], sobrante: 0 });
  });
});

describe("repartoCuadra — CF5", () => {
  it("rechaza un reparto que se pasa del importe", () => {
    expect(repartoCuadra([{ statementId: "a", amount: 120 }], 100)).toBe(false);
  });

  /**
   * **La suma PUEDE ser menor, y esto es la mitad que se escribe mal.** La
   * diferencia es sobrante y se convierte en anticipo (R2). Exigir igualdad
   * exacta dejaría al administrador sin poder repartir 100 entre dos cargos de
   * 30 dejando 40 a favor, que es un caso normal.
   */
  it("acepta que sume MENOS: la diferencia es anticipo", () => {
    expect(repartoCuadra([{ statementId: "a", amount: 30 }, { statementId: "b", amount: 30 }], 100)).toBe(true);
  });

  it("acepta la igualdad exacta", () => {
    expect(repartoCuadra([{ statementId: "a", amount: 100 }], 100)).toBe(true);
  });

  it("rechaza una línea de cero o negativa", () => {
    expect(repartoCuadra([{ statementId: "a", amount: 0 }], 100)).toBe(false);
    expect(repartoCuadra([{ statementId: "a", amount: -10 }, { statementId: "b", amount: 20 }], 100)).toBe(false);
  });
});

const anticipo = (over: Partial<Advance> & { id: string }): Advance => ({
  tenantId: "t",
  unitId: "u1",
  amount: 0,
  remaining: 0,
  origin: "overpayment",
  date: "2026-08-01",
  status: "open",
  ...over,
});

describe("saldoAFavor — CA2", () => {
  it("suma el remanente de los abiertos de la unidad", () => {
    const items = [
      anticipo({ id: "1", remaining: 60_000 }),
      anticipo({ id: "2", remaining: 15_000 }),
      anticipo({ id: "3", remaining: 90_000, unitId: "u2" }),
    ];
    expect(saldoAFavor(items, "u1")).toBe(75_000);
    expect(saldoAFavor(items)).toBe(165_000);
  });

  /**
   * Un `cancelled` puede tener remanente cero por haberse ANULADO, no por
   * haberse gastado. Filtrar por `remaining > 0` en vez de por estado contaría
   * dinero que ya no está disponible en cuanto R9 dejara el remanente intacto.
   */
  it("no cuenta los aplicados ni los anulados", () => {
    const items = [
      anticipo({ id: "1", remaining: 60_000 }),
      anticipo({ id: "2", amount: 40_000, remaining: 0, status: "applied" }),
      anticipo({ id: "3", amount: 30_000, remaining: 30_000, status: "cancelled" }),
    ];
    expect(saldoAFavor(items, "u1")).toBe(60_000);
  });
});

describe("crucesVigentes — R8", () => {
  const cruce = (over: Partial<AdvanceApplication> & { id: string }): AdvanceApplication => ({
    tenantId: "t",
    advanceId: "adv-1",
    statementId: "bill-1",
    unitId: "u1",
    amount: 10_000,
    date: "2026-08-02",
    ...over,
  });

  /**
   * **Es la distinción que costó cinco operaciones encadenadas encontrar.** «Tiene
   * cruces» no es `remaining < amount`: anular un anticipo pone el remanente a
   * cero sin haber cruzado nada, y preguntarlo así bloqueaba una reversión
   * legítima. Se pregunta por los cruces sin deshacer.
   */
  it("solo cuenta los que no se han deshecho", () => {
    const aplicaciones = [
      cruce({ id: "x" }),
      cruce({ id: "y", reversedAt: "2026-08-03" }),
      cruce({ id: "z", advanceId: "adv-2" }),
    ];
    expect(crucesVigentes(aplicaciones, "adv-1").map((a) => a.id)).toEqual(["x"]);
  });

  it("un anticipo anulado sin cruces no tiene ninguno vigente", () => {
    expect(crucesVigentes([cruce({ id: "y", reversedAt: "2026-08-03" })], "adv-1")).toEqual([]);
  });
});
