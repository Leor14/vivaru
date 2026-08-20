// tests/finanzas-payments.test.ts
// F1 · C3 — saldo y estado tras un cobro.
//
// La construcción del recibo ya NO se prueba aquí: se mudó al servidor el 20 de
// agosto de 2026, al meter la emisión dentro de la transacción del pago. Sus
// pruebas viven ahora en `functions/tests/comprobante.test.ts`. `src/` no puede
// importar de `functions/`, así que el módulo se mudó entero en vez de
// duplicarse — ver CLAUDE.md.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/firebase/realtime-helpers", () => ({
  subscribeTenantCollection: vi.fn(),
}));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
}));

import { computeBalanceStatus } from "@/features/finanzas/use-payments";

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
