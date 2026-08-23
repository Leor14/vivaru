import { describe, expect, it } from "vitest";

import {
  buildFinancialStatement,
  planParaInformes,
} from "@/features/finanzas/financial-statement";
import type { RecaudoDeCartera } from "@/lib/finanzas/conceptos-de-cargo";
import type { LedgerCategory, LedgerEntry } from "@/types/domain";

/**
 * R9 — el estado financiero agrupa por CUENTA (`PRD-V-PLAT-003`, entrega 2).
 *
 * Hasta el 23 de agosto de 2026 `buildFinancialStatement` agrupaba solo por
 * `category` y no miraba `accountCode` ni una vez, aunque `aplicarPago` llevaba
 * desde la 1b-ii escribiéndolo. Las etiquetas salían de `CATEGORY_LABELS`, un
 * mapa cableado — que es **uno de los dos que la PRD quería matar** (§2)—, así
 * que **CA6 era imposible**: renombrar una cuenta no cambiaba nada en pantalla.
 */

const PLAN = planParaInformes([
  { code: "1", name: "Ingresos" },
  { code: "1.1", name: "Cuotas de administración", systemKey: "alicuota" },
  { code: "1.3", name: "Multas", systemKey: "multa" },
  { code: "1.8", name: "Otros ingresos", systemKey: "otros_ingresos" },
  { code: "2", name: "Egresos" },
  { code: "2.2", name: "Servicios públicos", systemKey: "servicios_publicos" },
  { code: "2.3", name: "Mantenimiento", systemKey: "mantenimiento" },
]);

function asiento(p: Partial<LedgerEntry>): LedgerEntry {
  return {
    id: p.id ?? "x",
    tenantId: "t",
    type: p.type ?? "ingreso",
    date: "2026-08-01",
    amount: p.amount ?? 0,
    concept: p.concept ?? "—",
    category: p.category,
    accountCode: p.accountCode,
    sourceType: p.sourceType ?? "manual",
  } as LedgerEntry;
}

describe("R9 — agrupa por cuenta, y cae en la categoría si no la hay", () => {
  it("un asiento con cuenta se agrupa por su cuenta y se nombra desde el PLAN", () => {
    const st = buildFinancialStatement(
      [asiento({ type: "egreso", amount: 100, category: "mantenimiento", accountCode: "2.3" })],
      0,
      0,
      PLAN,
    );
    expect(st.expenseByCategory).toEqual([
      { category: "2.3", label: "Mantenimiento", amount: 100 },
    ]);
  });

  /**
   * **La decisión que R9 no resuelve.** Leída al pie de la letra —«agrupa por
   * `accountCode`; si no lo tiene, usa `category`»— parte en DOS filas lo que es
   * una sola cuenta: el asiento viejo cae en `mantenimiento` y el nuevo en
   * `2.3`, con el mismo nombre y sumando por separado. Y no se puede arreglar
   * migrando, porque §4 dice que los históricos no se recalculan.
   *
   * Se normaliza la categoría a su código por `systemKey`, que es para lo que
   * ese puente existe.
   */
  it("el asiento VIEJO sin cuenta cae en el MISMO cajón que el nuevo, no en otro (CA8)", () => {
    const st = buildFinancialStatement(
      [
        asiento({ id: "viejo", type: "egreso", amount: 100, category: "mantenimiento" }),
        asiento({ id: "nuevo", type: "egreso", amount: 50, category: "mantenimiento", accountCode: "2.3" }),
      ],
      0,
      0,
      PLAN,
    );
    expect(st.expenseByCategory).toHaveLength(1);
    expect(st.expenseByCategory[0]).toEqual({ category: "2.3", label: "Mantenimiento", amount: 150 });
  });

  it("CA6 — renombrar la cuenta cambia la etiqueta del estado, sin tocar el asiento", () => {
    const renombrado = planParaInformes([
      { code: "2.3", name: "Mantenimiento y jardinería", systemKey: "mantenimiento" },
    ]);
    const entries = [asiento({ type: "egreso", amount: 100, category: "mantenimiento", accountCode: "2.3" })];
    expect(buildFinancialStatement(entries, 0, 0, PLAN).expenseByCategory[0].label).toBe(
      "Mantenimiento",
    );
    expect(buildFinancialStatement(entries, 0, 0, renombrado).expenseByCategory[0].label).toBe(
      "Mantenimiento y jardinería",
    );
  });

  it("sin plan sembrado se comporta como siempre: etiquetas del mapa de respaldo", () => {
    const st = buildFinancialStatement(
      [asiento({ type: "egreso", amount: 100, category: "mantenimiento", accountCode: "2.3" })],
      0,
    );
    expect(st.expenseByCategory[0].label).toBe("Mantenimiento");
    expect(st.expenseByCategory[0].category).toBe("2.3");
  });

  /**
   * Pasa HOY en staging: `conjunto-las-playas` tenía asientos con
   * `accountCode: "1.3"` desde la validación de la 1b, y su plan se sembró
   * después. Sin la caída a la categoría, la línea se habría llamado «1.3».
   */
  it("un asiento con cuenta cuyo plan NO la tiene se nombra por su categoría, nunca «1.3»", () => {
    const planIncompleto = planParaInformes([{ code: "9", name: "Otra cosa" }]);
    const st = buildFinancialStatement(
      [asiento({ amount: 500, category: "multa", accountCode: "1.3" })],
      0,
      0,
      planIncompleto,
    );
    expect(st.incomeByCategory[0].label).toBe("Multas");
  });
});

describe("R9 y el recaudo de Cartera van al mismo cajón", () => {
  it("el reparto por concepto se normaliza a códigos igual que los asientos", () => {
    const recaudo: RecaudoDeCartera = {
      total: 1500,
      porCategoria: new Map<LedgerCategory, number>([
        ["alicuota", 1000],
        ["multa", 500],
      ]),
    };
    const st = buildFinancialStatement([], recaudo, 0, PLAN);
    expect(st.incomeByCategory).toEqual([
      { category: "1.1", label: "Cuotas de administración", amount: 1000 },
      { category: "1.3", label: "Multas", amount: 500 },
    ]);
    // CA11: el total no cambia, solo el reparto.
    expect(st.totalIncome).toBe(1500);
  });

  it("la cuota como número suelto también cae en su cuenta, no en la clave cruda", () => {
    const st = buildFinancialStatement([], 1000, 0, PLAN);
    expect(st.incomeByCategory[0]).toEqual({
      category: "1.1",
      label: "Cuotas de administración",
      amount: 1000,
    });
  });

  it("un ingreso manual sin cuenta ni categoría no se pierde: cae en otros ingresos", () => {
    const st = buildFinancialStatement([asiento({ amount: 70 })], 0, 0, PLAN);
    expect(st.incomeByCategory[0]).toEqual({ category: "1.8", label: "Otros ingresos", amount: 70 });
  });
});

describe("el orden de las líneas", () => {
  /**
   * Un contador lee el estado en el orden del plan —1.1, 1.2, 1.3…—, no por
   * quién recaudó más. Es la parte de «con jerarquía» que da este incremento:
   * el árbol se ve en el propio código. **Los subtotales por cuenta padre no
   * entran aquí.**
   */
  it("con plan, manda el orden del plan aunque el monto diga otra cosa", () => {
    const recaudo: RecaudoDeCartera = {
      total: 600,
      porCategoria: new Map<LedgerCategory, number>([
        ["multa", 500],
        ["alicuota", 100],
      ]),
    };
    const st = buildFinancialStatement([], recaudo, 0, PLAN);
    expect(st.incomeByCategory.map((r) => r.category)).toEqual(["1.1", "1.3"]);
  });

  it("y la 1.10 va DESPUÉS de la 1.2, que como texto sería al revés", () => {
    const plan = planParaInformes([
      { code: "1.2", name: "Dos", systemKey: "extraordinaria" },
      { code: "1.10", name: "Diez", systemKey: "arriendo" },
    ]);
    const st = buildFinancialStatement(
      [
        asiento({ id: "a", amount: 10, category: "arriendo" }),
        asiento({ id: "b", amount: 20, category: "extraordinaria" }),
      ],
      0,
      0,
      plan,
    );
    expect(st.incomeByCategory.map((r) => r.category)).toEqual(["1.2", "1.10"]);
  });

  it("sin plan no hay códigos, así que conserva el orden de siempre: por monto", () => {
    const st = buildFinancialStatement(
      [
        asiento({ id: "a", amount: 10, category: "multa" }),
        asiento({ id: "b", amount: 90, category: "arriendo" }),
      ],
      0,
    );
    expect(st.incomeByCategory.map((r) => r.amount)).toEqual([90, 10]);
  });
});
