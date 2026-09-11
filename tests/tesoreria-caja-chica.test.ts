import { describe, expect, it } from "vitest";

import { computeFundPosition } from "@/features/finanzas/use-ledger";
import {
  devolucionAlCerrar,
  errorDeApertura,
  excesoSobreElLimite,
  propuestaDeReposicion,
  saldosPorCuenta,
  type CajaDeTesoreria,
  type CuentaDeTesoreria,
} from "@/lib/finanzas/tesoreria";
import type { LedgerEntry, TreasuryTransfer } from "@/types/domain";

/**
 * `PRD-V-FEAT-010` entrega 3 · la caja chica, con números puestos a mano.
 *
 * Una cuenta de banco con 1.000.000 de saldo inicial y una caja de portería con
 * límite de 500.000. Cada cifra esperada está calculada en el nombre de su
 * prueba, no copiada de la salida.
 */

const BANCO: CuentaDeTesoreria[] = [{ id: "a", label: "Corriente", bankName: "BBVA", accountType: "corriente", active: true }];
const SALDOS = [{ id: "a", openingBalance: 1_000_000 }];
const CAJA: CajaDeTesoreria = { id: "caja", name: "Portería", limit: 500_000, status: "abierta" };
const VIEJA: CajaDeTesoreria = { id: "vieja", name: "Vieja", limit: 100_000, status: "cerrada" };

type Mov = Pick<TreasuryTransfer, "fromAccountId" | "toAccountId" | "amount" | "status">;
const APERTURA: Mov = { fromAccountId: "a", toAccountId: "caja", amount: 500_000, status: "registrado" };

const gasto = (amount: number, bankAccountId = "caja"): LedgerEntry =>
  ({ id: Math.random().toString(36).slice(2), tenantId: "t", date: "2026-09-05", concept: "gasto menor", type: "egreso", amount, bankAccountId, sourceType: "expense" }) as LedgerEntry;
const GASTOS = [gasto(120_000), gasto(30_000)];

const tesoreria = (asientos: LedgerEntry[], traspasos: Mov[], cajas: CajaDeTesoreria[] = [CAJA]) =>
  saldosPorCuenta({ cuentas: BANCO, saldosIniciales: SALDOS, asientos, cuotaIncome: 0, traspasos, cajas });
const fila = (t: ReturnType<typeof tesoreria>, id: string) => t.cuentas.find((f) => f.id === id)!;

describe("`CA8` · abrir la caja", () => {
  const t = tesoreria([], [APERTURA]);

  it("el banco baja 1.000.000 − 500.000 = 500.000, y la caja sube hasta su límite, 500.000", () => {
    expect(fila(t, "a").saldo).toBe(500_000);
    expect(fila(t, "caja")).toMatchObject({ saldo: 500_000, traspasos: 500_000, caja: { limite: 500_000 }, activa: true });
  });

  it("el saldo de fondos no se entera: sigue en 1.000.000, y nada queda sin explicar", () => {
    expect(t.total).toBe(1_000_000);
    expect(t.total).toBe(computeFundPosition([], 0, 1_000_000).balance);
    expect(t.sinExplicar).toBe(0);
  });

  it("una apertura anulada no cuenta: la caja vuelve a cero", () => {
    expect(fila(tesoreria([], [{ ...APERTURA, status: "anulado" }]), "caja").saldo).toBe(0);
  });
});

describe("`CA9` · un egreso pagado desde la caja", () => {
  const t = tesoreria(GASTOS, [APERTURA]);

  it("baja la caja: 500.000 − 120.000 − 30.000 = 350.000; el banco no se mueve", () => {
    expect(fila(t, "caja")).toMatchObject({ salidas: 150_000, saldo: 350_000 });
    expect(fila(t, "a").saldo).toBe(500_000);
  });

  it("y cuenta en el estado financiero como cualquier egreso: 1.000.000 − 150.000 = 850.000", () => {
    expect(t.total).toBe(850_000);
    expect(t.total).toBe(computeFundPosition(GASTOS, 0, 1_000_000).balance);
    expect(t.sinExplicar).toBe(0);
  });

  it("sin pasarle las cajas, esos gastos caerían en «cuentas que ya no están» — por eso se le pasan", () => {
    const ciega = saldosPorCuenta({ cuentas: BANCO, saldosIniciales: SALDOS, asientos: GASTOS, cuotaIncome: 0, traspasos: [APERTURA] });
    expect(ciega.cuentasQueYaNoExisten?.saldo).toBe(350_000);
    expect(t.cuentasQueYaNoExisten).toBeNull();
  });
});

describe("`CA10` · `RN-11` · reponer", () => {
  const antes = tesoreria(GASTOS, [APERTURA]);

  it("propone exactamente lo gastado desde la última reposición: 120.000 + 30.000 = 150.000", () => {
    expect(propuestaDeReposicion(fila(antes, "caja"))).toBe(150_000);
  });

  it("y la caja vuelve a su límite, 500.000; el banco baja a 350.000; el total no cambia", () => {
    const despues = tesoreria(GASTOS, [APERTURA, { fromAccountId: "a", toAccountId: "caja", amount: 150_000, status: "registrado" }]);
    expect(fila(despues, "caja").saldo).toBe(500_000);
    expect(fila(despues, "a").saldo).toBe(350_000);
    expect(despues.total).toBe(antes.total);
    expect(propuestaDeReposicion(fila(despues, "caja"))).toBe(0);
  });

  it("si la reposición anterior fue parcial (100.000 de 150.000), propone lo que falta para el límite: 50.000", () => {
    const parcial = tesoreria(GASTOS, [APERTURA, { fromAccountId: "a", toAccountId: "caja", amount: 100_000, status: "registrado" }]);
    expect(propuestaDeReposicion(fila(parcial, "caja"))).toBe(50_000);
  });

  it("una cuenta bancaria no tiene propuesta de reposición", () => {
    expect(propuestaDeReposicion(fila(antes, "a"))).toBe(0);
  });
});

describe("`CA11` · `RN-09` · pasar del límite avisa con la cifra, y no bloquea", () => {
  const caja = fila(tesoreria(GASTOS, [APERTURA]), "caja");

  it("reponer 200.000 sobre 350.000 deja 550.000: pasa del límite por 50.000", () => {
    expect(excesoSobreElLimite(caja, 200_000)).toBe(50_000);
  });

  it("reponer justo lo propuesto, 150.000, no avisa", () => {
    expect(excesoSobreElLimite(caja, 150_000)).toBeNull();
  });

  it("sin importe, o sobre una cuenta bancaria, no hay aviso", () => {
    expect(excesoSobreElLimite(caja, 0)).toBeNull();
    expect(excesoSobreElLimite(caja, Number.NaN)).toBeNull();
    expect(excesoSobreElLimite(fila(tesoreria(GASTOS, [APERTURA]), "a"), 900_000)).toBeNull();
  });
});

describe("§6 · cerrar exige saldo cero", () => {
  it("con 350.000 dentro, el cierre devuelve 350.000; en cero, nada", () => {
    expect(devolucionAlCerrar({ saldo: 350_000 })).toBe(350_000);
    expect(devolucionAlCerrar({ saldo: 0 })).toBe(0);
  });

  it("en negativo no se cierra: cerrarla escondería la diferencia", () => {
    expect(devolucionAlCerrar({ saldo: -10_000 })).toBeNull();
  });

  it("una caja cerrada y en cero ya no sale en la tesorería", () => {
    expect(tesoreria([], [APERTURA], [CAJA, VIEJA]).cuentas.map((f) => f.id)).toEqual(["a", "caja"]);
  });

  it("`RN-13` · cerrada con saldo sí sigue, marcada y detrás: un gasto de 10.000 la deja en −10.000", () => {
    const t = tesoreria([gasto(10_000, "vieja")], [APERTURA], [CAJA, VIEJA]);
    expect(t.cuentas.map((f) => f.id)).toEqual(["a", "caja", "vieja"]);
    expect(fila(t, "vieja")).toMatchObject({ saldo: -10_000, activa: false });
    expect(t.sinExplicar).toBe(0);
  });
});

describe("el orden de la tabla", () => {
  it("los bancos van primero aunque la caja se llame «Alcancía» y ordene antes por nombre", () => {
    const t = tesoreria([], [APERTURA], [{ ...CAJA, name: "Alcancía" }]);
    expect(t.cuentas.map((f) => f.id)).toEqual(["a", "caja"]);
  });
});

describe("el formulario de apertura", () => {
  const hoy = new Date(2026, 8, 10);
  const valida = { name: "Portería", limit: "500000", sourceAccountId: "a", date: "2026-09-10" };

  it("una apertura completa pasa", () => {
    expect(errorDeApertura(valida, hoy)).toBeNull();
  });

  it("pide nombre, cuenta de origen, un límite mayor que cero y una fecha que no sea futura", () => {
    expect(errorDeApertura({ ...valida, name: "  " }, hoy)).toBe("Ponle un nombre a la caja.");
    expect(errorDeApertura({ ...valida, sourceAccountId: "" }, hoy)).toBe("Elige la cuenta de la que sale el dinero.");
    expect(errorDeApertura({ ...valida, limit: "0" }, hoy)).toBe("El límite tiene que ser un número mayor que cero.");
    expect(errorDeApertura({ ...valida, limit: "" }, hoy)).toBe("El límite tiene que ser un número mayor que cero.");
    expect(errorDeApertura({ ...valida, date: "" }, hoy)).toBe("Falta la fecha de la apertura.");
    expect(errorDeApertura({ ...valida, date: "2026-09-11" }, hoy)).toBe("La fecha no puede ser posterior a hoy.");
  });
});
