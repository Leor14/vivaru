import { describe, expect, it } from "vitest";

import { repartirPorCoeficiente, type UnidadParaReparto } from "../src/coefficient-billing";

/**
 * `PRD-V-PLAT-001` — la aritmética del reparto por coeficiente.
 *
 * La afirmación central es R6: **la suma de los cargos generados es
 * exactamente igual al total repartido**, con el residuo asignado por resto
 * mayor. No es un redondeo cualquiera: un centavo perdido o duplicado en cada
 * corrida es un libro que no cuadra nunca.
 */

function unidad(label: string, coefficient?: number, extra: Partial<UnidadParaReparto> = {}): UnidadParaReparto {
  return { id: `id-${label}`, unitLabel: label, coefficient, ownerIds: ["p1"], ...extra };
}

function sumaDe(lines: { amount: number }[]) {
  // En centavos para no acumular error de coma flotante en la propia prueba.
  return Math.round(lines.reduce((a, l) => a + Math.round(l.amount * 100), 0)) / 100;
}

describe("PLAT-001 · la suma es exacta (CA3/CA4)", () => {
  it("un total que divide exacto se reparte sin ajustes", () => {
    const r = repartirPorCoeficiente(100, [unidad("A", 50), unidad("B", 50)], "USD");
    expect(r.lines.map((l) => l.amount)).toEqual([50, 50]);
    expect(r.lines.every((l) => l.roundingAdjustment === 0)).toBe(true);
  });

  it("un total que NO divide exacto reparte el residuo y la suma sigue siendo el total", () => {
    // 100 entre tres tercios: 33.33 + 33.33 + 33.33 = 99.99 → falta un centavo.
    const r = repartirPorCoeficiente(
      100,
      [unidad("A", 33.333333), unidad("B", 33.333333), unidad("C", 33.333334)],
      "USD",
    );
    expect(sumaDe(r.lines)).toBe(100);
    const ajustados = r.lines.filter((l) => l.roundingAdjustment > 0);
    expect(ajustados.length).toBeGreaterThan(0);
  });

  it("en COP se reparte en pesos enteros, sin centavos", () => {
    const r = repartirPorCoeficiente(
      1000001,
      [unidad("A", 33.333333), unidad("B", 33.333333), unidad("C", 33.333334)],
      "COP",
    );
    for (const l of r.lines) {
      expect(Number.isInteger(l.amount)).toBe(true);
    }
    expect(r.lines.reduce((a, l) => a + l.amount, 0)).toBe(1000001);
  });

  it("el reparto es determinista: el empate se resuelve por etiqueta", () => {
    const a = repartirPorCoeficiente(101, [unidad("B", 50), unidad("A", 50)], "COP");
    const b = repartirPorCoeficiente(101, [unidad("A", 50), unidad("B", 50)], "COP");
    const porLabel = (r: typeof a) => Object.fromEntries(r.lines.map((l) => [l.unitLabel, l.amount]));
    expect(porLabel(a)).toEqual(porLabel(b));
    // El peso extra cae en "A" (empate por etiqueta, es-CO).
    expect(porLabel(a)["A"]).toBe(51);
  });

  it("coeficientes de seis decimales (D1) se aceptan y suman", () => {
    const unidades = [unidad("A", 1.769387), unidad("B", 98.230613)];
    const r = repartirPorCoeficiente(140.4, unidades, "USD");
    expect(sumaDe(r.lines)).toBe(140.4);
    expect(r.coefficientSum).toBeCloseTo(100, 6);
  });
});

describe("PLAT-001 · la base debe estar cuadrada (R2/CF1)", () => {
  it("una suma de 99.8% bloquea la generación nombrando la diferencia", () => {
    expect(() => repartirPorCoeficiente(100, [unidad("A", 50), unidad("B", 49.8)], "USD")).toThrowError(
      /99\.8/,
    );
  });

  it("una unidad sin coeficiente bloquea y se NOMBRA (R4)", () => {
    expect(() => repartirPorCoeficiente(100, [unidad("A", 100), unidad("Lote 7")], "USD")).toThrowError(
      /Lote 7/,
    );
  });

  it("la tolerancia de 1e-6 deja pasar el error de coma flotante", () => {
    // 3 × 33.333333 + 0.000001 = 100.000000
    const r = repartirPorCoeficiente(
      100,
      [unidad("A", 33.333333), unidad("B", 33.333333), unidad("C", 33.333334)],
      "USD",
    );
    expect(r.coefficientSum).toBeCloseTo(100, 6);
  });
});

describe("PLAT-001 · quién entra y quién responde (R3/R5)", () => {
  it("una unidad inactiva no recibe cargo ni cuenta para la suma (CA5)", () => {
    const r = repartirPorCoeficiente(
      100,
      [unidad("A", 50), unidad("B", 50), unidad("C", 40, { status: "inactive" })],
      "USD",
    );
    expect(r.lines.map((l) => l.unitLabel)).toEqual(["A", "B"]);
    expect(r.coefficientSum).toBe(100);
  });

  it("una unidad sin responsable ni propietario bloquea nombrándola (CF7)", () => {
    expect(() =>
      repartirPorCoeficiente(100, [unidad("A", 50), unidad("Lote 9", 50, { ownerIds: [] })], "USD"),
    ).toThrowError(/Lote 9/);
  });

  it("con responsable designado no hace falta propietario", () => {
    const r = repartirPorCoeficiente(
      100,
      [unidad("A", 50), unidad("B", 50, { ownerIds: [], billingResponsiblePersonId: "p9" })],
      "USD",
    );
    expect(r.lines).toHaveLength(2);
  });

  it("un total de cero o negativo es rechazado", () => {
    expect(() => repartirPorCoeficiente(0, [unidad("A", 100)], "USD")).toThrowError();
    expect(() => repartirPorCoeficiente(-5, [unidad("A", 100)], "USD")).toThrowError();
  });
});

describe("PLAT-001 · el coeficiente viaja congelado en la línea (R8)", () => {
  it("cada línea lleva el coeficiente con que se calculó", () => {
    const r = repartirPorCoeficiente(200, [unidad("A", 30), unidad("B", 70)], "USD");
    expect(r.lines.find((l) => l.unitLabel === "A")?.coefficient).toBe(30);
    expect(r.lines.find((l) => l.unitLabel === "B")?.coefficient).toBe(70);
  });
});
