import { describe, expect, it } from "vitest";

import { computeFundPosition } from "@/features/finanzas/use-ledger";
import { errorDeTraspaso, saldoNegativoTrasTraspaso, saldosPorCuenta, type CuentaDeTesoreria } from "@/lib/finanzas/tesoreria";
import type { LedgerEntry } from "@/types/domain";

/**
 * `PRD-V-FEAT-010` entrega 1 · el saldo por cuenta, con números puestos a mano.
 *
 * Cada cifra esperada está calculada en el comentario de su prueba, no copiada
 * de la salida: una prueba que copia la salida consagra el defecto.
 */

const CUENTAS: CuentaDeTesoreria[] = [
  { id: "a", label: "Corriente", bankName: "BBVA", accountType: "corriente", active: true },
  { id: "b", label: "Ahorros", bankName: "Santander", accountType: "ahorros", active: false },
];

const asiento = (a: Partial<LedgerEntry> & Pick<LedgerEntry, "type" | "amount">): LedgerEntry =>
  ({ id: Math.random().toString(36).slice(2), tenantId: "t", date: "2026-09-01", concept: "x", ...a }) as LedgerEntry;

const ASIENTOS: LedgerEntry[] = [
  asiento({ type: "ingreso", amount: 500, bankAccountId: "a", sourceType: "billingStatement" }), // recaudo
  asiento({ type: "egreso", amount: 200, bankAccountId: "a", sourceType: "expense" }),
  asiento({ type: "ingreso", amount: -100, bankAccountId: "a", sourceType: "reversal", reversedSourceType: "billingStatement" } as Partial<LedgerEntry> & Pick<LedgerEntry, "type" | "amount">), // reverso de recaudo
  asiento({ type: "egreso", amount: 50, bankAccountId: "b", sourceType: "expense" }),
  asiento({ type: "egreso", amount: -20, bankAccountId: "b", sourceType: "reversal" }), // reverso de un gasto: el dinero vuelve
  asiento({ type: "ingreso", amount: 30, sourceType: "manual" }), // sin cuenta
  asiento({ type: "egreso", amount: 10, bankAccountId: "z", sourceType: "expense" }), // cuenta que ya no existe
];

const SALDOS = [{ id: "a", openingBalance: 1000 }];
const CUOTA = 900; // lo cobrado según Cartera

describe("el saldo de cada cuenta", () => {
  const t = saldosPorCuenta({ cuentas: CUENTAS, saldosIniciales: SALDOS, asientos: ASIENTOS, cuotaIncome: CUOTA });
  const a = t.cuentas.find((f) => f.id === "a")!;
  const b = t.cuentas.find((f) => f.id === "b")!;

  it("A: 1000 de saldo inicial + 500 − 200 − 100 (el reverso del recaudo SALE) = 1200", () => {
    expect(a).toMatchObject({ saldoInicial: 1000, entradas: 500, salidas: 300, saldo: 1200, movimientos: 3 });
  });

  it("B: sin saldo inicial — `null`, no cero —; −50 + 20 (anular un gasto devuelve el dinero) = −30", () => {
    expect(b).toMatchObject({ saldoInicial: null, entradas: 20, salidas: 50, saldo: -30 });
  });

  it("`RN-13` · la cuenta desactivada sigue, y va detrás de las activas", () => {
    expect(t.cuentas.map((f) => f.id)).toEqual(["a", "b"]);
    expect(b.activa).toBe(false);
  });

  it("`RN-03` · el asiento sin cuenta suma aparte, con cuántos son", () => {
    expect(t.sinCuenta).toMatchObject({ monto: 30, cantidad: 1 });
  });

  it("el movimiento de una cuenta que ya no existe no se pierde: tiene su línea", () => {
    expect(t.cuentasQueYaNoExisten).toMatchObject({ salidas: 10, saldo: -10 });
  });

  it("`RN-04` · cobrado en Cartera sin asiento: 900 − (500 − 100) = 500", () => {
    expect(t.cobradoSinAsiento).toBe(500);
  });

  it("`RN-04` · el total ES el saldo de fondos: 1000 + 900 + 30 − (200 + 50 − 20 + 10) = 1690", () => {
    expect(t.total).toBe(1690);
    expect(t.total).toBe(computeFundPosition(ASIENTOS, CUOTA, 1000).balance);
  });

  it("y las líneas lo explican entero: 1200 − 30 − 10 + 30 + 500 = 1690, sin nada sin explicar", () => {
    expect(t.sinExplicar).toBe(0);
  });
});

describe("casos límite", () => {
  it("sin ningún saldo inicial registrado, el total sigue cuadrando", () => {
    const t = saldosPorCuenta({ cuentas: CUENTAS, saldosIniciales: [], asientos: ASIENTOS, cuotaIncome: CUOTA });
    expect(t.cuentas.every((f) => f.saldoInicial === null)).toBe(true);
    // 0 + 900 + 30 − 240 = 690
    expect(t.total).toBe(690);
    expect(t.sinExplicar).toBe(0);
  });

  it("el saldo inicial de una cuenta que ya no existe va a su línea, y el total lo incluye", () => {
    const t = saldosPorCuenta({
      cuentas: CUENTAS, saldosIniciales: [...SALDOS, { id: "z", openingBalance: 5 }], asientos: ASIENTOS, cuotaIncome: CUOTA,
    });
    expect(t.cuentasQueYaNoExisten).toMatchObject({ saldoInicial: 5, saldo: -5 });
    expect(t.total).toBe(1695);
    expect(t.sinExplicar).toBe(0);
  });

  it("un conjunto sin cuentas: todo el dinero sale en las líneas, y cuadra", () => {
    const t = saldosPorCuenta({ cuentas: [], saldosIniciales: [], asientos: [asiento({ type: "ingreso", amount: 30 })], cuotaIncome: 100 });
    expect(t.cuentas).toEqual([]);
    expect(t.sinCuenta.monto).toBe(30);
    expect(t.cobradoSinAsiento).toBe(100);
    expect(t.total).toBe(130);
    expect(t.sinExplicar).toBe(0);
  });

  it("Santa María, en pequeño: cuenta registrada pero ningún asiento la lleva", () => {
    const t = saldosPorCuenta({
      cuentas: [CUENTAS[0]], saldosIniciales: [{ id: "a", openingBalance: 725_000 }],
      asientos: [asiento({ type: "egreso", amount: 100_000 }), asiento({ type: "ingreso", amount: 50_000 })], cuotaIncome: 0,
    });
    expect(t.cuentas[0]).toMatchObject({ movimientos: 0, saldo: 725_000 });
    expect(t.sinCuenta).toMatchObject({ monto: -50_000, cantidad: 2 });
    expect(t.total).toBe(675_000);
    expect(t.sinExplicar).toBe(0);
  });
});

describe("entrega 2a · los traspasos", () => {
  const conTraspasos = (traspasos: Parameters<typeof saldosPorCuenta>[0]["traspasos"]) =>
    saldosPorCuenta({ cuentas: CUENTAS, saldosIniciales: SALDOS, asientos: ASIENTOS, cuotaIncome: CUOTA, traspasos });

  it("`CA4` · de A a B por 300: A baja a 1200 − 300 = 900 y B sube a −30 + 300 = 270", () => {
    const t = conTraspasos([{ fromAccountId: "a", toAccountId: "b", amount: 300, status: "registrado" }]);
    expect(t.cuentas.find((f) => f.id === "a")).toMatchObject({ traspasos: -300, saldo: 900 });
    expect(t.cuentas.find((f) => f.id === "b")).toMatchObject({ traspasos: 300, saldo: 270 });
  });

  it("`RN-02` · y el saldo de fondos no se mueve: sigue en 1690, sin nada sin explicar", () => {
    const t = conTraspasos([{ fromAccountId: "a", toAccountId: "b", amount: 300, status: "registrado" }]);
    expect(t.total).toBe(1690);
    expect(t.sinExplicar).toBe(0);
  });

  it("`RN-05` / `RN-06` · un traspaso ANULADO no cuenta en ningún saldo", () => {
    const t = conTraspasos([{ fromAccountId: "a", toAccountId: "b", amount: 300, status: "anulado" }]);
    expect(t.cuentas.find((f) => f.id === "a")).toMatchObject({ traspasos: 0, saldo: 1200 });
  });

  it("hacia una cuenta que ya no existe: sale de A y aparece en su línea, y el total no cambia", () => {
    const t = conTraspasos([{ fromAccountId: "a", toAccountId: "fantasma", amount: 50, status: "registrado" }]);
    expect(t.cuentas.find((f) => f.id === "a")?.saldo).toBe(1150);
    expect(t.cuentasQueYaNoExisten?.traspasos).toBe(50);
    expect(t.total).toBe(1690);
    expect(t.sinExplicar).toBe(0);
  });

  it("un importe roto (cero o no numérico) se ignora en vez de romper el saldo", () => {
    const t = conTraspasos([
      { fromAccountId: "a", toAccountId: "b", amount: 0, status: "registrado" },
      { fromAccountId: "a", toAccountId: "b", amount: Number.NaN, status: "registrado" },
    ]);
    expect(t.cuentas.find((f) => f.id === "a")?.saldo).toBe(1200);
  });
});

describe("entrega 2a · el formulario", () => {
  const hoy = new Date(2026, 8, 10, 23, 30);
  const bueno = { fromAccountId: "a", toAccountId: "b", amount: "300000", date: "2026-09-10" };

  it("un traspaso correcto no da error", () => {
    expect(errorDeTraspaso(bueno, hoy)).toBeNull();
  });

  it("origen y destino distintos, valor positivo, fecha real y no futura", () => {
    expect(errorDeTraspaso({ ...bueno, toAccountId: "a" }, hoy)).toMatch(/distintas/);
    expect(errorDeTraspaso({ ...bueno, toAccountId: "" }, hoy)).toMatch(/Elige/);
    expect(errorDeTraspaso({ ...bueno, amount: "0" }, hoy)).toMatch(/mayor que cero/);
    expect(errorDeTraspaso({ ...bueno, amount: "abc" }, hoy)).toMatch(/mayor que cero/);
    expect(errorDeTraspaso({ ...bueno, date: "2026-02-30" }, hoy)).toMatch(/no existe/);
    expect(errorDeTraspaso({ ...bueno, date: "2026-09-11" }, hoy)).toMatch(/posterior/);
  });

  it("`RN-09` · avisa del saldo con el que quedaría el origen si queda negativo, y solo entonces", () => {
    expect(saldoNegativoTrasTraspaso({ saldo: 1200 }, 1500)).toBe(-300);
    expect(saldoNegativoTrasTraspaso({ saldo: 1200 }, 1200)).toBeNull();
    expect(saldoNegativoTrasTraspaso(undefined, 100)).toBeNull();
  });
});

