// tests/finanzas-payments.test.ts
// F1 · C3 — saldo/estado tras un cobro + construcción del comprobante.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/firebase/realtime-helpers", () => ({
  createTenantDocument: vi.fn(),
  subscribeTenantCollection: vi.fn(),
}));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
}));

import {
  getComprobanteProvider,
  reciboGenericoProvider,
} from "@/features/finanzas/comprobante/provider";
import { computeBalanceStatus, recordPayment } from "@/features/finanzas/use-payments";
import type { BillingStatement } from "@/types/domain";

describe("computeBalanceStatus", () => {
  it("queda al día (paid) cuando el pago cubre el cargo", () => {
    expect(computeBalanceStatus(100, 100)).toEqual({ balance: 0, status: "paid" });
    expect(computeBalanceStatus(100, 120)).toEqual({ balance: 0, status: "paid" });
  });

  it("queda pendiente con saldo si el pago es parcial y no está vencido", () => {
    expect(computeBalanceStatus(100, 60, "2999-01-01")).toEqual({ balance: 40, status: "pending" });
  });

  it("queda en mora (overdue) si hay saldo y la fecha límite pasó", () => {
    expect(computeBalanceStatus(100, 60, "2000-01-01")).toEqual({ balance: 40, status: "overdue" });
  });
});

describe("reciboGenericoProvider.buildVoucher", () => {
  it("mapea datos del pagador y del emisor", () => {
    const draft = reciboGenericoProvider.buildVoucher({
      type: "ingreso",
      sequentialValue: 7,
      sequentialNumber: "001-001-000000007",
      issueDate: "2026-06-01",
      amount: 250,
      concept: "Pago de alícuota 2026-06 — T1-101",
      payer: { unitId: "u-1", unitLabel: "T1-101" },
      issuer: { taxId: "1790012345001", legalName: "Conjunto Horizonte", country: "EC" },
      sourceType: "billingStatement",
      sourceId: "stmt-1",
    });
    expect(draft.payerUnitLabel).toBe("T1-101");
    expect(draft.issuerCountry).toBe("EC");
    expect(draft.sequentialNumber).toBe("001-001-000000007");
    expect(draft.payerTaxId).toBeNull();
  });
});

describe("getComprobanteProvider", () => {
  /**
   * Los tres países devuelven el MISMO recibo, y Ecuador ya no es la excepción.
   * Hasta el 20 de agosto de 2026 devolvía un adaptador que marcaba el comprobante
   * para transmitirlo al SRI; se retiró al salir lo fiscal del alcance. Esta prueba
   * se conserva para que, si alguien vuelve a ramificar por país, sea a propósito.
   */
  it("devuelve el recibo genérico para los tres países y sin país", () => {
    expect(getComprobanteProvider("EC")).toBe(reciboGenericoProvider);
    expect(getComprobanteProvider("CO")).toBe(reciboGenericoProvider);
    expect(getComprobanteProvider("MX")).toBe(reciboGenericoProvider);
    expect(getComprobanteProvider()).toBe(reciboGenericoProvider);
  });
});

describe("recordPayment — validación Ecuador", () => {
  const statement = {
    id: "s1",
    tenantId: "t1",
    unitId: "u1",
    unitLabel: "T1-101",
    period: "2026-06",
    amount: 100,
    paymentAmount: 0,
    balance: 100,
    status: "pending",
  } as BillingStatement;

  it("rechaza si falta el RUC del conjunto", async () => {
    await expect(
      recordPayment("t1", "u1", {
        statement,
        amount: 100,
        date: "2026-06-01",
        fiscalProfile: { country: "EC" },
        payerTaxId: "1700000000",
        operationKey: "test-op-1",
      }),
    ).rejects.toThrow(/RUC/i);
  });

  it("rechaza si falta la cédula del condómino", async () => {
    await expect(
      recordPayment("t1", "u1", {
        statement,
        amount: 100,
        date: "2026-06-01",
        fiscalProfile: { country: "EC", taxId: "1790012345001" },
        operationKey: "test-op-2",
      }),
    ).rejects.toThrow(/cédula/i);
  });
});
