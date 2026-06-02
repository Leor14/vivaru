// tests/finanzas-expense.test.ts
// F1 · C1 — validación de egresos + secuencial de comprobantes (C0).

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks para poder importar financial-counters sin inicializar Firebase ──
const mockSet = vi.fn();
let existingCounter: { value?: number } | undefined;

vi.mock("@/lib/firebase/client", () => ({ db: {} }));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => "counter-ref"),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
  runTransaction: async (
    _db: unknown,
    cb: (tx: {
      get: (ref: unknown) => Promise<{ exists: () => boolean; data: () => { value?: number } | undefined }>;
      set: (...args: unknown[]) => void;
    }) => Promise<number>,
  ) =>
    cb({
      get: async () => ({
        exists: () => existingCounter !== undefined,
        data: () => existingCounter,
      }),
      set: (...args: unknown[]) => mockSet(...args),
    }),
}));

import { formatSequential, nextSequential } from "@/features/finanzas/financial-counters";
import { expenseSchema } from "@/features/finanzas/schemas";

beforeEach(() => {
  mockSet.mockClear();
  existingCounter = undefined;
});

describe("expenseSchema", () => {
  const base = {
    category: "proveedores" as const,
    description: "Pago de energía áreas comunes",
    amount: 150,
    issueDate: "2026-06-01",
    status: "registrado" as const,
  };

  it("acepta un egreso mínimo válido", () => {
    expect(expenseSchema.safeParse(base).success).toBe(true);
  });

  it("acepta método de pago vacío (sin definir)", () => {
    expect(expenseSchema.safeParse({ ...base, paymentMethod: "" }).success).toBe(true);
  });

  it("rechaza monto cero o negativo", () => {
    expect(expenseSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...base, amount: -5 }).success).toBe(false);
  });

  it("exige número de cheque cuando el método es cheque", () => {
    expect(expenseSchema.safeParse({ ...base, paymentMethod: "cheque" }).success).toBe(false);
    expect(
      expenseSchema.safeParse({ ...base, paymentMethod: "cheque", checkNumber: "001234" }).success,
    ).toBe(true);
  });

  it("acepta vencimiento vacío pero rechaza fecha mal formada", () => {
    expect(expenseSchema.safeParse({ ...base, dueDate: "" }).success).toBe(true);
    expect(expenseSchema.safeParse({ ...base, dueDate: "01/06/2026" }).success).toBe(false);
  });
});

describe("formatSequential", () => {
  it("rellena a 9 dígitos sin prefijo", () => {
    expect(formatSequential(123)).toBe("000000123");
  });

  it("antepone el prefijo de serie", () => {
    expect(formatSequential(123, "001-001")).toBe("001-001-000000123");
  });
});

describe("nextSequential", () => {
  it("inicializa en 1 cuando el contador no existe", async () => {
    existingCounter = undefined;
    const value = await nextSequential("tenant-1", "ingreso");
    expect(value).toBe(1);
    expect(mockSet).toHaveBeenCalledWith(
      "counter-ref",
      expect.objectContaining({ tenantId: "tenant-1", series: "ingreso", value: 1 }),
      { merge: true },
    );
  });

  it("incrementa desde el valor existente", async () => {
    existingCounter = { value: 41 };
    const value = await nextSequential("tenant-1", "ingreso");
    expect(value).toBe(42);
  });
});
