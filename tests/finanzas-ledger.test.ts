// tests/finanzas-ledger.test.ts
// F1 · C2 — posición de fondos + idempotencia del asiento de egreso.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/firebase/realtime-helpers", () => ({
  createTenantDocument: vi.fn(),
  subscribeTenantCollection: vi.fn(),
}));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
}));

import { computeFundPosition, resolveExpenseLedgerAction } from "@/features/finanzas/use-ledger";
import type { LedgerEntry } from "@/types/domain";

const entry = (type: "ingreso" | "egreso", amount: number): LedgerEntry => ({
  id: "x",
  tenantId: "t",
  type,
  date: "2026-06-01",
  amount,
  concept: "c",
  reconciled: false,
});

describe("computeFundPosition", () => {
  it("combina recaudo de cuotas, ingresos manuales y egresos", () => {
    const entries = [entry("ingreso", 200), entry("egreso", 50), entry("egreso", 30)];
    const pos = computeFundPosition(entries, 1000, 500);
    expect(pos.cuotaIncome).toBe(1000);
    expect(pos.ledgerIncome).toBe(200);
    expect(pos.totalIncome).toBe(1200);
    expect(pos.expenses).toBe(80);
    expect(pos.balance).toBe(500 + 1200 - 80);
  });

  it("saldo inicial cero por defecto", () => {
    expect(computeFundPosition([], 0).balance).toBe(0);
  });

  it("excluye asientos de cuota (alicuota) del libro para no duplicar el recaudo", () => {
    const entries = [{ ...entry("ingreso", 500), category: "alicuota" as const }, entry("ingreso", 100)];
    const pos = computeFundPosition(entries, 500);
    expect(pos.ledgerIncome).toBe(100);
    expect(pos.totalIncome).toBe(600);
  });

  // R12 · PRD-V-PLAT-003. El caso que hoy no puede ocurrir y ocurrirá en cuanto
  // `aplicarPago` escriba la cuenta del concepto: un cargo de multa cobrado.
  // Cartera ya lo suma en `cuotaIncome`; si el libro además lo sumara, el
  // conjunto vería 1.500 donde recaudó 1.000.
  it("excluye el asiento de un cargo aunque su categoría NO sea alicuota", () => {
    const multa: LedgerEntry = {
      ...entry("ingreso", 500),
      category: "otros_ingresos",
      sourceType: "billingStatement",
    };
    const pos = computeFundPosition([multa, entry("ingreso", 100)], 1000);
    expect(pos.ledgerIncome).toBe(100);
    expect(pos.totalIncome).toBe(1100);
  });

  // El otro lado: excluir por origen no puede tragarse ingresos que Cartera no
  // conoce. Un ingreso manual o un asiento de egreso reversado siguen contando.
  it("no excluye ingresos que no vienen de un cargo", () => {
    const manual: LedgerEntry = { ...entry("ingreso", 300), category: "arriendo", sourceType: "manual" };
    const pos = computeFundPosition([manual], 0);
    expect(pos.ledgerIncome).toBe(300);
  });

  // Convivencia: con la bandera apagada el reverso de un pago se guarda con
  // `sourceType: "reversal"` y categoría `alicuota`. Se sigue excluyendo por la
  // segunda rama de R12 — si no, el reverso restaría dos veces.
  it("sigue excluyendo el reverso de un pago, que llega como reversal + alicuota", () => {
    const reverso: LedgerEntry = {
      ...entry("ingreso", -500),
      category: "alicuota",
      sourceType: "reversal",
    };
    const pos = computeFundPosition([reverso], 0);
    expect(pos.ledgerIncome).toBe(0);
  });
});

describe("resolveExpenseLedgerAction", () => {
  it("crea asiento al pagar un egreso sin asiento previo", () => {
    expect(resolveExpenseLedgerAction({ prevLedgerEntryId: null, nextStatus: "pagado" })).toBe("create");
  });

  it("actualiza el asiento si ya existe y sigue pagado", () => {
    expect(resolveExpenseLedgerAction({ prevLedgerEntryId: "led-1", nextStatus: "pagado" })).toBe("update");
  });

  it("elimina el asiento si deja de estar pagado", () => {
    expect(resolveExpenseLedgerAction({ prevLedgerEntryId: "led-1", nextStatus: "registrado" })).toBe("delete");
    expect(resolveExpenseLedgerAction({ prevLedgerEntryId: "led-1", nextStatus: "anulado" })).toBe("delete");
  });

  it("no hace nada si nunca estuvo pagado", () => {
    expect(resolveExpenseLedgerAction({ prevLedgerEntryId: null, nextStatus: "registrado" })).toBe("none");
  });
});
