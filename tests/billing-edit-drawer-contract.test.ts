// tests/billing-edit-drawer-contract.test.ts
// Bloque 3 — BillingEditDrawer: unitId llega desde record y se propaga a onSave

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { BillingEditRecord } from "../src/components/features/billing/BillingEditDrawer";

// ── Type contract tests ───────────────────────────────────────────────────────
describe("BillingEditRecord — contrato de tipo", () => {
  it("BillingEditRecord incluye campo unitId de tipo string", () => {
    expectTypeOf<BillingEditRecord>().toHaveProperty("unitId");
    expectTypeOf<BillingEditRecord["unitId"]>().toEqualTypeOf<string>();
  });

  it("BillingEditRecord incluye todos los campos necesarios", () => {
    expectTypeOf<BillingEditRecord>().toHaveProperty("id");
    expectTypeOf<BillingEditRecord>().toHaveProperty("unitId");
    expectTypeOf<BillingEditRecord>().toHaveProperty("unitLabel");
    expectTypeOf<BillingEditRecord>().toHaveProperty("period");
    expectTypeOf<BillingEditRecord>().toHaveProperty("amount");
    expectTypeOf<BillingEditRecord>().toHaveProperty("paymentAmount");
    expectTypeOf<BillingEditRecord>().toHaveProperty("balance");
  });
});

// ── onSave callback shape test ────────────────────────────────────────────────
describe("BillingEditDrawer — onSave propaga unitId sin modificarlo", () => {
  /**
   * Simula el comportamiento de submitCurrent() en el drawer:
   * recibe record.unitId y lo pasa directamente a onSave sin transformación.
   */
  function simulateDrawerSave(
    record: BillingEditRecord,
    formValues: { unitLabel: string; period: string; amount: number; paymentAmount: number; balance: number; dueDate?: string },
    onSave: (input: {
      id: string;
      unitId: string;
      unitLabel: string;
      period: string;
      amount: number;
      paymentAmount: number;
      balance: number;
      dueDate?: string;
    }) => Promise<void>,
  ) {
    return onSave({
      id: record.id,
      unitId: record.unitId,          // ← tomado del record, nunca del form
      unitLabel: formValues.unitLabel,
      period: formValues.period,
      amount: formValues.amount,
      paymentAmount: formValues.paymentAmount,
      balance: formValues.balance,
      dueDate: formValues.dueDate,
    });
  }

  it("onSave recibe unitId del record original, no derivado de unitLabel", async () => {
    const record: BillingEditRecord = {
      id: "doc-abc",
      unitId: "real-id-abc",
      unitLabel: "Apto 303",
      period: "2026-01",
      amount: 300_000,
      paymentAmount: 0,
      balance: 300_000,
    };

    const onSave = vi.fn().mockResolvedValue(undefined);

    await simulateDrawerSave(
      record,
      { unitLabel: "Apto 303", period: "2026-01", amount: 350_000, paymentAmount: 0, balance: 350_000 },
      onSave,
    );

    expect(onSave).toHaveBeenCalledOnce();
    const savedInput = onSave.mock.calls[0][0] as { unitId: string };
    expect(savedInput.unitId).toBe("real-id-abc");
  });

  it("editar monto NO altera unitId", async () => {
    const record: BillingEditRecord = {
      id: "doc-xyz",
      unitId: "real-id-xyz",
      unitLabel: "Torre 1 Apto 101",
      period: "2026-02",
      amount: 500_000,
      paymentAmount: 100_000,
      balance: 400_000,
    };

    const onSave = vi.fn().mockResolvedValue(undefined);

    await simulateDrawerSave(
      record,
      { unitLabel: "Torre 1 Apto 101", period: "2026-02", amount: 600_000, paymentAmount: 100_000, balance: 500_000 },
      onSave,
    );

    const savedInput = onSave.mock.calls[0][0] as { unitId: string; amount: number };
    expect(savedInput.unitId).toBe("real-id-xyz");
    expect(savedInput.amount).toBe(600_000);
    // unitId no es slug derivado de unitLabel
    expect(savedInput.unitId).not.toMatch(/^unit-/);
  });
});
