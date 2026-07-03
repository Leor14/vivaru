import { describe, expect, it } from "vitest";

import {
  computeCollectionSummary,
  statementChargedAmount,
  statementCollectedAmount,
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
