// tests/finanzas-statement.test.ts
// F1 · C5 — estado de ingresos y egresos por categoría.

import { describe, expect, it } from "vitest";

import { buildFinancialStatement, esRecaudoDeCartera } from "@/features/finanzas/financial-statement";
import { repartirRecaudo } from "@/lib/finanzas/conceptos-de-cargo";
import type { LedgerEntry } from "@/types/domain";

const entry = (
  type: "ingreso" | "egreso",
  amount: number,
  category?: LedgerEntry["category"],
): LedgerEntry => ({
  id: Math.random().toString(36).slice(2),
  tenantId: "t",
  type,
  date: "2026-06-01",
  amount,
  concept: "c",
  category,
  reconciled: false,
});

describe("buildFinancialStatement", () => {
  it("agrupa por categoría y agrega el recaudo de cuotas como línea alicuota", () => {
    const entries = [
      entry("ingreso", 50, "interes_mora"),
      entry("egreso", 120, "servicios_publicos"),
      entry("egreso", 80, "mantenimiento"),
    ];
    const s = buildFinancialStatement(entries, 1000, 0);

    expect(s.cuotaIncome).toBe(1000);
    expect(s.totalIncome).toBe(1050); // 1000 cuotas + 50 interés
    expect(s.totalExpenses).toBe(200);
    expect(s.netResult).toBe(850);
    expect(s.fundBalance).toBe(850);
    expect(s.incomeByCategory.find((i) => i.category === "alicuota")?.amount).toBe(1000);
  });

  it("no duplica los asientos de libro con categoría alicuota", () => {
    const entries = [entry("ingreso", 1000, "alicuota")];
    const s = buildFinancialStatement(entries, 1000, 0);
    expect(s.totalIncome).toBe(1000);
  });

  // R12 · PRD-V-PLAT-003 — el mismo caso que en computeFundPosition, aquí
  // además comprueba que la multa NO aparece como una línea de ingreso propia
  // duplicando la que ya trae Cartera.
  it("no duplica el asiento de un cargo cuya categoría no es alicuota", () => {
    const multa: LedgerEntry = {
      ...entry("ingreso", 400, "otros_ingresos"),
      sourceType: "billingStatement",
    };
    const s = buildFinancialStatement([multa], 1000, 0);
    expect(s.totalIncome).toBe(1000);
    expect(s.incomeByCategory.find((i) => i.category === "otros_ingresos")).toBeUndefined();
  });

  it("mantiene los ingresos que no vienen de un cargo", () => {
    const arriendo: LedgerEntry = { ...entry("ingreso", 400, "arriendo"), sourceType: "manual" };
    const s = buildFinancialStatement([arriendo], 1000, 0);
    expect(s.totalIncome).toBe(1400);
    expect(s.incomeByCategory.find((i) => i.category === "arriendo")?.amount).toBe(400);
  });
});

describe("esRecaudoDeCartera", () => {
  it("excluye por origen y, durante la convivencia, también por categoría", () => {
    expect(esRecaudoDeCartera({ sourceType: "billingStatement", category: "otros_ingresos" })).toBe(true);
    expect(esRecaudoDeCartera({ sourceType: "reversal", category: "alicuota" })).toBe(true);
    expect(esRecaudoDeCartera({ sourceType: "manual", category: "arriendo" })).toBe(false);
    expect(esRecaudoDeCartera({ sourceType: "expense", category: "nomina" })).toBe(false);
    expect(esRecaudoDeCartera({})).toBe(false);
  });
});

describe("CA5 y CA11 · el reparto por concepto (entrega 1b-iii)", () => {
  /**
   * **Escribir la cuenta en el asiento no bastaba.** Los asientos de cobro están
   * excluidos a propósito para no contar dos veces lo que ya suma Cartera, así
   * que la cuenta que la 1b-ii empezó a escribir **no la mostraba nadie**: el
   * estado financiero seguía pintando todo el recaudo como una sola línea de
   * «Cuotas de administración».
   *
   * El reparto tiene que salir de Cartera, que es la fuente completa, y por eso
   * `buildFinancialStatement` admite el total repartido además del total a secas.
   */
  const CARGOS = [
    { concept: "administracion" as const, paymentAmount: 1000 },
    { concept: "extraordinaria" as const, paymentAmount: 1500 },
    { concept: "multa" as const, paymentAmount: 500 },
  ];

  it("con el total a secas, todo cae en una sola línea — el comportamiento de siempre", () => {
    const s = buildFinancialStatement([], 3000, 0);
    expect(s.incomeByCategory).toHaveLength(1);
    expect(s.incomeByCategory[0].label).toBe("Cuotas de administración");
    expect(s.totalIncome).toBe(3000);
  });

  it("con el reparto, las tres aparecen por separado y con su nombre (CA5)", () => {
    const s = buildFinancialStatement([], repartirRecaudo(CARGOS), 0);
    const porEtiqueta = new Map(s.incomeByCategory.map((i) => [i.label, i.amount]));
    expect(porEtiqueta.get("Cuotas de administración")).toBe(1000);
    expect(porEtiqueta.get("Cuotas extraordinarias")).toBe(1500);
    expect(porEtiqueta.get("Multas")).toBe(500);
    expect(s.incomeByCategory).toHaveLength(3);
  });

  // La promesa entera de la entrega, en una línea: cambia el reparto, no la suma.
  it("el total es EXACTAMENTE el mismo con y sin reparto (CA11)", () => {
    const sinReparto = buildFinancialStatement([], 3000, 0);
    const conReparto = buildFinancialStatement([], repartirRecaudo(CARGOS), 0);
    expect(conReparto.totalIncome).toBe(sinReparto.totalIncome);
    expect(conReparto.netResult).toBe(sinReparto.netResult);
    expect(conReparto.fundBalance).toBe(sinReparto.fundBalance);
  });

  // El asiento del cobro sigue excluido: la cuenta la aporta Cartera, no el
  // libro. Si entrara por los dos lados volveríamos al doble conteo que la 1b-i
  // quitó, solo que ahora repartido y por tanto más difícil de ver.
  it("el reparto NO reabre el doble conteo: el asiento del cobro sigue fuera", () => {
    const asientoMulta: LedgerEntry = {
      ...entry("ingreso", 500, "multa"),
      accountCode: "1.3",
      sourceType: "billingStatement",
    };
    const s = buildFinancialStatement([asientoMulta], repartirRecaudo(CARGOS), 0);
    expect(s.totalIncome).toBe(3000);
    expect(s.incomeByCategory.find((i) => i.category === "multa")?.amount).toBe(500);
  });

  it("un ingreso manual se suma a su categoría además del recaudo", () => {
    const arriendo: LedgerEntry = { ...entry("ingreso", 400, "arriendo"), sourceType: "manual" };
    const s = buildFinancialStatement([arriendo], repartirRecaudo(CARGOS), 0);
    expect(s.totalIncome).toBe(3400);
    expect(s.incomeByCategory.find((i) => i.category === "arriendo")?.amount).toBe(400);
  });

  // Un cargo cobrado de un concepto que no existe no puede desaparecer del
  // estado financiero. Cae en «Otros ingresos», que es lo que dice R8.
  it("un concepto desconocido cae en otros ingresos y sigue sumando", () => {
    const s = buildFinancialStatement([], repartirRecaudo([{ concept: "mudanza" as never, paymentAmount: 200 }]), 0);
    expect(s.totalIncome).toBe(200);
    expect(s.incomeByCategory[0].label).toBe("Otros ingresos");
  });
});
