"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.periodoLegible = periodoLegible;
exports.nombreDelCargo = nombreDelCargo;
exports.enumerar = enumerar;
exports.frasesDelRecibo = frasesDelRecibo;
const plan_de_cuentas_1 = require("./plan-de-cuentas");
const plan_de_cuentas_2 = require("./plan-de-cuentas");
/** `"2026-06"` → `"junio 2026"`. Devuelve `""` si no hay período legible. */
function periodoLegible(period) {
    if (!period)
        return "";
    const m = /^(\d{4})-(\d{2})$/.exec(period.trim());
    if (!m)
        return "";
    const d = new Date(Number(m[1]), Number(m[2]) - 1, 15, 12, 0, 0);
    if (Number.isNaN(d.getTime()))
        return "";
    return d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}
/**
 * El artículo de cada concepto, porque **no todos son femeninos singulares**.
 *
 * Sin esto sale «la parqueadero» y «la intereses de mora» en un correo a un
 * residente. Va como tabla explícita y no adivinando por la terminación: «-o»
 * masculino falla con «la mano» y con cualquier término que se añada mañana en
 * otro país, y una regla que acierta por casualidad es peor que una lista corta.
 * Las claves son las de `DESCRIPCION_DE_COBRO` en `plan-de-cuentas.ts`.
 */
const ARTICULO = {
    administracion: "la",
    extraordinaria: "la",
    multa: "la",
    interes_mora: "los",
    parqueadero: "el",
    reparacion: "la",
    vigilancia: "la",
    otro: "el",
};
/**
 * Cómo se nombra un cargo en un texto para el residente.
 *
 * `administracion` pasa por el vocabulario del PAÍS —«cuota de mantenimiento» en
 * México, «cuota de administración» en Colombia—; el resto de conceptos no
 * tienen nombre legal distinto por mercado y salen de `descripcionDeCobro`.
 *
 * Los tres términos de país de la cuota ordinaria empiezan por «cuota» o
 * «alícuota», así que su artículo es «la» en los tres.
 */
function nombreDelCargo(cargo, terminoCuota) {
    // **Se compara la clave NORMALIZADA.** Con la comparación cruda, un `concept` que solo difiera
    // en mayúsculas —como el `"Parqueadero"` que sembró `seed-data-co.mjs` en los dos ambientes—
    // se clasifica al revés, y el recibo describe el cargo como lo que no es.
    const esOrdinaria = !cargo.concept || (0, plan_de_cuentas_2.normalizarConcepto)(cargo.concept) === "administracion";
    const base = esOrdinaria ? terminoCuota : (0, plan_de_cuentas_1.descripcionDeCobro)(cargo.concept);
    const articulo = esOrdinaria ? "la" : ARTICULO[cargo.concept] ?? ARTICULO.otro;
    const periodo = periodoLegible(cargo.period);
    return periodo ? `${articulo} ${base} de ${periodo}` : `${articulo} ${base}`;
}
/** `["a"]` → `"a"` · `["a","b"]` → `"a y b"` · `["a","b","c"]` → `"a, b y c"`. */
function enumerar(partes) {
    const limpias = partes.filter((p) => p.trim().length > 0);
    if (limpias.length === 0)
        return "";
    if (limpias.length === 1)
        return limpias[0];
    return `${limpias.slice(0, -1).join(", ")} y ${limpias[limpias.length - 1]}`;
}
/**
 * Construye las dos frases del aviso.
 *
 * `formatMoney` entra por parámetro en vez de importarse: el formateador vive en
 * `index.ts` y es el mismo que ya usa `payment_adjusted`. Pasarlo mantiene esto
 * puro y evita un segundo formateador que acabaría divergiendo del primero.
 */
function frasesDelRecibo(input) {
    const nombres = input.cargos.map((c) => nombreDelCargo(c, input.terminoCuota));
    const lista = enumerar(nombres);
    // Un pago que no cubrió ningún cargo —todo se fue a saldo a favor (CA8)— no
    // tiene nada que enumerar, y decir «cubrió » a secas sería peor que callar.
    const cargos = lista ? `Cubrió ${lista}.` : "";
    const sobrante = Number.isFinite(input.saldoAFavor) ? input.saldoAFavor : 0;
    const saldoAFavor = sobrante > 0 ? `Te quedó un saldo a favor de ${input.formatMoney(sobrante)}.` : "";
    return { cargos, saldoAFavor };
}
