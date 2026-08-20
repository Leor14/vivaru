// tests/finanzas-expense.test.ts
// F1 · C1 — validación de egresos.
//
// Aquí vivían también las pruebas del secuencial de comprobantes, con todo un
// mock de Firestore para poder importarlo sin arrancar Firebase. **El contador
// se retiró el 20 de agosto de 2026**: el recibo dejó de ser un documento fiscal
// y su número correlativo dejó de tener sentido —además de serializar todos los
// pagos de un conjunto sobre un único documento—. Con ellas se fue el mock.

import { describe, expect, it } from "vitest";

import { expenseSchema } from "@/features/finanzas/schemas";

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
