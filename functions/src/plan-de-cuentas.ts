/**
 * Plan de cuentas — la parte pura (`PRD-V-PLAT-003`, entrega 1a).
 *
 * Aquí no hay Firestore ni callables: solo el formato del código, la semilla y
 * el mapa que traduce el concepto de un cargo a su cuenta. Se separó así porque
 * es la parte que decide **en qué cuenta cae el dinero**, y quería poder
 * probarla sin emulador.
 *
 * ## El mapa es el punto, y tiene dos resoluciones que no son obvias
 *
 * `BillingConcept` (7 conceptos de cargo) y `LedgerCategory` (las categorías del
 * libro) **no son el mismo vocabulario**, y hasta la 1.1 de la PRD se dio por
 * hecho que sí. Dos trampas, las dos escritas en `CUENTA_POR_CONCEPTO`:
 *
 * 1. **`administracion` existe en los dos y significa cosas distintas.** Como
 *    cargo es la cuota de administración —un INGRESO—; como categoría del libro
 *    es el gasto de administración. Resolverlo por el nombre manda el recaudo de
 *    todos los conjuntos a una cuenta de egreso. Va a `alicuota`.
 * 2. **`multa`, `reparacion` y `parqueadero` no existían** como categoría del
 *    libro. Se siembran. Si no, caerían en `otros_ingresos` por R8 desde el
 *    primer día — y `multa` es justo el ejemplo de la métrica de éxito de la PRD.
 *
 * **R8 no es la red de un mapa incompleto:** es para el concepto que alguien
 * añada mañana, no para los siete que ya sabemos que existen. Por eso
 * `cuentaParaConcepto` devuelve `porDefecto: true` cuando cae — para que quien
 * llame **avise**, en vez de tragárselo.
 *
 * ## Por qué vive en `functions/` y no en `src/`
 *
 * Lo consume `aplicarPago`, que es servidor. `src/` no puede importar de
 * `functions/` (rompe el build de App Hosting, ver CLAUDE.md). Cuando la entrega 2
 * construya el formulario del plan, `validarCodigoDeCuenta` habrá que
 * **espejarlo** en `src/lib/`, igual que el catálogo de banderas. El resto —la
 * semilla y el mapa— no hace falta espejarlo: el front lee las cuentas de
 * Firestore, no de una constante.
 */

/** Los siete conceptos de cargo. Copia deliberada de `BillingConcept` de `src/types/domain.ts`. */
export const CONCEPTOS_DE_CARGO = [
  "administracion",
  "extraordinaria",
  "multa",
  "reparacion",
  "interes_mora",
  "parqueadero",
  "otro",
] as const;

export type ConceptoDeCargo = (typeof CONCEPTOS_DE_CARGO)[number];

export type TipoDeCuenta = "ingreso" | "egreso";

export interface CuentaSembrada {
  code: string;
  name: string;
  type: TipoDeCuenta;
  /** Solo en las hijas. La jerarquía del MVP es de un nivel (D1, opción A). */
  parentCode?: string;
  /**
   * El puente con el vocabulario que ya existe. Las dos cuentas padre no lo
   * llevan: son estructura, no una categoría del libro.
   */
  systemKey?: string;
}

/**
 * Formato del código — D1, opción A, cerrada por David el 21 de agosto de 2026.
 *
 * Numérico jerárquico de **dos niveles**: `N` o `N.M`, sin ceros a la izquierda.
 *
 * El defecto que esto previene está medido en Habitanto, y la PRD lo dice sin
 * rodeos: **no fue elegir el formato, fue no validarlo**. Allí convivían dos
 * rubros `3.9` distintos y códigos con puntos de más. Lo primero lo impide el id
 * derivado del código (la base garantiza la unicidad, no una comprobación previa
 * que dos pestañas pueden ganar a la vez); lo segundo, esta expresión.
 */
const CODIGO_PATTERN = /^[1-9]\d{0,2}(\.[1-9]\d{0,2})?$/;

export type ValidacionCodigo = { ok: true; code: string } | { ok: false; error: string };

export function validarCodigoDeCuenta(raw: string): ValidacionCodigo {
  const code = raw.trim();
  if (!code) return { ok: false, error: "El código de la cuenta es obligatorio." };
  if (!CODIGO_PATTERN.test(code)) {
    return {
      ok: false,
      error:
        "El código va como 1 o 1.2 — un nivel o dos, solo dígitos, sin ceros a la izquierda " +
        "y sin un tercer nivel.",
    };
  }
  return { ok: true, code };
}

/** `true` si el código es de segundo nivel; su padre es lo que va antes del punto. */
export function codigoPadreDe(code: string): string | undefined {
  const punto = code.indexOf(".");
  return punto === -1 ? undefined : code.slice(0, punto);
}

/**
 * Id del documento, **derivado del código**. La unicidad por conjunto la
 * garantiza así la base de datos y no el cliente (PRD §11.1). La regla de
 * Firestore debe además exigir que `code` coincida con el id, o la unicidad se
 * puede burlar escribiendo un id que no corresponda.
 */
export function docIdDeCuenta(tenantId: string, code: string): string {
  return `${tenantId}_${code}`;
}

/**
 * La semilla: **16 cuentas con `systemKey`** —las 13 categorías que ya existían
 * más las 3 de ingreso que faltaban— y **2 cuentas padre**, que son estructura.
 * 18 documentos.
 *
 * Los nombres de aquí son los que matan la discrepancia de §2 de la PRD:
 * `financial-statement.ts` decía «Intereses de mora» y `functions/src/index.ts`
 * decía «Interés de mora», y el residente veía una en el correo y otra en el
 * estado financiero. **Se elige el plural**, que es el del estado financiero. Y
 * a partir de aquí la etiqueta sale del dato: renombrar la cuenta la cambia en
 * los dos sitios a la vez, que es lo que pide CA6.
 */
export const SEMILLA_PLAN_DE_CUENTAS: readonly CuentaSembrada[] = [
  { code: "1", name: "Ingresos", type: "ingreso" },
  { code: "1.1", name: "Cuotas de administración", type: "ingreso", parentCode: "1", systemKey: "alicuota" },
  { code: "1.2", name: "Cuotas extraordinarias", type: "ingreso", parentCode: "1", systemKey: "extraordinaria" },
  { code: "1.3", name: "Multas", type: "ingreso", parentCode: "1", systemKey: "multa" },
  { code: "1.4", name: "Intereses de mora", type: "ingreso", parentCode: "1", systemKey: "interes_mora" },
  { code: "1.5", name: "Parqueaderos", type: "ingreso", parentCode: "1", systemKey: "parqueadero" },
  { code: "1.6", name: "Reparaciones a cargo del residente", type: "ingreso", parentCode: "1", systemKey: "reparacion" },
  { code: "1.7", name: "Arrendamientos", type: "ingreso", parentCode: "1", systemKey: "arriendo" },
  { code: "1.8", name: "Otros ingresos", type: "ingreso", parentCode: "1", systemKey: "otros_ingresos" },

  { code: "2", name: "Egresos", type: "egreso" },
  { code: "2.1", name: "Nómina", type: "egreso", parentCode: "2", systemKey: "nomina" },
  { code: "2.2", name: "Servicios públicos", type: "egreso", parentCode: "2", systemKey: "servicios_publicos" },
  { code: "2.3", name: "Mantenimiento", type: "egreso", parentCode: "2", systemKey: "mantenimiento" },
  { code: "2.4", name: "Proveedores", type: "egreso", parentCode: "2", systemKey: "proveedores" },
  { code: "2.5", name: "Administración", type: "egreso", parentCode: "2", systemKey: "administracion" },
  { code: "2.6", name: "Seguros", type: "egreso", parentCode: "2", systemKey: "seguros" },
  { code: "2.7", name: "Impuestos", type: "egreso", parentCode: "2", systemKey: "impuestos" },
  { code: "2.8", name: "Otros egresos", type: "egreso", parentCode: "2", systemKey: "otros" },
];

/** La cuenta a la que cae un concepto sin equivalente (R8). */
export const CUENTA_OTROS_INGRESOS = "1.8";

/**
 * R11 — el mapa, explícito y en un solo sitio.
 *
 * Las dos filas marcadas son las que no se pueden deducir del nombre. Si algún
 * día alguien "simplifica" esto resolviendo por `systemKey === concepto`, el
 * recaudo de la cuota entera se va a la cuenta de egreso.
 */
export const CUENTA_POR_CONCEPTO: Record<ConceptoDeCargo, string> = {
  administracion: "1.1", // ← NO es la cuenta de egreso «Administración» (2.5)
  extraordinaria: "1.2",
  multa: "1.3",
  interes_mora: "1.4",
  parqueadero: "1.5",
  reparacion: "1.6",
  otro: CUENTA_OTROS_INGRESOS, // ← `otro` (cargo) no es `otros` (egreso, 2.8)
};

export interface ResolucionDeCuenta {
  code: string;
  /** `true` = cayó en la cuenta de R8. Quien llama TIENE que avisar. */
  porDefecto: boolean;
}

/**
 * R6 + R8. Un cargo sin concepto es una cuota de administración: es el valor por
 * defecto del propio campo (`BillingStatement.concept`, «default: administración»),
 * así que tratarlo como desconocido y mandarlo a `otros_ingresos` movería de
 * cuenta a la mayoría de los cargos que existen hoy.
 */
export function cuentaParaConcepto(concepto: string | undefined | null): ResolucionDeCuenta {
  if (!concepto) return { code: CUENTA_POR_CONCEPTO.administracion, porDefecto: false };
  const code = CUENTA_POR_CONCEPTO[concepto as ConceptoDeCargo];
  if (!code) return { code: CUENTA_OTROS_INGRESOS, porDefecto: true };
  return { code, porDefecto: false };
}

/** La cuenta sembrada que corresponde a una categoría del libro, o `undefined`. */
export function cuentaPorSystemKey(systemKey: string): CuentaSembrada | undefined {
  return SEMILLA_PLAN_DE_CUENTAS.find((c) => c.systemKey === systemKey);
}

/** La cuenta sembrada de un código, o `undefined` si el código no es de la semilla. */
export function cuentaPorCodigo(code: string): CuentaSembrada | undefined {
  return SEMILLA_PLAN_DE_CUENTAS.find((c) => c.code === code);
}

/**
 * La categoría del libro que corresponde al concepto de un cargo — es decir, el
 * `systemKey` de su cuenta.
 *
 * **`category` no se retira al llegar `accountCode`** (PRD §7.2): los informes
 * leen el código y, si falta, caen en la categoría (R9), y retirarla obligaría a
 * migrar todos los asientos ya escritos. Así que al escribir el concepto hay que
 * escribir **las dos cosas coherentes**, y esta función es la que impide que se
 * separen.
 *
 * Devuelve `otros_ingresos` para lo que no tenga cuenta sembrada, que es el
 * mismo destino que R8 le da al código.
 */
export function categoriaParaConcepto(concepto: string | undefined | null): string {
  const { code } = cuentaParaConcepto(concepto);
  return cuentaPorCodigo(code)?.systemKey ?? "otros_ingresos";
}

/**
 * Cómo se nombra el cobro en la descripción del asiento y del recibo.
 *
 * Existe porque el texto estaba **cableado a «alícuota»**: un asiento de multa
 * decía «Pago de alícuota mayo — T2-203». Mientras la categoría también decía
 * `alicuota` era coherente aunque fuese falso; en cuanto el asiento cae en la
 * cuenta de multas, el texto se queda contradiciendo a su propia cuenta.
 *
 * Son frases en minúscula y en singular porque se insertan dentro de «Pago de
 * …», no son títulos. Los nombres de las CUENTAS son otra cosa y viven en la
 * semilla, en plural.
 */
const DESCRIPCION_DE_COBRO: Record<ConceptoDeCargo, string> = {
  administracion: "alícuota",
  extraordinaria: "cuota extraordinaria",
  multa: "multa",
  interes_mora: "intereses de mora",
  parqueadero: "parqueadero",
  reparacion: "reparación",
  otro: "cargo",
};

export function descripcionDeCobro(concepto: string | undefined | null): string {
  if (!concepto) return DESCRIPCION_DE_COBRO.administracion;
  return DESCRIPCION_DE_COBRO[concepto as ConceptoDeCargo] ?? DESCRIPCION_DE_COBRO.otro;
}
