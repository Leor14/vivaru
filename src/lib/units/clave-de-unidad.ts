/**
 * El resolvedor ÚNICO de clave de unidad (`PRD-V-FIX-002`, R6) — copia del cliente.
 *
 * **LA CLAVE DE UNA UNIDAD ES EL ID DE SU DOCUMENTO.** Decisión D1, cerrada por
 * David el 25 de agosto de 2026. El campo `unitId` del documento de la unidad es
 * un slug derivado del `displayName` y **no es la clave**: es de donde nació la
 * convención minoritaria que dejó a los residentes viendo media cartera.
 *
 * Toda escritura del producto que fije `unitId` (o `payerUnitId`) pasa por aquí.
 * La razón de que exista una función para devolver `unidad.id` es que el sitio
 * que la llama se pueda LEER y que la guarda la pueda BUSCAR: `unitId: u.id` hay
 * que ir a comprobarlo, `unitId: claveDeUnidad(u)` dice lo que hace.
 *
 * ⚠️ **ESPEJO de `functions/src/clave-de-unidad.ts`**, que es donde además vive el
 * planificador de la migración. `src/` no puede importar de `functions/` —rompe el
 * build de App Hosting, ver CLAUDE.md—, así que las funciones viven dos veces y
 * `tests/clave-de-unidad-guarda.test.ts` compara las dos copias carácter a
 * carácter. Si cambias una, cambia la otra.
 */

/** Una unidad tal y como la necesita el resolvedor. */
export type UnidadDelCatalogo = {
  /** Id del documento en `units`. **Esta es la clave.** */
  id: string;
  /**
   * El campo `unitId` del documento de la unidad, que es un slug. **No es la
   * clave**, y aquí se llama `slug` a propósito: llamarlo `unitId` en el tipo
   * mantenía viva la confusión que causó toda la ficha —dos cosas distintas con
   * el mismo nombre— y hacía que la guarda de R6 no pudiera distinguir «construir
   * el catálogo» de «fabricar una clave desde el slug».
   */
  slug?: string | null;
  /** Etiqueta visible. Solo se usa para reasignar huérfanos, y solo si es única. */
  displayName?: string | null;
};

/** Índices del conjunto, calculados una vez por conjunto. */
export type CatalogoDeUnidades = {
  /** Ids de documento. Un valor que esté aquí ya es canónico. */
  ids: Set<string>;
  /** slug → ids que lo declaran. Más de uno = ambiguo. */
  porCampo: Map<string, string[]>;
  /** etiqueta normalizada → ids que la llevan. Más de uno = ambiguo. */
  porEtiqueta: Map<string, string[]>;
  /** Cuántas unidades tiene el conjunto. Un catálogo vacío no resuelve nada. */
  total: number;
};

/**
 * La clave de una unidad. **Es la única forma legítima de obtenerla**, y existe
 * para que el sitio que la escribe se pueda leer y para que la guarda la pueda
 * buscar: `unitId: claveDeUnidad(unidad)` dice lo que hace, `unitId: u.id` hay
 * que ir a comprobarlo.
 */
export function claveDeUnidad(unidad: { id: string }): string {
  return unidad.id;
}

/** trim + minúsculas + espacios colapsados. Sin plegar acentos: «Casa Ñ» no es «Casa N». */
export function normalizarEtiqueta(valor: string | null | undefined): string {
  return (valor ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function construirCatalogo(unidades: UnidadDelCatalogo[]): CatalogoDeUnidades {
  const ids = new Set<string>();
  const porCampo = new Map<string, string[]>();
  const porEtiqueta = new Map<string, string[]>();

  for (const u of unidades) {
    if (!u.id) continue;
    ids.add(u.id);

    const campo = (u.slug ?? "").trim();
    // Un campo que ya es el id no aporta una segunda vía: sería resolverse a sí mismo.
    if (campo && campo !== u.id) {
      porCampo.set(campo, [...(porCampo.get(campo) ?? []), u.id]);
    }

    const etiqueta = normalizarEtiqueta(u.displayName);
    if (etiqueta) {
      porEtiqueta.set(etiqueta, [...(porEtiqueta.get(etiqueta) ?? []), u.id]);
    }
  }

  return { ids, porCampo, porEtiqueta, total: ids.size };
}

export type ViaDeResolucion = "campo" | "etiqueta";

export type Resolucion =
  /** El documento no nombra ninguna unidad. No es un defecto: no se toca. */
  | { estado: "vacio" }
  /** Ya usa la convención ganadora. */
  | { estado: "canonica"; clave: string }
  /** Se puede llevar a la convención ganadora sin adivinar. */
  | { estado: "migrable"; clave: string; anterior: string; via: ViaDeResolucion }
  /** Casa con MÁS DE UNA unidad. R2: no se toca, se lista. */
  | { estado: "ambiguo"; valor: string; via: ViaDeResolucion; candidatos: string[] }
  /** No casa con ninguna unidad por ninguna vía. R2: no se toca, se lista. */
  | { estado: "huerfano"; valor: string };

/**
 * Resuelve un valor cualquiera contra el catálogo de un conjunto.
 *
 * El orden importa y es el de R2:
 *
 *   1. ¿Es un id de documento? → ya está bien, no se toca.
 *   2. ¿Es el campo `unitId` de **exactamente una** unidad? → migrable.
 *   3. ¿Lo es de varias? → **ambiguo**, se lista. El slug puede colisionar (D1·4).
 *   4. ¿La ETIQUETA del documento casa con **exactamente una** unidad? → migrable.
 *   5. ¿Con varias? → **ambiguo** (CF1). ¿Con ninguna? → **huérfano** (CF2).
 *
 * La etiqueta es la del documento que se está migrando (`unitLabel`), no la del
 * valor: un cargo bajo la clave inexistente `unit-t1-101` dice `unitLabel: "T1-101"`,
 * y esa es la que lo salva. **Los documentos que no llevan etiqueta —`people`,
 * `survey_responses`, las firmas— solo tienen las vías 1 a 3**, y por eso sus
 * huérfanos quedan listados: adivinar sin etiqueta no es resolver.
 */
export function resolverClaveDeUnidad(
  valor: string | null | undefined,
  catalogo: CatalogoDeUnidades,
  opciones: { etiqueta?: string | null } = {},
): Resolucion {
  const bruto = (valor ?? "").trim();
  if (!bruto) return { estado: "vacio" };

  if (catalogo.ids.has(bruto)) return { estado: "canonica", clave: bruto };

  const porCampo = catalogo.porCampo.get(bruto);
  if (porCampo && porCampo.length === 1) {
    return { estado: "migrable", clave: porCampo[0], anterior: bruto, via: "campo" };
  }
  if (porCampo && porCampo.length > 1) {
    return { estado: "ambiguo", valor: bruto, via: "campo", candidatos: [...porCampo].sort() };
  }

  const etiqueta = normalizarEtiqueta(opciones.etiqueta);
  if (etiqueta) {
    const porEtiqueta = catalogo.porEtiqueta.get(etiqueta);
    if (porEtiqueta && porEtiqueta.length === 1) {
      return { estado: "migrable", clave: porEtiqueta[0], anterior: bruto, via: "etiqueta" };
    }
    if (porEtiqueta && porEtiqueta.length > 1) {
      return { estado: "ambiguo", valor: bruto, via: "etiqueta", candidatos: [...porEtiqueta].sort() };
    }
  }

  return { estado: "huerfano", valor: bruto };
}
