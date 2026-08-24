import { describe, expect, it } from "vitest";

import { deudaDelCargo, ordenarPorAntiguedad, repartirPorAntiguedad } from "../src/payments";

const HOY = "2026-08-24";
const cargo = (over: { id: string; amount?: number; paymentAmount?: number; advanceAppliedAmount?: number; dueDate?: string; period?: string }) => ({
  amount: 0,
  paymentAmount: 0,
  advanceAppliedAmount: 0,
  ...over,
});

/**
 * **R7 en el servidor** (`PRD-V-FLOW-002` §11.3).
 *
 * Estas pruebas son las que vivían en `tests/flow-002-reparto.test.ts` del lado
 * del cliente: el reparto se mudó aquí el 24 de agosto de 2026 para que el orden
 * en que se imputa el dinero de alguien deje de decidirlo el navegador.
 */
describe("deudaDelCargo — lo que falta para saldar", () => {
  it("descuenta lo pagado", () => {
    expect(deudaDelCargo(cargo({ id: "a", amount: 140_000, paymentAmount: 40_000 }), HOY)).toBe(100_000);
  });

  /**
   * R4. Lo cubierto con anticipos NO está en `paymentAmount` y sí salda. Sale de
   * `calcularSaldo` y no de una resta escrita aquí: una tercera copia de la
   * misma aritmética es la que se olvida de actualizar.
   */
  it("lo cubierto con un anticipo cruzado también salda", () => {
    expect(deudaDelCargo(cargo({ id: "a", amount: 140_000, advanceAppliedAmount: 140_000 }), HOY)).toBe(0);
    expect(
      deudaDelCargo(cargo({ id: "a", amount: 140_000, paymentAmount: 40_000, advanceAppliedAmount: 60_000 }), HOY),
    ).toBe(40_000);
  });

  it("nunca es negativa: un sobrepago viejo no genera deuda al revés", () => {
    expect(deudaDelCargo(cargo({ id: "a", amount: 100_000, paymentAmount: 150_000 }), HOY)).toBe(0);
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

  // Mismo criterio con el que se decide la mora. Separarse dejaría un cargo
  // «vencido» en una pantalla y «el más nuevo» en la siguiente.
  it("un cargo sin vencimiento cae a su período", () => {
    const orden = ordenarPorAntiguedad([
      cargo({ id: "julio", period: "2026-07" }),
      cargo({ id: "junio", period: "2026-06" }),
    ]).map((c) => c.id);
    expect(orden).toEqual(["junio", "julio"]);
  });

  /**
   * Sin desempate, dos cargos del mismo mes se ordenarían según cómo los
   * devolviera Firestore, y **la propuesta cambiaría entre dos llamadas
   * idénticas** sin que nadie hubiera tocado nada.
   */
  it("desempata por id, así que dos llamadas iguales proponen lo mismo", () => {
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

describe("repartirPorAntiguedad — la propuesta que devuelve el servidor", () => {
  const junio = cargo({ id: "junio", amount: 100_000, dueDate: "2026-06-05" });
  const julio = cargo({ id: "julio", amount: 100_000, dueDate: "2026-07-05" });
  const agosto = cargo({ id: "agosto", amount: 100_000, dueDate: "2026-08-05" });

  // CA3.
  it("cubre tres cargos en una sola operación, del más viejo al más nuevo", () => {
    const r = repartirPorAntiguedad([agosto, junio, julio], 300_000, HOY);
    expect(r.lineas).toEqual([
      { statementId: "junio", amount: 100_000 },
      { statementId: "julio", amount: 100_000 },
      { statementId: "agosto", amount: 100_000 },
    ]);
    expect(r.sobrante).toBe(0);
  });

  it("lo que no alcanza se queda en el más antiguo, y el resto no recibe nada", () => {
    const r = repartirPorAntiguedad([junio, julio], 60_000, HOY);
    expect(r.lineas).toEqual([{ statementId: "junio", amount: 60_000 }]);
    expect(r.sobrante).toBe(0);
  });

  // CA1/R2: lo que sobra no se evapora, sale nombrado.
  it("lo que sobra sale aparte, no repartido de más", () => {
    const r = repartirPorAntiguedad([cargo({ id: "j", amount: 140_000, dueDate: "2026-06-05" })], 200_000, HOY);
    expect(r.lineas).toEqual([{ statementId: "j", amount: 140_000 }]);
    expect(r.sobrante).toBe(60_000);
  });

  // CA8.
  it("un pago sin cargos pendientes es sobrante entero", () => {
    const saldado = cargo({ id: "s", amount: 100_000, paymentAmount: 100_000, dueDate: "2026-06-05" });
    expect(repartirPorAntiguedad([saldado], 50_000, HOY)).toEqual({ lineas: [], sobrante: 50_000 });
    expect(repartirPorAntiguedad([], 50_000, HOY)).toEqual({ lineas: [], sobrante: 50_000 });
  });

  /**
   * Un cargo saldado no genera línea NI DE CERO: `aplicarPago` no escribe
   * asientos de importe cero, y una fila de cero en la vista previa haría creer
   * que ese cargo recibió algo.
   */
  it("un cargo ya saldado se salta, no aparece con cero", () => {
    const saldado = cargo({ id: "saldado", amount: 100_000, advanceAppliedAmount: 100_000, dueDate: "2026-05-05" });
    const r = repartirPorAntiguedad([saldado, junio], 100_000, HOY);
    expect(r.lineas).toEqual([{ statementId: "junio", amount: 100_000 }]);
  });

  // R1: ni un céntimo se pierde ni se inventa.
  it("lo repartido más el sobrante es exactamente lo pagado", () => {
    for (const importe of [1, 99_999, 100_000, 250_000, 1_000_000]) {
      const r = repartirPorAntiguedad([junio, julio, agosto], importe, HOY);
      expect(r.lineas.reduce((s, l) => s + l.amount, 0) + r.sobrante).toBe(importe);
    }
  });

  it("un importe de cero o negativo no propone nada", () => {
    expect(repartirPorAntiguedad([junio], 0, HOY)).toEqual({ lineas: [], sobrante: 0 });
    expect(repartirPorAntiguedad([junio], -5, HOY)).toEqual({ lineas: [], sobrante: 0 });
  });

  /**
   * **El `hoy` se inyecta**, igual que en `calcularSaldo`. Sin eso, la propuesta
   * dependería de la hora a la que se pida y una prueba pasaría hoy y fallaría
   * el mes que viene — que es exactamente cómo se cuelan los defectos de fecha.
   */
  it("el reparto no depende de cuándo se pida", () => {
    const cargos = [junio, julio];
    expect(repartirPorAntiguedad(cargos, 150_000, "2026-01-01")).toEqual(
      repartirPorAntiguedad(cargos, 150_000, "2027-12-31"),
    );
  });
});
