import { describe, expect, it } from "vitest";

import { enumerar, frasesDelRecibo, nombreDelCargo, periodoLegible } from "../src/aviso-recibo";

/**
 * `PRD-V-FLOW-002` §9 y **CA13** — el aviso nombra los cargos cubiertos y el
 * saldo a favor.
 *
 * Es texto que llega a una persona en tres países, así que se prueba la cadena
 * exacta. Lo que más se prueba aquí no es el caso bonito sino **el hueco**: el
 * pago sin sobrante, que es la mayoría, y el pago que no cubre ningún cargo.
 */

const money = (v: number) => `$${Math.round(v).toLocaleString("es-CO")}`;

describe("CA13 · la frase de los cargos cubiertos", () => {
  it("un solo cargo, con el término del país", () => {
    const r = frasesDelRecibo({
      cargos: [{ concept: "administracion", period: "2026-08" }],
      saldoAFavor: 0,
      terminoCuota: "cuota de mantenimiento",
      formatMoney: money,
    });
    expect(r.cargos).toBe("Cubrió la cuota de mantenimiento de agosto de 2026.");
  });

  it("dos cargos van con «y», no con coma", () => {
    const r = frasesDelRecibo({
      cargos: [
        { concept: "administracion", period: "2026-08" },
        { concept: "multa", period: "2026-06" },
      ],
      saldoAFavor: 0,
      terminoCuota: "cuota de administración",
      formatMoney: money,
    });
    expect(r.cargos).toBe("Cubrió la cuota de administración de agosto de 2026 y la multa de junio de 2026.");
  });

  it("tres cargos: comas y una sola «y» al final", () => {
    const r = frasesDelRecibo({
      cargos: [
        { concept: "administracion", period: "2026-08" },
        { concept: "multa", period: "2026-06" },
        { concept: "parqueadero", period: "2026-07" },
      ],
      saldoAFavor: 0,
      terminoCuota: "cuota mensual",
      formatMoney: money,
    });
    expect(r.cargos).toBe(
      "Cubrió la cuota mensual de agosto de 2026, la multa de junio de 2026 y el parqueadero de julio de 2026.",
    );
  });

  /**
   * **CA8: un pago sin cargos pendientes se convierte íntegro en anticipo.** No
   * hay nada que enumerar, y «Cubrió .» sería peor que callar.
   */
  it("un pago que no cubrió ningún cargo no dice nada de cargos", () => {
    const r = frasesDelRecibo({
      cargos: [],
      saldoAFavor: 200000,
      terminoCuota: "cuota mensual",
      formatMoney: money,
    });
    expect(r.cargos).toBe("");
    expect(r.saldoAFavor).toBe("Te quedó un saldo a favor de $200.000.");
  });

  it("un cargo sin período se nombra igual, sin fecha inventada", () => {
    const r = frasesDelRecibo({
      cargos: [{ concept: "multa" }],
      saldoAFavor: 0,
      terminoCuota: "cuota mensual",
      formatMoney: money,
    });
    expect(r.cargos).toBe("Cubrió la multa.");
  });

  /**
   * **Casi se cuela «la parqueadero».** El artículo va por concepto, no por
   * defecto: no todos los cobros son femeninos singulares, y esto lo lee una
   * persona.
   */
  it("cada concepto lleva SU artículo", () => {
    const t = "cuota mensual";
    expect(nombreDelCargo({ concept: "parqueadero", period: "2026-07" }, t)).toBe("el parqueadero de julio de 2026");
    expect(nombreDelCargo({ concept: "interes_mora", period: "2026-07" }, t)).toBe(
      "los intereses de mora de julio de 2026",
    );
    expect(nombreDelCargo({ concept: "multa", period: "2026-07" }, t)).toBe("la multa de julio de 2026");
    expect(nombreDelCargo({ concept: "reparacion", period: "2026-07" }, t)).toBe("la reparación de julio de 2026");
    expect(nombreDelCargo({ concept: "extraordinaria", period: "2026-07" }, t)).toBe(
      "la cuota extraordinaria de julio de 2026",
    );
    expect(nombreDelCargo({ concept: "vigilancia", period: "2026-07" }, t)).toBe(
      "la cuota de vigilancia de julio de 2026",
    );
    // Un concepto que no existe cae en «cargo», que es masculino.
    expect(nombreDelCargo({ concept: "inventado", period: "2026-07" }, t)).toBe("el cargo de julio de 2026");
  });

  it("sin concepto se asume la cuota ordinaria, que es el caso normal", () => {
    expect(nombreDelCargo({ period: "2026-08" }, "cuota de mantenimiento")).toBe(
      "la cuota de mantenimiento de agosto de 2026",
    );
  });
});

describe("CA13 · la frase del saldo a favor", () => {
  /**
   * **El caso que gobierna el diseño.** La mayoría de los pagos no dejan
   * sobrante, y la variable tiene que quedar en cadena vacía para que
   * `interpolate` la borre sin dejar un conectivo colgando.
   */
  it("sin sobrante, la frase es vacía — no «un saldo a favor de $0»", () => {
    const r = frasesDelRecibo({
      cargos: [{ concept: "administracion", period: "2026-08" }],
      saldoAFavor: 0,
      terminoCuota: "cuota mensual",
      formatMoney: money,
    });
    expect(r.saldoAFavor).toBe("");
  });

  it("con sobrante, lo nombra con su importe", () => {
    const r = frasesDelRecibo({
      cargos: [{ concept: "administracion", period: "2026-08" }],
      saldoAFavor: 60000,
      terminoCuota: "cuota mensual",
      formatMoney: money,
    });
    expect(r.saldoAFavor).toBe("Te quedó un saldo a favor de $60.000.");
  });

  it("un sobrante negativo o no numérico no dice nada", () => {
    const base = { cargos: [], terminoCuota: "cuota mensual", formatMoney: money };
    expect(frasesDelRecibo({ ...base, saldoAFavor: -5 }).saldoAFavor).toBe("");
    expect(frasesDelRecibo({ ...base, saldoAFavor: Number.NaN }).saldoAFavor).toBe("");
  });
});

describe("las piezas sueltas", () => {
  it("el período se lee en español y con año", () => {
    expect(periodoLegible("2026-06")).toBe("junio de 2026");
    expect(periodoLegible("2026-01")).toBe("enero de 2026");
  });

  // Un período mal formado no puede colarse como "Invalid Date" en un correo.
  it("un período ilegible devuelve vacío, nunca una fecha rota", () => {
    expect(periodoLegible(undefined)).toBe("");
    expect(periodoLegible("")).toBe("");
    expect(periodoLegible("junio")).toBe("");
    expect(periodoLegible("2026-6")).toBe("");
  });

  it("enumerar", () => {
    expect(enumerar([])).toBe("");
    expect(enumerar(["a"])).toBe("a");
    expect(enumerar(["a", "b"])).toBe("a y b");
    expect(enumerar(["a", "b", "c"])).toBe("a, b y c");
    expect(enumerar(["a", "  ", "c"])).toBe("a y c");
  });
});
