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

/**
 * Etiqueta de respaldo para agrupar por `category` cuando el asiento no tiene
 * `accountCode` (R9). **Los tres últimos ingresos entraron con
 * `PRD-V-PLAT-003` 1b-ii**: sin ellos, en cuanto `aplicarPago` escribe el
 * concepto del cargo, el estado financiero muestra la clave en crudo —«multa»,
 * en minúscula y sin plural— en vez de un nombre. Los nombres son **los mismos
 * que la semilla del plan de cuentas**, para que encender la bandera no cambie
 * también el texto.
 */
const CATEGORY_LABELS: Record<string, string> = {
  alicuota: "Cuotas de administración",
  extraordinaria: "Cuotas extraordinarias",
  interes_mora: "Intereses de mora",
  multa: "Multas",
  reparacion: "Reparaciones a cargo del residente",
  parqueadero: "Parqueaderos",
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
 * Si un asiento de ingreso ya viene contado por Cartera y por tanto **no** debe
 * volver a sumarse desde el libro.
 *
 * **Mira el ORIGEN, no la categoría.** El recaudo de cargos se agrega aparte
 * como `cuotaIncome` —derivado de Cartera, que es la fuente completa— y el
 * libro tiene que descontarlo para no contarlo dos veces. Hasta el 22 de agosto
 * de 2026 ese descuento preguntaba `category !== "alicuota"`, y **acertaba por
 * accidente**: `aplicarPago` escribía `alicuota` fijo para todo, así que todo
 * cargo quedaba excluido. En cuanto el asiento lleve la cuenta de su concepto
 * (R6 de `PRD-V-PLAT-003`), una multa deja de llamarse `alicuota`, entra en el
 * ingreso del libro y **sigue estando en `cuotaIncome`**: se cuenta dos veces,
 * y justo en los conjuntos que cobran algo distinto de la cuota.
 *
 * Excluir por origen sobrevive a cualquier concepto futuro. Regla **R12**.
 *
 * La rama de `"alicuota"` es la **convivencia**: los asientos ya escritos —y
 * los que se sigan escribiendo mientras la bandera `producto-concepto-al-libro`
 * esté apagada— no llevan `sourceType` fiable en todos los casos, y el reverso
 * de un pago se guarda como `sourceType: "reversal"`. No se puede quitar hasta
 * que el reverso arrastre el origen del asiento que anula.
 */
export function esRecaudoDeCartera(entry: Pick<LedgerEntry, "sourceType" | "category">): boolean {
  return entry.sourceType === "billingStatement" || entry.category === "alicuota";
}

/**
 * Construye el estado de ingresos y egresos por categoría a partir del libro.
 * El recaudo de cuotas (cuotaIncome, derivado de Cartera) se agrega como una
 * línea "alicuota"; los asientos que ya vienen contados por Cartera se omiten
 * para no duplicar (ver `esRecaudoDeCartera` y `computeFundPosition`).
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
      if (esRecaudoDeCartera(entry)) continue;
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
