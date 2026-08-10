import { describe, expect, it } from "vitest";

import { PRICE_TABLE_VERSION, estimateCostUsd } from "../src/ai/usage";
import { summarizeUsage, inicioDelMes, type AiUsageRow } from "../src/ai/usage-report";
import { aiUsageCutoff, AI_USAGE_RETENTION_MONTHS } from "../src/data-retention";

/**
 * Telemetría de uso y costo — Paso 1.5 de docs/hoja-de-ruta-ia.md.
 *
 * El criterio del paso es poder responder «cuánto gastó este conjunto este mes»
 * mirando datos. Lo que se prueba aquí es que ese número sea el correcto y que
 * no mienta cuando falta información.
 */

function fila(overrides: Partial<AiUsageRow> = {}): AiUsageRow {
  return {
    tenantId: "conjunto-a",
    operationKey: "comunicaciones-redactar",
    model: "gemini-3.1-flash-lite",
    outcome: "ok",
    inputTokens: 1000,
    outputTokens: 500,
    estimatedCostUsd: 0.001,
    latencyMs: 900,
    ...overrides,
  };
}

describe("cálculo de costo", () => {
  it("aplica los precios decididos en el Paso 0", () => {
    // Gemini 3.1 Flash-Lite: 0,25 entrada / 1,50 salida por millón.
    // 1M entrada + 1M salida = 1,75.
    expect(estimateCostUsd("gemini-3.1-flash-lite", 1_000_000, 1_000_000)).toBeCloseTo(1.75, 6);
  });

  it("no redondea a cero una llamada real", () => {
    // Una comunicación son ~1.500 tokens. A dos decimales sería 0,00 y el
    // tablero diría que la IA es gratis.
    const costo = estimateCostUsd("gemini-3.1-flash-lite", 1000, 500);
    expect(costo).toBeGreaterThan(0);
  });

  it("el simulador cuesta cero, y que se vea es lo correcto", () => {
    expect(estimateCostUsd("stub", 5000, 5000)).toBe(0);
  });

  it("un modelo sin precio devuelve cero en vez de inventar", () => {
    // Un número plausible y falso no se cuestiona; un cero raro sí.
    expect(estimateCostUsd("modelo-que-nadie-registro", 1_000_000, 1_000_000)).toBe(0);
  });

  it("la tabla de precios está versionada", () => {
    // Guardar el costo ya calculado junto a la versión es lo que impide que
    // recalcular el pasado con los precios de hoy falsifique la historia.
    expect(PRICE_TABLE_VERSION).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("resumen del período", () => {
  it("sin filas devuelve ceros y no rompe", () => {
    const resumen = summarizeUsage([]);
    expect(resumen.total).toMatchObject({ llamadas: 0, fallos: 0, costoUsd: 0, latenciaMediaMs: 0 });
    expect(resumen.porConjunto).toEqual([]);
  });

  it("suma costo y tokens por conjunto", () => {
    const resumen = summarizeUsage([
      fila({ tenantId: "conjunto-a", estimatedCostUsd: 0.002 }),
      fila({ tenantId: "conjunto-a", estimatedCostUsd: 0.003 }),
      fila({ tenantId: "conjunto-b", estimatedCostUsd: 0.001 }),
    ]);

    expect(resumen.total.llamadas).toBe(3);
    expect(resumen.total.costoUsd).toBeCloseTo(0.006, 6);
    expect(resumen.porConjunto).toHaveLength(2);
    expect(resumen.porConjunto[0]).toMatchObject({ tenantId: "conjunto-a", llamadas: 2 });
  });

  it("ordena por gasto, no alfabéticamente", () => {
    // La pregunta al abrir esto es quién está consumiendo.
    const resumen = summarizeUsage([
      fila({ tenantId: "aaa", estimatedCostUsd: 0.001 }),
      fila({ tenantId: "zzz", estimatedCostUsd: 0.5 }),
    ]);

    expect(resumen.porConjunto[0].tenantId).toBe("zzz");
  });

  it("CUENTA LOS FALLOS: un registro solo de éxitos siempre da buenas noticias", () => {
    const resumen = summarizeUsage([
      fila({ outcome: "ok" }),
      fila({ outcome: "salida_incumple_contrato" }),
      fila({ outcome: "salida_incumple_contrato" }),
      fila({ outcome: "proveedor_no_responde" }),
    ]);

    expect(resumen.total.llamadas).toBe(4);
    expect(resumen.total.fallos).toBe(3);
    expect(resumen.fallosPorMotivo[0]).toEqual({ outcome: "salida_incumple_contrato", veces: 2 });
  });

  it("una llamada fallida sigue contando su costo", () => {
    // El modelo respondió: los tokens se consumieron aunque el validador la
    // tirara. Descontarla del gasto sería mentir sobre la factura.
    const resumen = summarizeUsage([fila({ outcome: "salida_ilegible", estimatedCostUsd: 0.004 })]);
    expect(resumen.total.costoUsd).toBeCloseTo(0.004, 6);
  });

  it("agrupa también por operación", () => {
    const resumen = summarizeUsage([
      fila({ operationKey: "comunicaciones-redactar" }),
      fila({ operationKey: "comunicaciones-redactar" }),
      fila({ operationKey: "otra-operacion", estimatedCostUsd: 0.9 }),
    ]);

    expect(resumen.porOperacion[0]).toMatchObject({ operationKey: "otra-operacion", llamadas: 1 });
    expect(resumen.porOperacion[1]).toMatchObject({ llamadas: 2 });
  });

  it("promedia la latencia solo sobre lo que hubo", () => {
    const resumen = summarizeUsage([fila({ latencyMs: 100 }), fila({ latencyMs: 300 })]);
    expect(resumen.total.latenciaMediaMs).toBe(200);
  });

  it("marca el resumen como truncado cuando lo está", () => {
    // Un resumen truncado que no lo dice se lee como el total.
    expect(summarizeUsage([fila()], true).truncado).toBe(true);
    expect(summarizeUsage([fila()]).truncado).toBe(false);
  });
});

describe("período y retención", () => {
  it("el default arranca el primero del mes en curso", () => {
    const inicio = inicioDelMes(new Date("2026-08-17T19:30:00.000Z"));
    expect(inicio.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("la retención de telemetría es la aprobada en el Paso 0", () => {
    expect(AI_USAGE_RETENTION_MONTHS).toBe(12);
  });

  it("el corte de purga cae doce meses atrás", () => {
    const corte = aiUsageCutoff(new Date("2026-08-09T00:00:00.000Z"));
    expect(corte.toISOString().slice(0, 7)).toBe("2025-08");
  });
});
