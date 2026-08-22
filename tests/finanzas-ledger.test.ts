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

/**
 * `PRD-V-PLAT-003` · CA11 y R13 — el ingreso total NO puede cambiar al encender
 * `producto-concepto-al-libro`. **Cambia el reparto, no la suma.**
 *
 * Estas pruebas simulan los dos mundos escribiendo los asientos como los escribe
 * `aplicarPago` a cada lado de la bandera, y comparan el total. Es la única
 * forma de comprobar la promesa sin desplegar: el defecto que esto vigila no
 * está en ninguna de las dos formas por separado, sino **en el paso de una a
 * otra**.
 */
describe("CA11 · encender la bandera reparte, no suma", () => {
  // Un conjunto que cobró 1.000 de cuota, 500 de multa y 200 de parqueadero,
  // todo pagado. Cartera suma los tres en cuotaIncome, pase lo que pase.
  const CUOTA_INCOME = 1700;

  const banderaApagada: LedgerEntry[] = [
    { ...entry("ingreso", 1000), category: "alicuota", sourceType: "billingStatement" },
    { ...entry("ingreso", 500), category: "alicuota", sourceType: "billingStatement" },
    { ...entry("ingreso", 200), category: "alicuota", sourceType: "billingStatement" },
  ];

  const banderaEncendida: LedgerEntry[] = [
    { ...entry("ingreso", 1000), category: "alicuota", accountCode: "1.1", sourceType: "billingStatement" },
    { ...entry("ingreso", 500), category: "multa", accountCode: "1.3", sourceType: "billingStatement" },
    { ...entry("ingreso", 200), category: "parqueadero", accountCode: "1.5", sourceType: "billingStatement" },
  ];

  it("el ingreso total es el mismo a los dos lados de la bandera", () => {
    const antes = computeFundPosition(banderaApagada, CUOTA_INCOME);
    const despues = computeFundPosition(banderaEncendida, CUOTA_INCOME);
    expect(despues.totalIncome).toBe(antes.totalIncome);
    expect(despues.totalIncome).toBe(1700);
    // Y ninguno de los dos mundos aporta nada por la vía del libro: todo lo que
    // nace de un cargo lo cuenta Cartera.
    expect(antes.ledgerIncome).toBe(0);
    expect(despues.ledgerIncome).toBe(0);
  });

  // Sin la corrección de la 1b-i, este es el número que se vería: 1700 + 700.
  it("sin excluir por origen, el total sería 2.400 — el doble conteo, medido", () => {
    const malo = banderaEncendida
      .filter((e) => e.category !== "alicuota")
      .reduce((s, e) => s + e.amount, 0);
    expect(CUOTA_INCOME + malo).toBe(2400);
  });
});

describe("R13 · el reverso de un cargo tampoco puede restar dos veces", () => {
  // Al revertir, `revertirPago` baja el `paymentAmount` de la cuota, así que
  // cuotaIncome YA baja. Si además el reverso entrara en el libro, el ingreso
  // caería el doble.
  it("un reverso de multa se excluye por el origen que arrastra", () => {
    const reverso: LedgerEntry = {
      ...entry("ingreso", -500),
      category: "multa",
      accountCode: "1.3",
      sourceType: "reversal",
      reversedSourceType: "billingStatement",
    };
    // Cartera ya descontó los 500: de 1700 quedan 1200.
    const pos = computeFundPosition([reverso], 1200);
    expect(pos.ledgerIncome).toBe(0);
    expect(pos.totalIncome).toBe(1200);
  });

  // El contraejemplo, que es lo que hace que la prueba de arriba signifique
  // algo: sin `reversedSourceType` el mismo asiento SÍ entra, y resta de más.
  it("sin el origen arrastrado, ese mismo reverso restaría 500 de más", () => {
    const huerfano: LedgerEntry = {
      ...entry("ingreso", -500),
      category: "multa",
      accountCode: "1.3",
      sourceType: "reversal",
    };
    const pos = computeFundPosition([huerfano], 1200);
    expect(pos.totalIncome).toBe(700);
  });

  // Un reverso de un movimiento MANUAL sí tiene que contar: Cartera no sabe
  // nada de él, así que excluirlo dejaría el ingreso inflado para siempre.
  it("el reverso de un ingreso manual sigue restando, como debe", () => {
    const reversoManual: LedgerEntry = {
      ...entry("ingreso", -300),
      category: "arriendo",
      sourceType: "reversal",
      reversedSourceType: "manual",
    };
    const pos = computeFundPosition([{ ...entry("ingreso", 300), category: "arriendo", sourceType: "manual" }, reversoManual], 0);
    expect(pos.ledgerIncome).toBe(0);
  });
});
