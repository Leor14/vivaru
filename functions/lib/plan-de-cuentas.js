"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CUENTA_OTROS_EGRESOS = exports.CUENTA_POR_CONCEPTO = exports.CUENTA_ANTICIPO = exports.CUENTA_OTROS_INGRESOS = exports.SEMILLA_PLAN_DE_CUENTAS = exports.CONCEPTOS_DE_CARGO = void 0;
exports.validarCodigoDeCuenta = validarCodigoDeCuenta;
exports.codigoPadreDe = codigoPadreDe;
exports.docIdDeCuenta = docIdDeCuenta;
exports.cuentaParaConcepto = cuentaParaConcepto;
exports.cuentaPorSystemKey = cuentaPorSystemKey;
exports.cuentaPorCodigo = cuentaPorCodigo;
exports.cuentaParaCategoriaDeEgreso = cuentaParaCategoriaDeEgreso;
exports.categoriaParaConcepto = categoriaParaConcepto;
exports.descripcionDeCobro = descripcionDeCobro;
/** Los siete conceptos de cargo. Copia deliberada de `BillingConcept` de `src/types/domain.ts`. */
exports.CONCEPTOS_DE_CARGO = [
    "administracion",
    "extraordinaria",
    "multa",
    "reparacion",
    "interes_mora",
    "parqueadero",
    "vigilancia",
    "otro",
];
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
function validarCodigoDeCuenta(raw) {
    const code = raw.trim();
    if (!code)
        return { ok: false, error: "El código de la cuenta es obligatorio." };
    if (!CODIGO_PATTERN.test(code)) {
        return {
            ok: false,
            error: "El código va como 1 o 1.2 — un nivel o dos, solo dígitos, sin ceros a la izquierda " +
                "y sin un tercer nivel.",
        };
    }
    return { ok: true, code };
}
/** `true` si el código es de segundo nivel; su padre es lo que va antes del punto. */
function codigoPadreDe(code) {
    const punto = code.indexOf(".");
    return punto === -1 ? undefined : code.slice(0, punto);
}
/**
 * Id del documento, **derivado del código**. La unicidad por conjunto la
 * garantiza así la base de datos y no el cliente (PRD §11.1). La regla de
 * Firestore debe además exigir que `code` coincida con el id, o la unicidad se
 * puede burlar escribiendo un id que no corresponda.
 */
function docIdDeCuenta(tenantId, code) {
    return `${tenantId}_${code}`;
}
/**
 * La semilla: **19 cuentas con `systemKey`** y **2 cuentas padre**, que son
 * estructura. 21 documentos.
 *
 * Fueron 16 hasta el 23 de agosto de 2026 —las 13 categorías que ya existían más
 * las 3 de ingreso que faltaban—. Las dos nuevas son la vigilancia, que David
 * decidió partir en sus dos lados: la cuota que se le cobra al residente (1.9,
 * ingreso) y lo que se le paga a la empresa (2.9, egreso). Antes la primera no
 * existía y la segunda caía en «Proveedores», donde la mayor partida del
 * presupuesto de un conjunto quedaba mezclada con los insumos de limpieza.
 *
 * Los nombres de aquí son los que matan la discrepancia de §2 de la PRD:
 * `financial-statement.ts` decía «Intereses de mora» y `functions/src/index.ts`
 * decía «Interés de mora», y el residente veía una en el correo y otra en el
 * estado financiero. **Se elige el plural**, que es el del estado financiero. Y
 * a partir de aquí la etiqueta sale del dato: renombrar la cuenta la cambia en
 * los dos sitios a la vez, que es lo que pide CA6.
 */
exports.SEMILLA_PLAN_DE_CUENTAS = [
    { code: "1", name: "Ingresos", type: "ingreso" },
    { code: "1.1", name: "Cuotas de administración", type: "ingreso", parentCode: "1", systemKey: "alicuota" },
    { code: "1.2", name: "Cuotas extraordinarias", type: "ingreso", parentCode: "1", systemKey: "extraordinaria" },
    { code: "1.3", name: "Multas", type: "ingreso", parentCode: "1", systemKey: "multa" },
    { code: "1.4", name: "Intereses de mora", type: "ingreso", parentCode: "1", systemKey: "interes_mora" },
    { code: "1.5", name: "Parqueaderos", type: "ingreso", parentCode: "1", systemKey: "parqueadero" },
    { code: "1.6", name: "Reparaciones a cargo del residente", type: "ingreso", parentCode: "1", systemKey: "reparacion" },
    { code: "1.7", name: "Arrendamientos", type: "ingreso", parentCode: "1", systemKey: "arriendo" },
    { code: "1.8", name: "Otros ingresos", type: "ingreso", parentCode: "1", systemKey: "otros_ingresos" },
    // La cuota de vigilancia (decision de David, 23 ago 2026). Su `systemKey` NO
    // es "vigilancia": esa la lleva la cuenta de EGRESO 2.9, y repetir la clave
    // seria fabricar la colision de `administracion` que R11 existe para impedir.
    // Un `cuentaPorSystemKey("vigilancia")` acabaria devolviendo la de ingreso o
    // la de egreso segun el orden del array.
    { code: "1.9", name: "Cuotas de vigilancia", type: "ingreso", parentCode: "1", systemKey: "cuota_vigilancia" },
    // El anticipo (FLOW-002). Va en cuenta PROPIA y no en «Otros ingresos» porque
    // D1 prometio que el saldo a favor se presenta en su propia linea: un mes con
    // muchos anticipos muestra mas ingreso del que corresponde a sus cuotas, y
    // esconderlo dentro de otro cajon es justo lo que hace ilegible ese mes.
    //
    // Sin esta fila el asiento del anticipo cae en `cajonDe(..., "anticipo", ...)`
    // sin codigo, y en un conjunto CON plan sembrado su linea quedaria etiquetada
    // por la categoria mientras el resto del estado habla en codigos.
    { code: "1.10", name: "Anticipos de residentes", type: "ingreso", parentCode: "1", systemKey: "anticipo" },
    { code: "2", name: "Egresos", type: "egreso" },
    { code: "2.1", name: "Nómina", type: "egreso", parentCode: "2", systemKey: "nomina" },
    { code: "2.2", name: "Servicios públicos", type: "egreso", parentCode: "2", systemKey: "servicios_publicos" },
    { code: "2.3", name: "Mantenimiento", type: "egreso", parentCode: "2", systemKey: "mantenimiento" },
    { code: "2.4", name: "Proveedores", type: "egreso", parentCode: "2", systemKey: "proveedores" },
    { code: "2.5", name: "Administración", type: "egreso", parentCode: "2", systemKey: "administracion" },
    { code: "2.6", name: "Seguros", type: "egreso", parentCode: "2", systemKey: "seguros" },
    { code: "2.7", name: "Impuestos", type: "egreso", parentCode: "2", systemKey: "impuestos" },
    { code: "2.8", name: "Otros egresos", type: "egreso", parentCode: "2", systemKey: "otros" },
    { code: "2.9", name: "Vigilancia y seguridad", type: "egreso", parentCode: "2", systemKey: "vigilancia" },
];
/**
 * **Por que la vigilancia va en la 1.9 y la 2.9, detras de «Otros».**
 *
 * Leido en orden queda raro: «Otros ingresos» antes que «Cuotas de vigilancia».
 * La alternativa era renumerar `otros_ingresos` a 1.9 y meter la vigilancia en
 * la 1.8 — y hoy saldria gratis, porque en produccion no hay ni un plan
 * sembrado—. **No se hace, y no por pereza:** R3 dice que una cuenta de sistema
 * no se renumera, el codigo ES la identidad de la cuenta, y un plan que se
 * renumera cuando entra un rubro nuevo es exactamente el plan de Habitanto.
 * El precio de no renumerar nunca es que «Otros» deja de ir al final. Es barato.
 */
/** La cuenta a la que cae un concepto sin equivalente (R8). */
exports.CUENTA_OTROS_INGRESOS = "1.8";
/**
 * `FLOW-002`. La cuenta del anticipo. Se nombra aquí y no se teclea en
 * `payments.ts` porque el código de una cuenta es un dato del plan: escribirlo a
 * mano en otro fichero es cómo empiezan las discrepancias que R11 previene.
 */
exports.CUENTA_ANTICIPO = "1.10";
/**
 * R11 — el mapa, explícito y en un solo sitio.
 *
 * Las dos filas marcadas son las que no se pueden deducir del nombre. Si algún
 * día alguien "simplifica" esto resolviendo por `systemKey === concepto`, el
 * recaudo de la cuota entera se va a la cuenta de egreso.
 */
exports.CUENTA_POR_CONCEPTO = {
    administracion: "1.1", // ← NO es la cuenta de egreso «Administración» (2.5)
    extraordinaria: "1.2",
    multa: "1.3",
    interes_mora: "1.4",
    parqueadero: "1.5",
    reparacion: "1.6",
    vigilancia: "1.9", // ← el CARGO de vigilancia es un INGRESO. El gasto es la 2.9
    otro: exports.CUENTA_OTROS_INGRESOS, // ← `otro` (cargo) no es `otros` (egreso, 2.8)
};
/**
 * R6 + R8. Un cargo sin concepto es una cuota de administración: es el valor por
 * defecto del propio campo (`BillingStatement.concept`, «default: administración»),
 * así que tratarlo como desconocido y mandarlo a `otros_ingresos` movería de
 * cuenta a la mayoría de los cargos que existen hoy.
 */
function cuentaParaConcepto(concepto) {
    if (!concepto)
        return { code: exports.CUENTA_POR_CONCEPTO.administracion, porDefecto: false };
    const code = exports.CUENTA_POR_CONCEPTO[concepto];
    if (!code)
        return { code: exports.CUENTA_OTROS_INGRESOS, porDefecto: true };
    return { code, porDefecto: false };
}
/** La cuenta sembrada que corresponde a una categoría del libro, o `undefined`. */
function cuentaPorSystemKey(systemKey) {
    return exports.SEMILLA_PLAN_DE_CUENTAS.find((c) => c.systemKey === systemKey);
}
/** La cuenta sembrada de un código, o `undefined` si el código no es de la semilla. */
function cuentaPorCodigo(code) {
    return exports.SEMILLA_PLAN_DE_CUENTAS.find((c) => c.code === code);
}
/** La cuenta a la que cae un egreso de categoría desconocida — R8, lado egreso. */
exports.CUENTA_OTROS_EGRESOS = "2.8";
/**
 * §7.2 — la cuenta de un EGRESO, resuelta desde su categoría.
 *
 * **No es la simétrica de `cuentaParaConcepto` y no se pueden fusionar.**
 * `administracion` vive en los dos vocabularios y significa cosas opuestas: como
 * concepto de cargo es la cuota —un INGRESO, `1.1`— y como categoría de egreso es
 * el gasto de administración —`2.5`—. Una función única que resolviera «por
 * nombre» mandaría uno de los dos al lado contrario del libro. Son dos mapas a
 * propósito, igual que R11 obligó a que el primero fuese explícito.
 *
 * Aquí sí se puede resolver por `systemKey`, y no es pereza: los ocho valores de
 * `ExpenseCategory` son exactamente los `systemKey` de las ocho cuentas de egreso
 * de la semilla, y **ningún `systemKey` se repite entre ingresos y egresos** —la
 * cuenta de cuotas lleva `alicuota`, no `administracion`—. El filtro por `type`
 * existe para que eso deje de ser una coincidencia: si mañana la semilla repitiera
 * una clave en los dos lados, un egreso caería en una cuenta de ingreso, y esto lo
 * impide en vez de dejarlo pasar callando.
 */
function cuentaParaCategoriaDeEgreso(categoria) {
    if (!categoria)
        return { code: exports.CUENTA_OTROS_EGRESOS, porDefecto: true };
    const cuenta = exports.SEMILLA_PLAN_DE_CUENTAS.find((c) => c.systemKey === categoria && c.type === "egreso");
    if (!cuenta)
        return { code: exports.CUENTA_OTROS_EGRESOS, porDefecto: true };
    return { code: cuenta.code, porDefecto: false };
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
function categoriaParaConcepto(concepto) {
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
const DESCRIPCION_DE_COBRO = {
    administracion: "alícuota",
    extraordinaria: "cuota extraordinaria",
    multa: "multa",
    interes_mora: "intereses de mora",
    parqueadero: "parqueadero",
    reparacion: "reparación",
    vigilancia: "cuota de vigilancia",
    otro: "cargo",
};
function descripcionDeCobro(concepto) {
    if (!concepto)
        return DESCRIPCION_DE_COBRO.administracion;
    return DESCRIPCION_DE_COBRO[concepto] ?? DESCRIPCION_DE_COBRO.otro;
}
