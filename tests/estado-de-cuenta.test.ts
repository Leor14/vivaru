import { describe, expect, it } from "vitest";

import { construirEstadoDeCuenta } from "@/features/billing/estado-de-cuenta";
import type { BillingStatement } from "@/types/domain";

/**
 * `PRD-V-FEAT-004` — el estado de cuenta de la unidad.
 *
 * **Lo que estas pruebas vigilan de verdad es R2**, que la ficha llama «la que
 * hace confiable el documento»: si el estado de cuenta y la cartera pueden dar
 * cifras distintas, ninguno de los dos sirve. Por eso casi todas terminan
 * comparando el saldo final contra la suma de `balance` — que es exactamente la
 * cifra que el resto del producto ya enseña.
 *
 * Y vigilan **el cargo sin `dueDate`**, que es el que un `orderBy` habría hecho
 * desaparecer: 60 de 221 cargos de producción no lo tienen.
 */

const cargo = (over: Partial<BillingStatement> & { id: string }): BillingStatement => ({
  tenantId: "t",
  unitId: "u-101",
  unitLabel: "101",
  period: "2026-01",
  amount: 100_000,
  paymentAmount: 0,
  balance: 100_000,
  status: "pending",
  ...over,
});

describe("FEAT-004 · estado de cuenta", () => {
  it("CA1 · ordena y acumula el saldo movimiento a movimiento", () => {
    const e = construirEstadoDeCuenta([
      cargo({ id: "c3", period: "2026-03" }),
      cargo({ id: "c1", period: "2026-01" }),
      cargo({ id: "c2", period: "2026-02" }),
    ]);

    expect(e.lineas.map((l) => l.periodo)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(e.lineas.map((l) => l.saldoAcumulado)).toEqual([100_000, 200_000, 300_000]);
  });

  it("CA2 · el saldo final coincide con la suma de `balance` de los cargos vigentes", () => {
    const cargos = [
      cargo({ id: "c1", period: "2026-01", amount: 100_000, paymentAmount: 100_000, balance: 0, status: "paid" }),
      cargo({ id: "c2", period: "2026-02", amount: 100_000, paymentAmount: 40_000, balance: 60_000 }),
      cargo({ id: "c3", period: "2026-03", amount: 100_000, balance: 100_000 }),
    ];
    const e = construirEstadoDeCuenta(cargos);

    const sumaCartera = cargos.reduce((a, c) => a + (c.balance ?? 0), 0);
    expect(e.saldoFinal).toBe(sumaCartera);
    expect(e.saldoFinal).toBe(160_000);
    expect(e.totalCargado).toBe(300_000);
    expect(e.totalPagado).toBe(140_000);
  });

  it("el anticipo cruzado cuenta como pagado — si no, el estado de cuenta y la cartera discrepan", () => {
    // `advanceAppliedAmount` va aparte de `paymentAmount` desde FLOW-002, pero
    // `balance` ya resta los dos. Ignorarlo aquí dejaría «cargado − pagado»
    // distinto del saldo, que es justo lo que R2 prohíbe.
    const c = cargo({ id: "c1", amount: 100_000, paymentAmount: 30_000, advanceAppliedAmount: 70_000, balance: 0, status: "paid" });
    const e = construirEstadoDeCuenta([c]);

    expect(e.totalPagado).toBe(100_000);
    expect(e.saldoFinal).toBe(0);
    expect(e.alDia).toBe(true);
  });

  it("R2 · el saldo sale de `balance`, NO de «cargado − pagado» — y esta prueba es la que los distingue", () => {
    // Hoy las dos definiciones dan lo mismo en todo dato sano, así que sin un
    // caso donde DISCREPAN la afirmación de la cabecera no está comprobada.
    // Aquí `balance` no cuadra con `amount − paymentAmount` a propósito: es lo
    // que pasaría con un documento derivado o migrado a medias. El estado de
    // cuenta tiene que decir lo que dice la CARTERA, que es `balance`, o los dos
    // números se contradicen delante del residente.
    const e = construirEstadoDeCuenta([
      cargo({ id: "raro", amount: 100_000, paymentAmount: 10_000, balance: 55_000 }),
    ]);

    expect(e.saldoFinal).toBe(55_000);
    expect(e.saldoFinal).not.toBe(e.totalCargado - e.totalPagado);
    expect(e.lineas[0].saldoAcumulado).toBe(55_000);
  });

  it("CA9/R5 · un cargo anulado no aparece ni suma, y se dice cuántos se dejaron fuera", () => {
    const e = construirEstadoDeCuenta([
      cargo({ id: "vivo", period: "2026-01", balance: 100_000 }),
      cargo({ id: "anulado", period: "2026-02", amount: 250_000, balance: 0, status: "cancelled" }),
    ]);

    expect(e.lineas).toHaveLength(1);
    expect(e.lineas[0].statementId).toBe("vivo");
    expect(e.totalCargado).toBe(100_000);
    expect(e.saldoFinal).toBe(100_000);
    expect(e.anuladosExcluidos).toBe(1);
  });

  it("un cargo SIN `dueDate` entra igual — es el 27% de producción y un orderBy lo borraría", () => {
    const e = construirEstadoDeCuenta([
      cargo({ id: "con", period: "2026-01", dueDate: "2026-01-31", balance: 50_000 }),
      cargo({ id: "sin", period: "2026-02", balance: 70_000 }),
    ]);

    expect(e.lineas).toHaveLength(2);
    expect(e.lineas.find((l) => l.statementId === "sin")?.fuenteDeFecha).toBe("period");
    expect(e.saldoFinal).toBe(120_000);
  });

  /**
   * **La prueba que faltaba, y por eso esto llegó a producción.** Todas las demás
   * usan cargos cuyo `dueDate` cae en su propio mes, y con eso ordenar por fecha
   * o por período da lo mismo: el defecto no se podía manifestar.
   *
   * Estos tres son los datos REALES de `T2-503` en `tenant-santa-maria` el 26 de
   * agosto de 2026 — marzo y abril vencían el 28 de mayo—, y salían en pantalla
   * como `05 · 03 · 04`, con un saldo acumulado al lado que no se podía leer.
   */
  it("un cargo que vence en OTRO mes se lista por su período, no por su vencimiento", () => {
    const e = construirEstadoDeCuenta([
      cargo({ id: "may", period: "2026-05", amount: 400_000, balance: 400_000 }),
      cargo({ id: "mar", period: "2026-03", dueDate: "2026-05-28", amount: 400_000, balance: 400_000 }),
      cargo({ id: "abr", period: "2026-04", dueDate: "2026-05-28", amount: 400_000, paymentAmount: 400_000, balance: 0, status: "paid" }),
    ]);

    expect(e.lineas.map((l) => l.periodo)).toEqual(["2026-03", "2026-04", "2026-05"]);
    // Y el acumulado cuenta la historia en orden: se debe marzo, abril se pagó,
    // y mayo vuelve a subir. Con el orden viejo la primera fila decía 400.000
    // siendo mayo, que es el mes MÁS NUEVO de los tres.
    expect(e.lineas.map((l) => l.saldoAcumulado)).toEqual([400_000, 400_000, 800_000]);
    // R2 no cambia con el orden — y comprobarlo aquí es lo que separa «se ve
    // mejor» de «sigue cuadrando con la cartera».
    expect(e.saldoFinal).toBe(800_000);
  });

  it("dentro de un mismo mes, el vencimiento sigue desempatando", () => {
    const e = construirEstadoDeCuenta([
      cargo({ id: "b", period: "2026-06", dueDate: "2026-06-26" }),
      cargo({ id: "a", period: "2026-06", dueDate: "2026-06-25" }),
    ]);
    expect(e.lineas.map((l) => l.statementId)).toEqual(["a", "b"]);
  });

  it("el orden es determinista entre dos descargas, aunque los cargos lleguen barajados", () => {
    const cargos = [
      cargo({ id: "b", period: "2026-01" }),
      cargo({ id: "a", period: "2026-01" }),
      cargo({ id: "c", period: "2026-01" }),
    ];
    const uno = construirEstadoDeCuenta(cargos).lineas.map((l) => l.statementId);
    const dos = construirEstadoDeCuenta([...cargos].reverse()).lineas.map((l) => l.statementId);

    expect(uno).toEqual(["a", "b", "c"]);
    expect(dos).toEqual(uno);
  });

  it("CA6 · una unidad sin movimientos sale vacía y AL DÍA — no deber nada es no deber nada", () => {
    const e = construirEstadoDeCuenta([]);
    expect(e.lineas).toHaveLength(0);
    expect(e.saldoFinal).toBe(0);
    expect(e.alDia).toBe(true);
  });

  it("el rango de fechas filtra sin romper el mes de los extremos", () => {
    const cargos = [
      cargo({ id: "ene", period: "2026-01" }),
      cargo({ id: "feb", period: "2026-02" }),
      cargo({ id: "mar", period: "2026-03" }),
    ];
    // `2026-02-01`..`2026-02-28` contra un cargo fechado `2026-02` como cadena:
    // sin recortar el límite, «2026-02» < «2026-02-01» y febrero se perdería.
    const e = construirEstadoDeCuenta(cargos, { desde: "2026-02-01", hasta: "2026-02-28" });
    expect(e.lineas.map((l) => l.statementId)).toEqual(["feb"]);
  });

  it("CF1 · con saldo pendiente NO está al día", () => {
    expect(construirEstadoDeCuenta([cargo({ id: "c", balance: 1 })]).alDia).toBe(false);
  });
});
