import { describe, expect, it } from "vitest";

import {
  calcularConsumo,
  idDeCorridaDeConsumo,
  repartirPorConsumo,
  esPeriodoValido,
  importeDelConsumo,
  periodoAnterior,
  redondear,
  unidadesSinFoto,
} from "../src/medicion-de-consumos";

/**
 * `PRD-V-FEAT-008` entrega 1 — el cálculo, sin emulador.
 *
 * Lo que se prueba aquí es **la aritmética que se convierte en dinero**. El
 * consumo sale de una resta de decimales y se multiplica por una tarifa: es
 * exactamente la familia de defecto que ya costó dos guardianes de `aplicarPago`
 * rechazando cobros correctos por centavos.
 */

describe("FEAT-008 · el período", () => {
  it("acepta AAAA-MM y rechaza lo que no lo es", () => {
    expect(esPeriodoValido("2026-09")).toBe(true);
    expect(esPeriodoValido("2026-01")).toBe(true);
    expect(esPeriodoValido("2026-12")).toBe(true);
    expect(esPeriodoValido("2026-13")).toBe(false);
    expect(esPeriodoValido("2026-00")).toBe(false);
    expect(esPeriodoValido("2026-9")).toBe(false);
    expect(esPeriodoValido("septiembre")).toBe(false);
    expect(esPeriodoValido("")).toBe(false);
  });

  it("el anterior de enero es diciembre del año pasado", () => {
    // El caso que se rompe solo una vez al año, que es cuando nadie mira.
    expect(periodoAnterior("2026-01")).toBe("2025-12");
    expect(periodoAnterior("2026-09")).toBe("2026-08");
    expect(periodoAnterior("2026-10")).toBe("2026-09");
  });

  it("mantiene el cero a la izquierda del mes", () => {
    // Sin el padStart, el anterior de octubre sería `2026-9` y la búsqueda de la
    // lectura previa no encontraría nada: cada octubre nacería línea base.
    expect(periodoAnterior("2026-10")).toBe("2026-09");
    expect(periodoAnterior("2026-02")).toBe("2026-01");
  });
});

describe("FEAT-008 · el consumo", () => {
  it("es la diferencia entre las dos lecturas", () => {
    expect(calcularConsumo(1200, 1247)).toEqual({ consumption: 47, reinicio: false });
  });

  it("🔴 no arrastra el error del punto flotante", () => {
    // `4.3 - 1.1` da 3.1999999999999997 en JavaScript. Ese número acabaría
    // multiplicado por una tarifa y convertido en un cargo.
    expect(calcularConsumo(1.1, 4.3).consumption).toBe(3.2);
    expect(calcularConsumo(0.1, 0.3).consumption).toBe(0.2);
  });

  it("`RN-03` · una lectura MENOR no revienta: marca reinicio y no inventa un número", () => {
    // Un medidor que completa su vuelta es real. Devolver la resta daría un
    // consumo NEGATIVO, y multiplicado por la tarifa sería un abono.
    const r = calcularConsumo(9980, 20);
    expect(r.reinicio).toBe(true);
    expect(r.consumption).toBe(0);
    expect(r.consumption).not.toBeLessThan(0);
  });

  it("dos lecturas iguales son consumo cero, no reinicio", () => {
    expect(calcularConsumo(500, 500)).toEqual({ consumption: 0, reinicio: false });
  });
});

describe("FEAT-008 · el importe — lo que Habitanto «no nos calcula»", () => {
  it("es consumo por tarifa, redondeado a la moneda", () => {
    expect(importeDelConsumo(47, 3200)).toBe(150400);
  });

  it("redondea los decimales del consumo sin dejar céntimos partidos", () => {
    // 3,2 m³ a 3.200 = 10.240 exactos.
    expect(importeDelConsumo(3.2, 3200)).toBe(10240);
    // 12,457 m³ a 1.850 = 23.045,45 → 23.045.
    expect(importeDelConsumo(12.457, 1850)).toBe(23045);
  });

  it("consumo cero no cobra nada", () => {
    expect(importeDelConsumo(0, 3200)).toBe(0);
  });
});

describe("FEAT-008 · `RN-09` · la foto para cerrar", () => {
  it("nombra las unidades que no la tienen", () => {
    const faltan = unidadesSinFoto([
      { unitId: "T1-101", photoUrl: "https://…/a.jpg" },
      { unitId: "T1-102" },
      { unitId: "T1-201", photoUrl: "" },
    ]);
    expect(faltan).toEqual(["T1-102", "T1-201"]);
  });

  it("con todas las fotos, no falta ninguna", () => {
    // El par positivo: sin él, una función que devolviera siempre `[]` pasaría
    // la prueba de arriba y dejaría cerrar cualquier período.
    expect(unidadesSinFoto([{ unitId: "T1-101", photoUrl: "https://…/a.jpg" }])).toEqual([]);
  });

  it("sobre una lista vacía devuelve vacío, y eso NO significa que se pueda cerrar", () => {
    // Lo comprueba `cerrarPeriodo`, que rechaza antes por «no hay lecturas». Se
    // deja escrito aquí porque una puerta que se abre sobre un conjunto vacío ya
    // costó una verificación falsa en este proyecto.
    expect(unidadesSinFoto([])).toEqual([]);
  });
});

describe("FEAT-008 · el redondeo", () => {
  it("guarda tres decimales, que es lo que da un medidor", () => {
    expect(redondear(3.19999999)).toBe(3.2);
    expect(redondear(12.4567)).toBe(12.457);
    expect(redondear(0.0004)).toBe(0);
  });
});

// ── entrega 2 · el reparto ──────────────────────────────────────────────────

const UNIDADES = [
  { id: "u-101", unitLabel: "EA-101" },
  { id: "u-102", unitLabel: "EA-102" },
  { id: "u-103", unitLabel: "EA-103" },
];

describe("FEAT-008 entrega 2 · el reparto por consumo", () => {
  it("cada unidad paga SU consumo por la tarifa, y el total es la suma", () => {
    const r = repartirPorConsumo(
      [
        { unitId: "u-101", consumption: 47 },
        { unitId: "u-102", consumption: 12.5 },
      ],
      3200,
      UNIDADES,
    );
    expect(r.lines.map((l) => [l.unitLabel, l.amount])).toEqual([
      ["EA-101", 150400],
      ["EA-102", 40000],
    ]);
    expect(r.total).toBe(190400);
    expect(r.totalConsumo).toBe(59.5);
  });

  it("🔴 `RN-06` · NOMBRA las unidades que no tienen lectura", () => {
    const r = repartirPorConsumo([{ unitId: "u-101", consumption: 47 }], 3200, UNIDADES);
    // Un «faltan 2 unidades» a secas obliga a buscarlas a mano entre noventa y tres.
    expect(r.sinLectura).toEqual(["EA-102", "EA-103"]);
    expect(r.lines).toHaveLength(1);
  });

  it("con todas las unidades leídas, no falta ninguna", () => {
    // El par positivo: sin él, una función que devolviera siempre `[]` en
    // `sinLectura` pasaría la prueba de arriba.
    const r = repartirPorConsumo(
      UNIDADES.map((u) => ({ unitId: u.id, consumption: 10 })),
      3200,
      UNIDADES,
    );
    expect(r.sinLectura).toEqual([]);
    expect(r.lines).toHaveLength(3);
  });

  it("🔴 `RN-04` · una LÍNEA BASE no genera cargo, y no entra como cargo de cero", () => {
    // Un cargo de cero es un cargo que alguien tiene que mirar y cerrar. La
    // línea base sale de la lista, no entra con importe 0.
    const r = repartirPorConsumo(
      [
        { unitId: "u-101", consumption: 0, esLineaBase: true },
        { unitId: "u-102", consumption: 20 },
      ],
      3200,
      UNIDADES,
    );
    expect(r.lines.map((l) => l.unitLabel)).toEqual(["EA-102"]);
    expect(r.total).toBe(64000);
    // Y su consumo no suma al total del período.
    expect(r.totalConsumo).toBe(20);
  });

  it("un consumo CERO tampoco genera cargo", () => {
    // Nadie consumió: no hay nada que cobrar, y un cargo de $0 sería ruido en
    // la cartera de esa unidad.
    const r = repartirPorConsumo([{ unitId: "u-101", consumption: 0 }], 3200, UNIDADES);
    expect(r.lines).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("las líneas salen ordenadas por unidad, no por el orden de lectura", () => {
    // Se recorren los medidores en el orden del edificio, que no es el orden en
    // que se leen. La corrida se revisa mirándola.
    const r = repartirPorConsumo(
      [
        { unitId: "u-103", consumption: 5 },
        { unitId: "u-101", consumption: 5 },
        { unitId: "u-102", consumption: 5 },
      ],
      1000,
      UNIDADES,
    );
    expect(r.lines.map((l) => l.unitLabel)).toEqual(["EA-101", "EA-102", "EA-103"]);
  });

  it("una unidad con lectura que ya no está activa no rompe: usa su id como etiqueta", () => {
    const r = repartirPorConsumo([{ unitId: "u-borrada", consumption: 3 }], 1000, UNIDADES);
    expect(r.lines[0].unitLabel).toBe("u-borrada");
  });
});

describe("FEAT-008 entrega 2 · `CA15` · la corrida no se duplica", () => {
  it("🔴 el id es una función PURA de sus argumentos, y por eso se exige su valor exacto", () => {
    // **Esta prueba comparaba dos llamadas seguidas y era CIEGA.** Falsarla
    // metiendo un `Date.now()` en el id **pasó en verde**: dos llamadas en el
    // mismo milisegundo dan lo mismo, así que no distinguía un id estable de uno
    // que solo lo parece — y de esa estabilidad depende `CA15`, que es no
    // cobrarle el agua dos veces a nadie.
    //
    // Exigir el valor exacto caza cualquier componente variable que se cuele.
    expect(idDeCorridaDeConsumo("tenant-palmas-cdmx", "agua-fria", "2026-10")).toBe(
      "consumo_tenant-palmas-cdmx_agua-fria_2026-10",
    );
  });

  it("y períodos distintos dan ids distintos", () => {
    expect(idDeCorridaDeConsumo("t", "s", "2026-10")).not.toBe(idDeCorridaDeConsumo("t", "s", "2026-11"));
  });

  it("sanea los caracteres que Firestore no admite en un id", () => {
    expect(idDeCorridaDeConsumo("t/enant", "ser/vicio", "2026-10")).not.toContain("/");
  });
});
