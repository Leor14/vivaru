import { compararCodigos } from "@/lib/finanzas/codigo-de-cuenta";
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
 * El plan de cuentas, reducido a lo que un informe necesita (**R9** y **CA6**).
 *
 * ## La decisión que R9 no resuelve, y hay que tomar
 *
 * La regla dice «un informe agrupa por `accountCode`; si el asiento no lo tiene,
 * usa `category`». **Leído al pie de la letra parte en DOS filas lo que es una
 * sola cuenta:** los asientos escritos antes de `PLAT-003` caen en el cajón
 * `multa` y los de después en el `1.3`, con el mismo nombre y sumando por
 * separado. El estado financiero mostraría «Multas» dos veces.
 *
 * Y no se puede arreglar migrando: §4 dice que los asientos históricos **no se
 * recalculan**. Así que la categoría se **normaliza** a su código por
 * `systemKey`, que es para lo que ese puente existe. CA8 se sigue cumpliendo —el
 * asiento viejo sigue apareciendo— y además aparece **donde le toca**.
 *
 * ## Sin plan, nada cambia
 *
 * Un conjunto sin plan sembrado no tiene con qué resolver, así que cae en
 * `CATEGORY_LABELS` y se comporta como siempre. Y un plan recién sembrado trae
 * **los mismos nombres** que ese mapa —se eligieron así a propósito—, de modo
 * que encender esto no mueve un solo texto hasta que alguien renombre una
 * cuenta. Que es justo lo que pide CA6.
 */
export type PlanParaInformes = {
  /** `systemKey` → código. Es lo que mete a los asientos viejos en el mismo cajón. */
  codigoPorSystemKey: Map<string, string>;
  /** código → nombre. Que la etiqueta salga de aquí es lo que hace posible CA6. */
  nombrePorCodigo: Map<string, string>;
};

export function planParaInformes(
  accounts: ReadonlyArray<{ code: string; name: string; systemKey?: string }>,
): PlanParaInformes | undefined {
  if (!accounts.length) return undefined;
  const codigoPorSystemKey = new Map<string, string>();
  const nombrePorCodigo = new Map<string, string>();
  for (const cuenta of accounts) {
    nombrePorCodigo.set(cuenta.code, cuenta.name);
    if (cuenta.systemKey) codigoPorSystemKey.set(cuenta.systemKey, cuenta.code);
  }
  return { codigoPorSystemKey, nombrePorCodigo };
}

/**
 * El cajón en el que cae un movimiento: su cuenta, o la de su categoría.
 *
 * **El código manda SOLO si el plan sabe nombrarlo.** Un código que nadie puede
 * nombrar no es un cajón: es un número.
 *
 * Esa condición no estaba en la primera versión y era un defecto de los que solo
 * se ven en el ambiente equivocado. **Sin plan sembrado** —la condición de
 * producción, y la de siete de los ocho conjuntos de staging— un egreso viejo
 * caía en `mantenimiento` y uno nuevo, que ya lleva `accountCode`, en `2.3`: dos
 * filas **con la misma etiqueta «Mantenimiento»**. Justo el defecto que R9 se
 * diseñó para evitar, entrando por la puerta de atrás.
 *
 * Se le escapó a la prueba de «sin plan» porque tenía **un solo asiento**, y
 * hace falta la mezcla de uno viejo y uno nuevo para que se parta.
 */
function cajonDe(
  accountCode: string | undefined,
  category: string | undefined,
  plan: PlanParaInformes | undefined,
  porDefecto: string,
): string {
  if (accountCode && plan?.nombrePorCodigo.has(accountCode)) return accountCode;
  // Sin plan que lo nombre, manda la categoría — que es lo que los asientos
  // viejos tienen y lo único que los dos comparten.
  if (category) return plan?.codigoPorSystemKey.get(category) ?? category;
  if (accountCode) return accountCode;
  // El caso por defecto se normaliza igual que una categoría cualquiera, o un
  // ingreso manual sin categoría caería en `otros_ingresos` mientras el resto
  // del estado ya habla en códigos.
  return plan?.codigoPorSystemKey.get(porDefecto) ?? porDefecto;
}

/**
 * El nombre de una línea. Tres escalones, y el tercero importa: un asiento puede
 * llevar `accountCode` de un conjunto **sin plan sembrado** —pasa hoy mismo en
 * staging—, y sin la caída a la categoría la línea se llamaría «1.3».
 */
function etiquetaDe(
  cajon: string,
  category: string | undefined,
  plan: PlanParaInformes | undefined,
): string {
  const delPlan = plan?.nombrePorCodigo.get(cajon);
  if (delPlan) return delPlan;
  return categoryLabel(category ?? cajon);
}

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
  cuota_vigilancia: "Cuotas de vigilancia",
  anticipo: "Anticipos de residentes",
  otros_ingresos: "Otros ingresos",
  nomina: "Nómina",
  servicios_publicos: "Servicios públicos",
  mantenimiento: "Mantenimiento",
  proveedores: "Proveedores",
  administracion: "Administración",
  seguros: "Seguros",
  impuestos: "Impuestos",
  vigilancia: "Vigilancia y seguridad",
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
  plan?: PlanParaInformes,
): FinancialStatement {
  // Se guarda la etiqueta junto al monto porque el cajón puede ser un código
  // (`1.3`) y el nombre venir de la categoría del asiento que cayó en él. Sin
  // esto habría que volver a recorrer los asientos para saber cómo se llama.
  const incomeMap = new Map<string, { amount: number; label: string }>();
  const expenseMap = new Map<string, { amount: number; label: string }>();

  const acumular = (
    map: Map<string, { amount: number; label: string }>,
    cajon: string,
    label: string,
    amount: number,
  ) => {
    const actual = map.get(cajon);
    // El primero que cae fija la etiqueta: si dos asientos del mismo cajón
    // traen nombres distintos —uno con plan y otro sin él—, quedarse con el
    // primero es arbitrario pero estable. Con plan sembrado nunca difieren.
    map.set(cajon, { amount: (actual?.amount ?? 0) + amount, label: actual?.label ?? label });
  };

  const cuotaIncome = typeof cuota === "number" ? cuota : cuota.total;
  if (typeof cuota === "number") {
    if (cuotaIncome) {
      const cajon = cajonDe(undefined, "alicuota", plan, "alicuota");
      acumular(incomeMap, cajon, etiquetaDe(cajon, "alicuota", plan), cuotaIncome);
    }
  } else {
    for (const [categoria, monto] of cuota.porCategoria) {
      if (!monto) continue;
      const cajon = cajonDe(undefined, categoria, plan, "otros_ingresos");
      acumular(incomeMap, cajon, etiquetaDe(cajon, categoria, plan), monto);
    }
  }

  for (const entry of entries) {
    if (entry.type === "ingreso") {
      if (esRecaudoDeCartera(entry)) continue;
      const cajon = cajonDe(entry.accountCode, entry.category, plan, "otros_ingresos");
      acumular(incomeMap, cajon, etiquetaDe(cajon, entry.category, plan), entry.amount);
    } else if (entry.type === "egreso") {
      const cajon = cajonDe(entry.accountCode, entry.category, plan, "otros");
      acumular(expenseMap, cajon, etiquetaDe(cajon, entry.category, plan), entry.amount);
    }
  }

  /**
   * Orden del plan cuando hay códigos, y por monto cuando no.
   *
   * Un contador lee el estado en el orden del plan —1.1, 1.2, 1.3…—, no por
   * quién recaudó más. Es la parte de «con jerarquía» que da este incremento:
   * el árbol se ve en el propio código. **Los subtotales por cuenta padre NO
   * entran aquí**; cambiarían la forma del Excel y del informe, y son otra cosa.
   *
   * Un conjunto sin plan no tiene códigos, así que conserva el orden de siempre.
   */
  const esCodigo = (k: string) => /^[1-9]\d{0,2}(\.[1-9]\d{0,2})?$/.test(k);
  const toRows = (map: Map<string, { amount: number; label: string }>): CategoryTotal[] =>
    [...map.entries()]
      .map(([category, { amount, label }]) => ({ category, label, amount }))
      .sort((a, b) => {
        const ca = esCodigo(a.category);
        const cb = esCodigo(b.category);
        if (ca && cb) return compararCodigos(a.category, b.category);
        if (ca !== cb) return ca ? -1 : 1;
        return b.amount - a.amount;
      });

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
