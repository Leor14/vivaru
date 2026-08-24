import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/firebase/realtime-helpers", () => ({ subscribeTenantCollection: vi.fn() }));
vi.mock("firebase/firestore", () => ({ doc: vi.fn(), getDoc: vi.fn() }));

const applyPaymentCallable = vi.fn(async () => ({
  ok: true as const,
  applied: true,
  ledgerEntryId: "led-1",
  paymentAmount: 200,
  balance: 0,
  status: "paid" as const,
  voucherId: "v-1",
  voucherCode: "REC-1",
}));
vi.mock("@/lib/firebase/callables", () => ({ applyPaymentCallable: (i: unknown) => applyPaymentCallable(i as never) }));

import { recordPayment } from "@/features/finanzas/use-payments";
import type { BillingStatement } from "@/types/domain";

const cargo: BillingStatement = {
  id: "bill-agosto",
  tenantId: "t",
  unitId: "u1",
  unitLabel: "T2-203",
  period: "2026-08",
  amount: 200,
  paymentAmount: 0,
  balance: 200,
  status: "pending",
};

/**
 * `PRD-V-FLOW-002` — **lo que viaja en el cobro, y por qué.**
 *
 * Estas pruebas existen por un defecto que costó un pago real en staging: el
 * reparto se aplicaba entero y la llamada devolvía error igualmente.
 */
describe("recordPayment — el sobre que se manda al servidor", () => {
  beforeEach(() => applyPaymentCallable.mockClear());

  const payload = () => applyPaymentCallable.mock.calls[0][0] as Record<string, unknown>;

  it("un solo cargo va por `statementId` y sin reparto", async () => {
    await recordPayment("t", "u", { statement: cargo, amount: 200, date: "2026-08-24", operationKey: "k1" });
    expect(payload().statementId).toBe("bill-agosto");
    expect(payload().allocations).toBeUndefined();
  });

  /**
   * **`statementId` va SIEMPRE, también con reparto — y no es cosmético.**
   *
   * `applyPayment` audita FUERA de la transacción, y `writeAuditLog` escribe el
   * campo tal cual. `initializeApp()` corre sin `ignoreUndefinedProperties`, así
   * que un `statementId: undefined` hace que Firestore rechace la escritura y la
   * callable reviente **con el pago ya confirmado**: en pantalla sale un error
   * sobre un cobro que sí entró, y si quien opera cierra el formulario y
   * reintenta, la clave de idempotencia es otra y cobra dos veces.
   *
   * Medido en staging el 24 de agosto de 2026 con un reparto real: 150 + 200 y
   * un anticipo de 50 escritos correctamente, y «Ocurrió un error inesperado»
   * en pantalla.
   */
  it("con reparto también, o la auditoría revienta DESPUÉS de cobrar", async () => {
    await recordPayment("t", "u", {
      statement: cargo,
      allocations: [
        { statementId: "bill-julio", amount: 150 },
        { statementId: "bill-agosto", amount: 200 },
      ],
      amount: 400,
      date: "2026-08-24",
      operationKey: "k2",
    });
    expect(payload().statementId).toBe("bill-agosto");
    expect(payload().allocations).toHaveLength(2);
  });

  /**
   * Un reparto de UNA línea no se manda como reparto. Para la aritmética daría
   * igual —el servidor normaliza las dos formas al mismo código—, pero mandar la
   * ruta nueva donde vale la vieja expone la de producción a un cambio que no
   * necesita.
   */
  it("un reparto de una sola línea se manda por la ruta de siempre", async () => {
    await recordPayment("t", "u", {
      statement: cargo,
      allocations: [{ statementId: "bill-agosto", amount: 200 }],
      amount: 200,
      date: "2026-08-24",
      operationKey: "k3",
    });
    expect(payload().allocations).toBeUndefined();
    expect(payload().statementId).toBe("bill-agosto");
  });

  // R11: el efectivo no entra a ninguna cuenta, y el servidor espera `null`
  // —no la ausencia del campo— para escribir el asiento sin cuenta.
  it("sin cuenta bancaria manda `null`, no el campo ausente", async () => {
    await recordPayment("t", "u", { statement: cargo, amount: 200, date: "2026-08-24", operationKey: "k4" });
    expect(payload()).toHaveProperty("bankAccountId", null);
  });

  it("con cuenta manda su id", async () => {
    await recordPayment("t", "u", {
      statement: cargo,
      amount: 200,
      date: "2026-08-24",
      operationKey: "k5",
      bankAccountId: "bank-1",
    });
    expect(payload().bankAccountId).toBe("bank-1");
  });
});
