import type {
  BillingConcept,
  BillingStatement,
  ExpenseCategory,
  LedgerCategory,
} from "@/types/domain";

/**
 * El reparto del recaudo por concepto (`PRD-V-PLAT-003`, entrega 1b-iii).
 *
 * ## Por qué esto existe, y por qué no bastaba con escribir la cuenta
 *
 * La 1b-ii hizo que el asiento de un cobro lleve la cuenta de su concepto. Pero
 * **el estado financiero seguía enseñando una sola línea**, y no por un
 * descuido: los asientos de cobro están **excluidos a propósito** para no contar
 * dos veces lo que ya suma Cartera (`esRecaudoDeCartera`), y lo que Cartera
 * aportaba era **un único número**, `cuotaIncome`, que se pintaba entero como
 * «Cuotas de administración».
 *
 * Así que un conjunto que cobraba multas veía su multa dentro de la cuota, con
 * la cuenta correcta escrita en un asiento que nadie mostraba. **Escribir la
 * cuenta era necesario y no era suficiente.**
 *
 * El reparto sale de **Cartera y no del libro** por lo mismo que salía de ahí el
 * total: Cartera es la fuente completa. Y por construcción **la suma no cambia**
 * —son los mismos cargos, solo agrupados—, que es exactamente lo que pide CA11.
 *
 * ## Este mapa es un ESPEJO, y hay una prueba que lo vigila
 *
 * El original vive en `functions/src/plan-de-cuentas.ts`. No se puede importar:
 * `src/` no puede depender de `functions/` sin romper el build de App Hosting
 * (ver CLAUDE.md), y la PRD ya anticipaba que habría que espejarlo.
 *
 * **Un espejo copiado a mano es justo el error que este repositorio ya cometió
 * tres veces** —el catálogo de banderas en cuatro sitios, la exclusión del libro
 * en tres—. Por eso no se deja al cuidado de nadie: `tests/plan-de-cuentas-espejo.test.ts`
 * **lee el fichero de `functions/` como texto** y compara. Leerlo no es
 * importarlo, así que la prohibición no aplica, y si alguien toca un lado sin el
 * otro la prueba se pone roja.
 */
export const CATEGORIA_POR_CONCEPTO: Record<BillingConcept, LedgerCategory> = {
  // Como CARGO es la cuota de administración, un INGRESO. La categoría de libro
  // `administracion` es el GASTO de administración: resolverlo por el nombre
  // manda el recaudo entero de todos los conjuntos a una cuenta de egreso.
  administracion: "alicuota",
  extraordinaria: "extraordinaria",
  multa: "multa",
  reparacion: "reparacion",
  interes_mora: "interes_mora",
  parqueadero: "parqueadero",
  // `otro` (cargo) no es `otros` (egreso).
  otro: "otros_ingresos",
};

/** Las dos cuentas de destino de R8, una por lado del libro. */
export const CUENTA_OTROS_INGRESOS = "1.8";
export const CUENTA_OTROS_EGRESOS = "2.8";

/**
 * El mismo mapa de arriba, pero a **código de cuenta** (§7.2, R9).
 *
 * Convive con `CATEGORIA_POR_CONCEPTO` en vez de sustituirlo porque los dos se
 * escriben a la vez y tienen que ser coherentes: el cargo lleva `accountCode`, el
 * asiento que nace de cobrarlo lleva código **y** categoría, y R9 dice que los
 * informes leen el código y solo caen en la categoría si falta. Separar los dos
 * mapas en dos ficheros sería la forma segura de que uno se quedara atrás.
 *
 * Espejo de `CUENTA_POR_CONCEPTO` de `functions/src/plan-de-cuentas.ts`, vigilado
 * por `tests/plan-de-cuentas-espejo.test.ts`.
 */
export const CODIGO_POR_CONCEPTO: Record<BillingConcept, string> = {
  // Como CARGO es la cuota de administración, un INGRESO. La cuenta de egreso
  // «Administración» es la 2.5, y mandar aquí el recaudo entero de un conjunto
  // es exactamente lo que R11 existe para impedir.
  administracion: "1.1",
  extraordinaria: "1.2",
  multa: "1.3",
  interes_mora: "1.4",
  parqueadero: "1.5",
  reparacion: "1.6",
  // `otro` (cargo) no es `otros` (egreso, 2.8).
  otro: CUENTA_OTROS_INGRESOS,
};

/**
 * La cuenta de un cargo. **Un cargo sin concepto es cuota de administración**, que
 * es el valor por defecto del propio campo: tratarlo como desconocido movería de
 * cuenta a la mayoría de los cargos que existen hoy.
 */
export function codigoDeConcepto(concepto: string | undefined | null): string {
  if (!concepto) return CODIGO_POR_CONCEPTO.administracion;
  return CODIGO_POR_CONCEPTO[concepto as BillingConcept] ?? CUENTA_OTROS_INGRESOS;
}

/**
 * La cuenta de un egreso, desde su categoría. Espejo de
 * `cuentaParaCategoriaDeEgreso`.
 *
 * **`administracion` vale `2.5` aquí y `1.1` en el mapa de arriba, y las dos son
 * correctas.** Es la misma palabra en dos vocabularios distintos; por eso son dos
 * mapas y no uno con una rama.
 */
export const CODIGO_POR_CATEGORIA_DE_EGRESO: Record<ExpenseCategory, string> = {
  nomina: "2.1",
  servicios_publicos: "2.2",
  mantenimiento: "2.3",
  proveedores: "2.4",
  administracion: "2.5",
  seguros: "2.6",
  impuestos: "2.7",
  otros: CUENTA_OTROS_EGRESOS,
};

export function codigoDeCategoriaDeEgreso(categoria: string | undefined | null): string {
  if (!categoria) return CUENTA_OTROS_EGRESOS;
  return CODIGO_POR_CATEGORIA_DE_EGRESO[categoria as ExpenseCategory] ?? CUENTA_OTROS_EGRESOS;
}

/** A qué línea del estado financiero va lo recaudado por un cargo. */
export function categoriaDeConcepto(concepto: string | undefined | null): LedgerCategory {
  if (!concepto) return "alicuota";
  return CATEGORIA_POR_CONCEPTO[concepto as BillingConcept] ?? "otros_ingresos";
}

/**
 * Lo recaudado por Cartera, repartido por categoría **y con su total**.
 *
 * El total va en el mismo objeto a propósito: quien lo consuma no debe tener que
 * volver a sumar el mapa para saber cuánto entró. Si lo sumara por su cuenta,
 * habría dos formas de calcular el mismo número, y tarde o temprano una de las
 * dos se quedaría atrás.
 */
export interface RecaudoDeCartera {
  total: number;
  porCategoria: Map<LedgerCategory, number>;
}

export function repartirRecaudo(
  statements: Pick<BillingStatement, "concept" | "paymentAmount">[],
): RecaudoDeCartera {
  const porCategoria = new Map<LedgerCategory, number>();
  let total = 0;
  for (const s of statements) {
    const pagado = typeof s.paymentAmount === "number" ? s.paymentAmount : 0;
    if (!pagado) continue;
    total += pagado;
    const cat = categoriaDeConcepto(s.concept);
    porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + pagado);
  }
  return { total, porCategoria };
}
