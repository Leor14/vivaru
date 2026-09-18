import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { acumularTendencia, acumuladoDelAnio, type BillingTrendPoint } from "@/features/billing/billing-trend";

/**
 * **`L-24` — la tendencia acumulada de cartera.** Lote «Análisis de la plataforma», pág. 9: «que me
 * saque la tendencia de cartera mensual y la acumulada, es decir desde el primer mes del año hasta el
 * mes en curso». **La mensual ya existía**; esto es solo la acumulada.
 */

const punto = (period: string, cobrado: number, recaudado: number, saldado = recaudado): BillingTrendPoint => ({
  period,
  totalCharged: cobrado,
  totalCollected: recaudado,
  totalSettled: saldado,
});

describe("L-24 · acumular la tendencia", () => {
  it("cada mes suma lo anterior, y el último es el total", () => {
    const acumulada = acumularTendencia([punto("2026-01", 100, 60), punto("2026-02", 200, 150), punto("2026-03", 50, 40)]);
    expect(acumulada.map((p) => p.totalCharged)).toEqual([100, 300, 350]);
    expect(acumulada.map((p) => p.totalCollected)).toEqual([60, 210, 250]);
  });

  it("ordena por período: un punto fuera de orden no descoloca la suma", () => {
    const acumulada = acumularTendencia([punto("2026-03", 50, 40), punto("2026-01", 100, 60)]);
    expect(acumulada.map((p) => p.period)).toEqual(["2026-01", "2026-03"]);
    expect(acumulada.map((p) => p.totalCharged)).toEqual([100, 150]);
  });

  it("no toca la lista que recibe: la mensual sigue siendo la mensual", () => {
    const original = [punto("2026-01", 100, 60), punto("2026-02", 200, 150)];
    acumularTendencia(original);
    expect(original.map((p) => p.totalCharged)).toEqual([100, 200]);
  });

  it("sin puntos, no inventa un cero", () => {
    expect(acumularTendencia([])).toEqual([]);
  });
});

describe("L-24 · el acumulado del año natural", () => {
  const puntos = [punto("2025-11", 999, 999), punto("2026-01", 100, 60, 60), punto("2026-02", 200, 150, 140)];

  it("suma solo los períodos de ese año", () => {
    const a = acumuladoDelAnio(puntos, "2026");
    expect(a.periodos).toEqual(["2026-01", "2026-02"]);
    expect(a.cobrado).toBe(300);
    expect(a.recaudado).toBe(210);
  });

  it("el pendiente sale de lo SALDADO, no de lo recaudado: con anticipos no son el mismo número", () => {
    expect(acumuladoDelAnio(puntos, "2026").pendiente).toBe(300 - 200);
  });

  it("un año sin períodos se dice, y no se pinta como tres ceros", () => {
    const a = acumuladoDelAnio(puntos, "2024");
    expect(a.periodos).toEqual([]);
    expect(a.cobrado).toBe(0);
  });
});

describe("L-24 · guardián: la pantalla ofrece las dos lecturas", () => {
  const codigo = fs
    .readFileSync(path.resolve("src/app/(admin)/admin/billing/page.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("tiene el selector y acumula con la función del módulo", () => {
    expect(codigo).toMatch(/lecturaTendencia === "acumulada" \? acumularTendencia\(chartTrend\) : chartTrend/);
    expect(codigo).toMatch(/<option value="acumulada">Acumulada<\/option>/);
  });

  it("y el acumulado del año pide su propio rango, no el del gráfico", () => {
    expect(codigo).toMatch(/acumuladoDelAnio\(buildBillingTrend\(normalizedRows, chartUnitFilter, `\$\{anio\}-01`, `\$\{anio\}-12`\), anio\)/);
    // El año, de la fecha local: `toISOString()` ya sería el siguiente desde las 18:00 de México.
    expect(codigo).toMatch(/const anio = toDateInputValue\(new Date\(\)\)\.slice\(0, 4\)/);
  });
});
