import type { LedgerEntry } from "@/types/domain";

export type CategoryTotal = { category: string; label: string; amount: number };

export type FinancialStatement = {
  incomeByCategory: CategoryTotal[];
  expenseByCategory: CategoryTotal[];
  cuotaIncome: number;
  totalIncome: number;
  totalExpenses: number;
  netResult: number;
  fundBalance: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  alicuota: "Cuotas de administración",
  extraordinaria: "Cuotas extraordinarias",
  interes_mora: "Intereses de mora",
  arriendo: "Arriendo de áreas comunes",
  otros_ingresos: "Otros ingresos",
  nomina: "Nómina",
  servicios_publicos: "Servicios públicos",
  mantenimiento: "Mantenimiento",
  proveedores: "Proveedores",
  administracion: "Administración",
  seguros: "Seguros",
  impuestos: "Impuestos",
  otros: "Otros",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/**
 * Construye el estado de ingresos y egresos por categoría a partir del libro.
 * El recaudo de cuotas (cuotaIncome, derivado de Cartera) se agrega como una
 * línea "alicuota"; los asientos de libro con esa categoría se omiten para no
 * duplicar (ver computeFundPosition).
 */
export function buildFinancialStatement(
  entries: LedgerEntry[],
  cuotaIncome: number,
  openingBalance = 0,
): FinancialStatement {
  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  if (cuotaIncome) incomeMap.set("alicuota", cuotaIncome);

  for (const entry of entries) {
    if (entry.type === "ingreso") {
      if (entry.category === "alicuota") continue;
      const key = entry.category ?? "otros_ingresos";
      incomeMap.set(key, (incomeMap.get(key) ?? 0) + entry.amount);
    } else if (entry.type === "egreso") {
      const key = entry.category ?? "otros";
      expenseMap.set(key, (expenseMap.get(key) ?? 0) + entry.amount);
    }
  }

  const toRows = (map: Map<string, number>): CategoryTotal[] =>
    [...map.entries()]
      .map(([category, amount]) => ({ category, label: categoryLabel(category), amount }))
      .sort((a, b) => b.amount - a.amount);

  const incomeByCategory = toRows(incomeMap);
  const expenseByCategory = toRows(expenseMap);
  const totalIncome = incomeByCategory.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenseByCategory.reduce((sum, item) => sum + item.amount, 0);
  const netResult = totalIncome - totalExpenses;

  return {
    incomeByCategory,
    expenseByCategory,
    cuotaIncome,
    totalIncome,
    totalExpenses,
    netResult,
    fundBalance: openingBalance + netResult,
  };
}
