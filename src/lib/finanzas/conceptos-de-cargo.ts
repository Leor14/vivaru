import type { BillingConcept, BillingStatement, LedgerCategory } from "@/types/domain";

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
