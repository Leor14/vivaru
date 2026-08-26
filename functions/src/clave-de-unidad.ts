/**
 * El resolvedor ÚNICO de clave de unidad (`PRD-V-FIX-002`, R6).
 *
 * **LA CLAVE DE UNA UNIDAD ES EL ID DE SU DOCUMENTO.** Decisión D1, cerrada por
 * David el 25 de agosto de 2026, y no es una preferencia de estilo:
 *
 *   1. Es la mayoría del dato — 197 de 221 cargos en producción.
 *   2. Es lo que guarda `tenantUsers.unitId`, que es contra lo que compara
 *      `residentOwnUnit` en `firestore.rules`. Elegir el slug obligaría a migrar
 *      la raíz de los permisos.
 *   3. Es lo que escribe el código más reciente (corrida por coeficiente, prorrateo).
 *   4. **No puede colisionar.** El slug se deriva de la etiqueta y dos unidades
 *      pueden compartir etiqueta; el id de documento es único por construcción.
 *
 * **EL CAMPO `unitId` DEL DOCUMENTO DE LA UNIDAD NO ES LA CLAVE.** Es un slug que
 * `updateUnit` deriva del `displayName`, y es exactamente de donde nació la
 * convención minoritaria. Sigue existiendo —retirarlo rompería lectores que la
 * ficha deja para Fase 2— pero **nadie puede usarlo para nombrar una unidad**.
 *
 * **Por qué esto no se resuelve con una expresión regular.** Las dos migraciones
 * anteriores lo intentaron (`/^unit-[a-z0-9]+(-[a-z0-9]+)*$/` en
 * `scripts/migrate-billing-unit-ids.ts`) y no podían acertar: en producción
 * conviven slugs con prefijo (`unit-t1-101`), slugs sin prefijo (`t1-101`,
 * `1014`), ids sembrados que PARECEN slugs (`u-t1-101`, que sí es un id de
 * documento) e ids autogenerados. Un valor solo se puede clasificar
 * **mirándolo contra el catálogo de unidades del conjunto**, nunca por su forma.
 *
 * ⚠️ **ESPEJO de `src/lib/units/clave-de-unidad.ts`.** `src/` no puede importar de
 * `functions/` (rompe el build de App Hosting, ver CLAUDE.md), así que el
 * resolvedor vive dos veces y `tests/clave-de-unidad-guarda.test.ts` compara las
 * dos copias. Si cambias una, cambia la otra. Lo que vive **solo aquí** es el
 * planificador de la migración, que es una operación de plataforma.
 */

/** Una unidad tal y como la necesita el resolvedor. */
export type UnidadDelCatalogo = {
  /** Id del documento en `units`. **Esta es la clave.** */
  id: string;
  /** El campo `unitId` del documento, que es un slug. **No es la clave.** */
  unitId?: string | null;
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

    const campo = (u.unitId ?? "").trim();
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

// ───────────────────────────────────────────────────────────────────────────────
// El planificador de la migración. **Vive solo aquí**: es una operación de
// plataforma que corre un superadmin con script (§11.1), no una funcionalidad del
// producto, y por eso no tiene espejo en `src/`.
// ───────────────────────────────────────────────────────────────────────────────

export type ColeccionConClave = {
  nombre: string;
  /** El campo que nombra la unidad. `paymentVouchers` es la excepción. */
  campoClave: "unitId" | "payerUnitId";
  /** El campo con la etiqueta, si lo hay. Sin él, un huérfano no se puede salvar. */
  campoEtiqueta?: string;
  /** `tenantUsers` es contra lo que compara `residentOwnUnit`. Va la ÚLTIMA. */
  raizDelPermiso?: boolean;
};

/**
 * **Las colecciones que llevan clave de unidad, contadas una a una.**
 *
 * La ficha decía «once» y enumeraba más: son **dieciocho**, y la cuenta importa
 * porque migrar diecisiete deja la que falte fuera del alcance de su dueño. Se
 * sacaron cruzando `firestore.rules` —quince las gobierna `residentOwnUnit`— con
 * las tres de identidad (`people`, `users`, `tenantUsers`). `clearanceCertificates`
 * no estaba en la lista de la ficha y sí en las reglas.
 *
 * `advanceApplications` y `clearanceCertificates` están VACÍAS en producción hoy;
 * se recorren igual, porque el día que dejen de estarlo nadie va a acordarse.
 */
export const COLECCIONES_CON_CLAVE_DE_UNIDAD: ColeccionConClave[] = [
  { nombre: "billingStatements", campoClave: "unitId", campoEtiqueta: "unitLabel" },
  { nombre: "advances", campoClave: "unitId", campoEtiqueta: "unitLabel" },
  { nombre: "advanceApplications", campoClave: "unitId", campoEtiqueta: "unitLabel" },
  { nombre: "paymentReceipts", campoClave: "unitId", campoEtiqueta: "unitLabel" },
  { nombre: "paymentVouchers", campoClave: "payerUnitId", campoEtiqueta: "payerUnitLabel" },
  { nombre: "clearanceCertificates", campoClave: "unitId", campoEtiqueta: "unitLabel" },
  { nombre: "reservations", campoClave: "unitId", campoEtiqueta: "unitLabel" },
  { nombre: "packages", campoClave: "unitId", campoEtiqueta: "unitLabel" },
  { nombre: "visitorPasses", campoClave: "unitId", campoEtiqueta: "unitLabel" },
  { nombre: "visitorAuthorizations", campoClave: "unitId" },
  { nombre: "visitorInvitations", campoClave: "unitId" },
  { nombre: "tickets", campoClave: "unitId", campoEtiqueta: "unitLabel" },
  { nombre: "survey_responses", campoClave: "unitId" },
  { nombre: "regulation_signatures", campoClave: "unitId" },
  { nombre: "committee_agreement_signatures", campoClave: "unitId" },
  { nombre: "people", campoClave: "unitId" },
  { nombre: "users", campoClave: "unitId", campoEtiqueta: "unitLabel" },
  // **La última, y a propósito (R8).** Si se migrase primero y el script muriera a
  // media pasada, el residente quedaría apuntando a una clave que casi ningún
  // documento tiene todavía: se quedaría sin ver NADA. Migrando el dato primero,
  // lo que ve solo puede aumentar, y una corrida a medias se retoma (R4).
  { nombre: "tenantUsers", campoClave: "unitId", campoEtiqueta: "unitLabel", raizDelPermiso: true },
];

export type DocumentoConClave = { id: string; datos: Record<string, unknown> };

export type AccionPlaneada =
  | { accion: "sin-clave"; coleccion: string; docId: string }
  | { accion: "ya-canonica"; coleccion: string; docId: string; clave: string }
  | {
      accion: "escribir";
      coleccion: string;
      docId: string;
      campoClave: "unitId" | "payerUnitId";
      de: string;
      a: string;
      via: ViaDeResolucion;
      etiqueta: string | null;
    }
  | {
      accion: "listar";
      coleccion: string;
      docId: string;
      motivo: "ambiguo" | "huerfano";
      valor: string;
      etiqueta: string | null;
      candidatos: string[];
    };

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

/** Planifica UN documento. Puro: no lee ni escribe nada. */
export function planificarDocumento(
  coleccion: ColeccionConClave,
  doc: DocumentoConClave,
  catalogo: CatalogoDeUnidades,
): AccionPlaneada {
  const valor = texto(doc.datos[coleccion.campoClave]);
  const etiqueta = coleccion.campoEtiqueta ? texto(doc.datos[coleccion.campoEtiqueta]) : null;
  const r = resolverClaveDeUnidad(valor, catalogo, { etiqueta });

  switch (r.estado) {
    case "vacio":
      return { accion: "sin-clave", coleccion: coleccion.nombre, docId: doc.id };
    case "canonica":
      return { accion: "ya-canonica", coleccion: coleccion.nombre, docId: doc.id, clave: r.clave };
    case "migrable":
      return {
        accion: "escribir",
        coleccion: coleccion.nombre,
        docId: doc.id,
        campoClave: coleccion.campoClave,
        de: r.anterior,
        a: r.clave,
        via: r.via,
        etiqueta,
      };
    case "ambiguo":
      return {
        accion: "listar",
        coleccion: coleccion.nombre,
        docId: doc.id,
        motivo: "ambiguo",
        valor: r.valor,
        etiqueta,
        candidatos: r.candidatos,
      };
    case "huerfano":
      return {
        accion: "listar",
        coleccion: coleccion.nombre,
        docId: doc.id,
        motivo: "huerfano",
        valor: r.valor,
        etiqueta,
        candidatos: [],
      };
  }
}

/**
 * Los campos que la migración añade a cada documento tocado.
 *
 * **`unitIdPrevio` es lo único que hace reversible esto** (R3, §13). Sin él el
 * rollback no existe: el valor viejo y el nuevo son los dos plausibles y no hay
 * forma de reconstruir cuál era. Se llama igual en las dieciocho colecciones
 * aunque `paymentVouchers` guarde la clave en `payerUnitId`, porque cada
 * colección tiene un solo campo de clave y la vuelta atrás sabe cuál es.
 *
 * Los dos son **temporales**: se retiran cuando la migración se dé por cerrada, y
 * esa retirada es una decisión aparte con su propia fecha (§7.2).
 */
export const CAMPO_PREVIO = "unitIdPrevio";
export const CAMPO_MIGRADO_EN = "unitIdMigradoEn";

/**
 * Un documento ya migrado antes **no se vuelve a marcar**: `unitIdPrevio` debe
 * conservar el valor ORIGINAL, no el de la última pasada. R4 hace que esto no
 * llegue a pasar —tras migrar, el valor ya es canónico y no se reescribe—, pero
 * si algún día vuelve a moverse, el primer valor es el que permite volver.
 */
export function camposDeLaEscritura(
  accion: Extract<AccionPlaneada, { accion: "escribir" }>,
  datosActuales: Record<string, unknown>,
  ahora: unknown,
): Record<string, unknown> {
  const yaTienePrevio = typeof datosActuales[CAMPO_PREVIO] === "string";
  return {
    [accion.campoClave]: accion.a,
    ...(yaTienePrevio ? {} : { [CAMPO_PREVIO]: accion.de }),
    [CAMPO_MIGRADO_EN]: ahora,
  };
}

/**
 * El estado de la migración de un conjunto (§6). **Vive en el informe, no en un
 * documento del producto**: persistirlo crearía una segunda verdad que puede
 * discrepar de la realidad, y la realidad se vuelve a medir corriendo el informe,
 * que es barato.
 *
 * **`limpio` exige cero huérfanos, no solo cero partidas.** La primera versión de
 * esto daba LIMPIO a un conjunto con un `tenantUsers` huérfano —un residente que
 * no ve nada— porque no había nada *migrable*. Un informe que da el visto bueno
 * sobre un conjunto roto es el mismo defecto que la ficha persigue, escrito en la
 * herramienta que viene a arreglarlo.
 */
export type EstadoDelConjunto = "sin-unidades" | "limpio" | "partido" | "bloqueado";

export function estadoDelConjunto(cuenta: {
  unidades: number;
  migrables: number;
  huerfanos: number;
  ambiguos: number;
}): EstadoDelConjunto {
  if (cuenta.unidades === 0) return "sin-unidades";
  if (cuenta.huerfanos + cuenta.ambiguos > 0) return "bloqueado";
  if (cuenta.migrables > 0) return "partido";
  return "limpio";
}
