import { describe, expect, it } from "vitest";

import {
  construirInstantanea,
  detallarCarteraPorUnidad,
  detallarDeudaAProveedores,
  finDelPeriodo,
  idDelInforme,
  sumarSaldoDeApertura,
} from "../src/informe-mensual";

/**
 * `PRD-V-FLOW-007` entrega 2 — las cifras del informe, con números a mano.
 *
 * **Escritos a mano y no derivados del código**, que es lo que `CA1` exige con
 * esas palabras: «no vale comprobar que existe un import». Un banco que calcula
 * el esperado con la misma función que prueba pasa siempre y no vigila nada.
 *
 * Lo que se vigila aquí es el **desglose** que añade la entrega 2 —cartera por
 * unidad y deuda por proveedor— y su relación con los totales del núcleo, que es
 * donde puede nacer la contradicción: un informe que enseña un total y unas filas
 * que no lo suman.
 */

describe("finDelPeriodo — la fecha contra la que se mide lo vencido", () => {
  it("da el último día del mes, sin tabla de días escrita a mano", () => {
    expect(finDelPeriodo("2026-01")).toBe("2026-01-31");
    expect(finDelPeriodo("2026-04")).toBe("2026-04-30");
    expect(finDelPeriodo("2026-12")).toBe("2026-12-31");
  });

  it("y acierta en febrero, incluido el bisiesto", () => {
    // 2026 no es bisiesto; 2028 sí. Una tabla a mano se equivoca justo aquí.
    expect(finDelPeriodo("2026-02")).toBe("2026-02-28");
    expect(finDelPeriodo("2028-02")).toBe("2028-02-29");
  });
});

describe("sumarSaldoDeApertura — `CA4`, cero de verdad contra falta de dato", () => {
  it("sin NINGÚN documento devuelve undefined, no cero", () => {
    // Sumar sobre una lista vacía daría 0 y afirmaría que el conjunto abrió sin
    // un peso. Nadie hizo esa afirmación.
    expect(sumarSaldoDeApertura([])).toBeUndefined();
  });

  it("un cero REGISTRADO es un dato y vale cero", () => {
    expect(sumarSaldoDeApertura([{ openingBalance: 0 }])).toBe(0);
  });

  it("suma varias cuentas del conjunto", () => {
    expect(sumarSaldoDeApertura([{ openingBalance: 85_000 }, { openingBalance: 5_000_000 }])).toBe(5_085_000);
  });

  it("ignora lo que no es un número finito, sin dejar de contar el resto", () => {
    expect(
      sumarSaldoDeApertura([
        { openingBalance: 1_000 },
        { openingBalance: undefined },
        { openingBalance: Number.NaN },
      ]),
    ).toBe(1_000);
  });
});

describe("detallarCarteraPorUnidad — el desglose suma el total", () => {
  const cargos = [
    { unitId: "u-101", unitLabel: "APTO 101", balance: 300_000, status: "overdue", period: "2026-01" },
    { unitId: "u-101", unitLabel: "APTO 101", balance: 200_000, status: "pending", period: "2026-02" },
    { unitId: "u-202", unitLabel: "APTO 202", balance: 150_000, status: "overdue", period: "2026-02" },
    // Ni el anulado ni el pagado cuentan, igual que en `sumarCuentasPorCobrar`.
    { unitId: "u-303", unitLabel: "APTO 303", balance: 900_000, status: "cancelled", period: "2026-02" },
    { unitId: "u-404", unitLabel: "APTO 404", balance: 0, status: "paid", period: "2026-02" },
  ];

  it("agrupa por unidad y cuenta los períodos, no los cargos", () => {
    const filas = detallarCarteraPorUnidad(cargos);
    expect(filas).toEqual([
      { unitId: "u-101", unitLabel: "APTO 101", balance: 500_000, periods: 2 },
      { unitId: "u-202", unitLabel: "APTO 202", balance: 150_000, periods: 1 },
    ]);
  });

  it("ordena por deuda descendente: el consejo lee primero al que más debe", () => {
    expect(detallarCarteraPorUnidad(cargos).map((f) => f.unitLabel)).toEqual(["APTO 101", "APTO 202"]);
  });

  /**
   * **La comprobación que importa de verdad.** Total y desglose salen de dos
   * funciones distintas —`sumarCuentasPorCobrar` del núcleo y esta—, así que
   * podrían discrepar; si lo hicieran, el informe se contradiría consigo mismo
   * entre la cifra grande y las filas de debajo, que es peor que estar mal.
   */
  it("las filas SUMAN el total que el informe imprime al lado", () => {
    const instantanea = construirInstantanea({
      period: "2026-02",
      cargos,
      asientos: [],
      recaudado: 0,
      saldos: [],
      egresos: [],
    });
    const sumaDeLasFilas = instantanea.receivables.byUnit.reduce((a, f) => a + f.balance, 0);
    expect(sumaDeLasFilas).toBe(instantanea.receivables.total);
    expect(instantanea.receivables.total).toBe(650_000);
  });

  it("un sobrepago no tapa la deuda de otro: se topa en cero POR cargo", () => {
    const filas = detallarCarteraPorUnidad([
      { unitId: "u-1", unitLabel: "A", balance: -50_000, status: "pending", period: "2026-02" },
      { unitId: "u-2", unitLabel: "B", balance: 100_000, status: "pending", period: "2026-02" },
    ]);
    expect(filas).toEqual([{ unitId: "u-2", unitLabel: "B", balance: 100_000, periods: 1 }]);
  });
});

describe("detallarDeudaAProveedores — `R5`, la fuente son los EGRESOS", () => {
  const egresos = [
    { amount: 4_890_000, status: "registrado", vendorName: "Aseo Total", dueDate: "2026-02-10" },
    { amount: 1_000_000, status: "registrado", vendorName: "Aseo Total", dueDate: "2026-03-15" },
    { amount: 500_000, status: "registrado", vendorName: "", dueDate: "2026-01-05" },
    // `pagado` y `anulado` NO son deuda. El catálogo es castellano.
    { amount: 9_000_000, status: "pagado", vendorName: "Ascensores SA", dueDate: "2026-01-01" },
    { amount: 7_000_000, status: "anulado", vendorName: "Ascensores SA", dueDate: "2026-01-01" },
  ];

  it("agrupa por el nombre congelado en el egreso, no por `vendors`", () => {
    // `vendors` tiene CERO filas en producción y ningún egreso lleva `vendorId`.
    // Quien cobra está en la factura que nadie ha pagado.
    const r = detallarDeudaAProveedores(egresos, "2026-02-28");
    expect(r.byVendor).toEqual([
      { vendorName: "Aseo Total", amount: 5_890_000 },
      { vendorName: "Sin proveedor identificado", amount: 500_000 },
    ]);
  });

  it("filtrar en inglés no excluiría nada: `pagado` y `anulado` quedan fuera", () => {
    const r = detallarDeudaAProveedores(egresos, "2026-02-28");
    const total = r.byVendor.reduce((a, v) => a + v.amount, 0);
    // Con el filtro en inglés entrarían los 16.000.000 pagados y anulados.
    expect(total).toBe(6_390_000);
  });

  /**
   * **Lo vencido se mide contra el fin del PERÍODO, no contra hoy.**
   *
   * Un informe de febrero emitido en junio diría, con «hoy», que estaba vencido
   * lo que en febrero no lo estaba: las cifras congeladas dejarían de describir
   * el mes que dicen describir.
   */
  it("mide lo vencido contra el cierre del mes del informe", () => {
    // Al 28 de febrero: vencen la de 10-feb y la de 05-ene. La de 15-mar no.
    expect(detallarDeudaAProveedores(egresos, "2026-02-28").overdue).toBe(5_390_000);
    // Al 31 de marzo vence también aquella. El mismo dato, otro corte.
    expect(detallarDeudaAProveedores(egresos, "2026-03-31").overdue).toBe(6_390_000);
  });

  it("un egreso SIN vencimiento no se cuenta como vencido: no se sabe cuándo vencía", () => {
    const r = detallarDeudaAProveedores([{ amount: 300_000, status: "registrado", vendorName: "X" }], "2026-12-31");
    expect(r.overdue).toBe(0);
    expect(r.byVendor).toEqual([{ vendorName: "X", amount: 300_000 }]);
  });
});

/**
 * **El `type` del asiento es CASTELLANO: `ingreso` / `egreso`.**
 *
 * Estos casos nacieron en inglés y salieron en rojo con `totalIncome` en cero:
 * el núcleo no lanza ante un `type` que no conoce, simplemente **no acumula**.
 * Es el mismo tropiezo que triplicó la deuda a proveedores al medir en
 * producción —filtrar `ExpenseStatus` por `"paid"` no excluye nada—, cometido
 * aquí dentro por quien acababa de escribirlo. Se deja anotado porque el error
 * es del que no avisa: una cifra en cero se lee como un dato.
 */
describe("construirInstantanea — la cara del informe", () => {
  /** El caso de Las Playas: 85.000 de apertura, medido en producción el 3 sep. */
  it("`CA2`/`CA3` · saldo final = inicial + ingresos − egresos", () => {
    const i = construirInstantanea({
      period: "2026-02",
      cargos: [],
      asientos: [
        { type: "egreso", category: "mantenimiento", amount: 20_000 },
        { type: "ingreso", category: "otros_ingresos", amount: 5_000 },
      ],
      recaudado: 0,
      saldos: [{ openingBalance: 85_000 }],
      egresos: [],
    });
    expect(i.openingBalance).toBe(85_000);
    expect(i.openingBalanceSource).toBe("registrado");
    expect(i.totalIncome).toBe(5_000);
    expect(i.totalExpenses).toBe(20_000);
    // 85.000 + 5.000 − 20.000 = 70.000, a mano.
    expect(i.closingBalance).toBe(70_000);
  });

  it("`CA4` · sin saldo registrado, `openingBalance` vale 0 pero la FUENTE lo delata", () => {
    const i = construirInstantanea({
      period: "2026-02",
      cargos: [],
      asientos: [],
      recaudado: 0,
      saldos: [],
      egresos: [],
    });
    // El campo es un número —guardar `undefined` obligaría a cada lector a
    // reinventar la distinción—, y quien la sostiene es `openingBalanceSource`.
    expect(i.openingBalance).toBe(0);
    expect(i.openingBalanceSource).toBe("ausente");
  });

  it("`CA8` · las dos partidas van SIEMPRE, también en cero calculado", () => {
    const i = construirInstantanea({
      period: "2026-02",
      cargos: [],
      asientos: [],
      recaudado: 0,
      saldos: [{ openingBalance: 0 }],
      egresos: [],
    });
    // No `undefined` ni ausentes: un cero calculado dice «no se debe nada», y una
    // sección que falta dice «esto no se mide». Para un consejo son dos cosas.
    expect(i.receivables).toEqual({ total: 0, byUnit: [] });
    expect(i.payables).toEqual({ total: 0, overdue: 0, byVendor: [] });
  });

  it("`RN-07` · los egresos salen en el orden del PLAN, no por monto", () => {
    const i = construirInstantanea({
      period: "2026-02",
      cargos: [],
      asientos: [
        { type: "egreso", accountCode: "5.3", category: "mantenimiento", amount: 900_000 },
        { type: "egreso", accountCode: "5.1", category: "nomina", amount: 100_000 },
        { type: "egreso", accountCode: "5.2", category: "servicios_publicos", amount: 500_000 },
      ],
      recaudado: 0,
      saldos: [],
      egresos: [],
      plan: {
        codigoPorSystemKey: new Map(),
        nombrePorCodigo: new Map([
          ["5.1", "Nómina"],
          ["5.2", "Servicios públicos"],
          ["5.3", "Mantenimiento"],
        ]),
      },
    });
    // Por monto saldría 5.3 primero (900.000). Va por el código.
    expect(i.expenses.map((l) => l.code)).toEqual(["5.1", "5.2", "5.3"]);
  });
});

describe("idDelInforme — un conjunto tiene UN informe por mes", () => {
  it("es determinista, y por eso la segunda corrida encuentra la primera", () => {
    expect(idDelInforme("tenant-santa-maria", "2026-02")).toBe("tenant-santa-maria_2026-02");
  });

  it("lleva el conjunto por delante: `monthlyReports` es una colección RAÍZ", () => {
    // La lección de `units`: un id de documento es GLOBAL, y dos conjuntos con
    // el mismo período se pisarían el informe si el id fuera solo el mes.
    expect(idDelInforme("a", "2026-02")).not.toBe(idDelInforme("b", "2026-02"));
  });
});
