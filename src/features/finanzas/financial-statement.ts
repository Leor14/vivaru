import type { RecaudoDeCartera } from "@/lib/finanzas/conceptos-de-cargo";
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
 * **El reverso cuenta igual que lo que anula (R13).** Un reverso pierde el
 * origen al nacer —pasa a `sourceType: "reversal"`—, así que sin
 * `reversedSourceType` un reverso de multa no sería ni `billingStatement` ni
 * `alicuota`: su monto **negativo** entraría en el ingreso del libro mientras
 * Cartera ya lo descontó del cargo, y el ingreso bajaría dos veces. Es el mismo
 * defecto mirando al revés.
 *
 * La rama de `"alicuota"` es la **convivencia**: cubre todo lo escrito antes de
 * que existiera `reversedSourceType`, y lo que se siga escribiendo mientras
 * `producto-concepto-al-libro` esté apagada. No se puede quitar mientras queden
 * asientos viejos, y §4 dice que no se migran.
 */
export function esRecaudoDeCartera(
  entry: Pick<LedgerEntry, "sourceType" | "reversedSourceType" | "category">,
): boolean {
  return (
    entry.sourceType === "billingStatement" ||
    entry.reversedSourceType === "billingStatement" ||
    entry.category === "alicuota"
  );
}

/**
 * Construye el estado de ingresos y egresos por categoría a partir del libro.
 *
 * Los asientos que ya vienen contados por Cartera se omiten para no duplicar
 * (ver `esRecaudoDeCartera` y `computeFundPosition`), y lo recaudado entra por
 * la vía de Cartera, que es la fuente completa.
 *
 * **`cuota` admite dos formas, y ahí está la entrega 1b-iii.** Un número se
 * pinta entero como «Cuotas de administración» —el comportamiento de siempre, y
 * el que se conserva con `producto-concepto-al-libro` apagada—. Un
 * `RecaudoDeCartera` trae el mismo total **repartido por concepto**, y entonces
 * cada concepto tiene su línea.
 *
 * **El total es idéntico en las dos formas** (CA11): son los mismos cargos, solo
 * agrupados. Por eso el reparto se toma tal cual y no se vuelve a sumar aquí —
 * dos formas de calcular el mismo número acaban discrepando.
 */
export function buildFinancialStatement(
  entries: LedgerEntry[],
  cuota: number | RecaudoDeCartera,
  openingBalance = 0,
): FinancialStatement {
  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  const cuotaIncome = typeof cuota === "number" ? cuota : cuota.total;
  if (typeof cuota === "number") {
    if (cuotaIncome) incomeMap.set("alicuota", cuotaIncome);
  } else {
    for (const [categoria, monto] of cuota.porCategoria) {
      if (monto) incomeMap.set(categoria, (incomeMap.get(categoria) ?? 0) + monto);
    }
  }

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
