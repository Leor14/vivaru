import { describe, expect, it } from "vitest";

import {
  computeCollectionSummary,
  statementChargedAmount,
  statementCollectedAmount,
  statementSettledAmount,
} from "@/features/billing/collection";
import { isTicketPending, PENDING_TICKET_STATUSES } from "@/features/pqrs/ticket-status";

describe("statementChargedAmount — fórmula única de facturado", () => {
  it("usa amount cuando existe", () => {
    expect(statementChargedAmount({ amount: 250000, balance: 100000, paymentAmount: 150000 })).toBe(250000);
  });

  it("fallback legado: balance + pago cuando no hay amount", () => {
    expect(statementChargedAmount({ balance: 100000, paymentAmount: 150000 })).toBe(250000);
    expect(statementChargedAmount({ amount: 0, balance: 80000, paymentAmount: 0 })).toBe(80000);
  });

  /**
   * `FLOW-002` R4. Sin sumar el anticipo, un cargo legado de 100.000 cubierto
   * mitad y mitad reconstruiría 60.000 de facturado, y su «% de recaudo» daría
   * 166 %. El fallback tiene que reconstruir lo mismo que se facturó.
   */
  it("el fallback cuenta también lo cubierto con anticipos", () => {
    expect(statementChargedAmount({ balance: 0, paymentAmount: 40000, advanceAppliedAmount: 60000 })).toBe(100000);
  });

  it("nunca negativo ni NaN", () => {
    expect(statementChargedAmount({ balance: -50, paymentAmount: 0 })).toBe(0);
    expect(statementChargedAmount({ amount: Number.NaN, balance: undefined, paymentAmount: null })).toBe(0);
  });
});

describe("computeCollectionSummary — % recaudo", () => {
  it("agrega y calcula la tasa sin redondear", () => {
    const summary = computeCollectionSummary([
      { amount: 100000, paymentAmount: 50000, balance: 50000 },
      { amount: 100000, paymentAmount: 25000, balance: 75000 },
    ]);
    expect(summary.charged).toBe(200000);
    expect(summary.collected).toBe(75000);
    expect(summary.rate).toBeCloseTo(37.5);
  });

  it("sin facturado → tasa 0 (no división por cero)", () => {
    expect(computeCollectionSummary([]).rate).toBe(0);
    expect(computeCollectionSummary([{ amount: 0, balance: 0, paymentAmount: 0 }]).rate).toBe(0);
  });

  it("misma tasa con registros legados (fallback) que con amount explícito", () => {
    const explicit = computeCollectionSummary([{ amount: 100000, paymentAmount: 40000, balance: 60000 }]);
    const legacy = computeCollectionSummary([{ paymentAmount: 40000, balance: 60000 }]);
    expect(legacy.rate).toBeCloseTo(explicit.rate);
  });

  it("statementCollectedAmount ignora pagos negativos", () => {
    expect(statementCollectedAmount({ paymentAmount: -5 })).toBe(0);
  });
});

describe("FLOW-002 R16 — el % mide liquidación, no ingreso", () => {
  /**
   * **CA16, y es el criterio entero de R16 en un solo caso.** Una unidad que
   * cubre julio con un anticipo de junio: el cruce no toca `paymentAmount` a
   * propósito (R4), así que el dinero de julio es cero — y su cuota está
   * saldada. Con la fórmula vieja, esa unidad salía al 0 % de recaudo con la
   * cuota pagada, y el consejo pasaba de ver un ingreso inflado a ver una
   * morosidad inventada.
   */
  it("un cargo cubierto ÍNTEGRAMENTE con anticipo: 0 de recaudo y 100 % de tasa", () => {
    const cubierto = { amount: 100000, paymentAmount: 0, advanceAppliedAmount: 100000, balance: 0 };
    const summary = computeCollectionSummary([cubierto]);
    expect(summary.collected).toBe(0);
    expect(summary.settled).toBe(100000);
    expect(summary.rate).toBe(100);
  });

  it("mitad en efectivo y mitad con anticipo: recaudado 40, tasa 100 %", () => {
    const summary = computeCollectionSummary([
      { amount: 100000, paymentAmount: 40000, advanceAppliedAmount: 60000, balance: 0 },
    ]);
    expect(summary.collected).toBe(40000);
    expect(summary.rate).toBe(100);
  });

  /**
   * **Por qué `facturado − saldo` y no `pagado + anticipo`.** Un sobrepago
   * anterior a `FLOW-002` dejó `paymentAmount: 200000` sobre un cargo de
   * 140.000 —era el defecto D-A: el sobrante se evaporaba dentro del cargo—.
   * Sumando pagado más anticipo, ese cargo daría el 143 % de recaudo.
   */
  it("un sobrepago viejo no empuja la tasa por encima del 100 %", () => {
    const summary = computeCollectionSummary([{ amount: 140000, paymentAmount: 200000, balance: 0 }]);
    expect(summary.rate).toBe(100);
    expect(statementSettledAmount({ amount: 140000, paymentAmount: 200000, balance: 0 })).toBe(140000);
  });

  // Sin anticipos por medio, R16 no cambia ni un número: es lo que hace seguro
  // desplegarlo con las banderas apagadas.
  it("sin anticipos, la tasa es exactamente la de antes", () => {
    const summary = computeCollectionSummary([
      { amount: 100000, paymentAmount: 50000, balance: 50000 },
      { amount: 100000, paymentAmount: 25000, balance: 75000 },
    ]);
    expect(summary.settled).toBe(summary.collected);
    expect(summary.rate).toBeCloseTo(37.5);
  });

  /**
   * **La prueba del «inerte» (§13).** «No cambia nada mientras no haya
   * anticipos» es una PREDICCIÓN, no un hecho, y este módulo ya se equivocó una
   * vez prediciendo inercia. Se demuestra corriendo las dos fórmulas —la vieja,
   * recaudado sobre facturado; la nueva, liquidado sobre facturado— sobre los
   * mismos cargos y contando cuántos cambian. El número esperado es cero, y si
   * no lo es, la inercia era falsa.
   *
   * El barrido incluye a propósito los casos raros que hay en la base: cargos
   * legados sin `amount`, saldos y cobros a cero, y un cargo con más pagado que
   * saldo. **El único caso que sí se mueve tiene su propia prueba** —el
   * sobrepago que dejó `paymentAmount` por encima de lo facturado, que antes
   * daba más del 100 %—, y se mueve a mejor.
   */
  it("sobre cargos SIN anticipos, la fórmula vieja y la nueva dan lo mismo", () => {
    const casos = [
      { amount: 100000, paymentAmount: 0, balance: 100000 },
      { amount: 100000, paymentAmount: 100000, balance: 0 },
      { amount: 100000, paymentAmount: 33333, balance: 66667 },
      { amount: 0, balance: 0, paymentAmount: 0 },
      { balance: 100000, paymentAmount: 150000 },
      { amount: 250000, paymentAmount: 1, balance: 249999 },
    ];
    const vieja = (c: (typeof casos)[number]) => {
      const charged = statementChargedAmount(c);
      return charged > 0 ? (statementCollectedAmount(c) / charged) * 100 : 0;
    };
    const distintos = casos.filter((c) => Math.abs(vieja(c) - computeCollectionSummary([c]).rate) > 1e-9);
    expect(distintos).toEqual([]);

    // Y el agregado, que es lo que se pinta: mismo número por los dos caminos.
    expect(computeCollectionSummary(casos).rate).toBeCloseTo(
      (casos.reduce((s, c) => s + statementCollectedAmount(c), 0) /
        casos.reduce((s, c) => s + statementChargedAmount(c), 0)) *
        100,
    );
  });

  it("un cargo intacto no ha liquidado nada", () => {
    expect(statementSettledAmount({ amount: 100000, paymentAmount: 0, balance: 100000 })).toBe(0);
  });

  // Un saldo negativo escrito por error no puede inventar liquidación de más
  // que lo facturado.
  it("la liquidación nunca pasa de lo facturado", () => {
    expect(statementSettledAmount({ amount: 100000, balance: -50000 })).toBe(100000);
  });
});

describe("isTicketPending — definición única de PQRS pendiente", () => {
  it("open e in_progress son pendientes", () => {
    expect(isTicketPending("open")).toBe(true);
    expect(isTicketPending("in_progress")).toBe(true);
  });

  it("responded NO es pendiente (ya fue atendida)", () => {
    expect(isTicketPending("responded")).toBe(false);
  });

  it("resolved y closed no son pendientes", () => {
    expect(isTicketPending("resolved")).toBe(false);
    expect(isTicketPending("closed")).toBe(false);
  });

  it("status desconocido/ausente se trata como open (pendiente)", () => {
    expect(isTicketPending(undefined)).toBe(true);
    expect(isTicketPending(null)).toBe(true);
  });

  it("la lista canónica es open+in_progress", () => {
    expect([...PENDING_TICKET_STATUSES]).toEqual(["open", "in_progress"]);
  });
});

// ── VIV-1201: anomalía de monto en egresos ────────────────────────────────────
import { detectAmountAnomaly } from "@/features/finanzas/expense-anomaly";

describe("detectAmountAnomaly", () => {
  const history = [1_500_000, 1_400_000, 1_600_000, 1_550_000];

  it("detecta el cero de menos (monto 10x menor que la mediana)", () => {
    expect(detectAmountAnomaly(history, 15_000)?.direction).toBe("low");
  });

  it("detecta el cero de más (monto 10x mayor)", () => {
    expect(detectAmountAnomaly(history, 55_000_000)?.direction).toBe("high");
  });

  it("montos normales no alertan", () => {
    expect(detectAmountAnomaly(history, 1_200_000)).toBeNull();
    expect(detectAmountAnomaly(history, 2_000_000)).toBeNull();
  });

  it("sin histórico suficiente (<3) no opina", () => {
    expect(detectAmountAnomaly([1_500_000, 1_400_000], 15_000)).toBeNull();
    expect(detectAmountAnomaly([], 15_000)).toBeNull();
  });
});
