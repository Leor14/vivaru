import { descripcionDeCobro } from "./plan-de-cuentas";
import { normalizarConcepto } from "./plan-de-cuentas";

/**
 * `PRD-V-FLOW-002` §9 y **CA13** — el aviso del recibo dice **qué cubrió** el
 * pago y **cuánto quedó a favor**.
 *
 * Hasta el 24 de agosto de 2026 el aviso era el `billing_receipt` de siempre,
 * con `{período, conjunto}` y nada más: le decía al residente que su recibo
 * existe, no qué pagó. CA13 no se había mirado **porque no existía**.
 *
 * **Todo aquí es puro a propósito**, sin I/O: es texto que va a una persona en
 * tres países, y el texto se prueba mejor cuando se puede llamar con un objeto y
 * comparar la cadena. El trigger (`onPaymentVoucherCreated`) se queda solo con
 * las lecturas.
 *
 * ## La trampa está en el texto, no en los datos
 *
 * `interpolate` (en `notification-catalog.ts`) **borra los tokens sin valor** y
 * colapsa los espacios dobles. Eso resuelve el token huérfano pero **no el
 * conectivo huérfano**: una plantilla que dijera «…y te quedó un saldo a favor
 * de {saldoAFavor}» dejaría «…y te quedó un saldo a favor de.» cuando no hay
 * sobrante, que es la mayoría de los pagos.
 *
 * Por eso **cada variable lleva la frase entera**, no el dato: valen `""` o una
 * oración completa con su punto. Es lo único que sobrevive a que un
 * administrador edite la plantilla desde Perfil del edificio y mueva las
 * variables de sitio.
 */

/** Lo mínimo de un cargo para poder nombrarlo en el aviso. */
export type CargoCubierto = {
  concept?: string;
  period?: string;
};

/** `"2026-06"` → `"junio 2026"`. Devuelve `""` si no hay período legible. */
export function periodoLegible(period: string | undefined): string {
  if (!period) return "";
  const m = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 15, 12, 0, 0);
  if (Number.isNaN(d.getTime())) return "";
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
const ARTICULO: Record<string, string> = {
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
export function nombreDelCargo(cargo: CargoCubierto, terminoCuota: string): string {
  // **Se compara la clave NORMALIZADA.** Con la comparación cruda, un `concept` que solo difiera
  // en mayúsculas —como el `"Parqueadero"` que sembró `seed-data-co.mjs` en los dos ambientes—
  // se clasifica al revés, y el recibo describe el cargo como lo que no es.
  const esOrdinaria = !cargo.concept || normalizarConcepto(cargo.concept) === "administracion";
  const base = esOrdinaria ? terminoCuota : descripcionDeCobro(cargo.concept);
  const articulo = esOrdinaria ? "la" : ARTICULO[cargo.concept as string] ?? ARTICULO.otro;
  const periodo = periodoLegible(cargo.period);
  return periodo ? `${articulo} ${base} de ${periodo}` : `${articulo} ${base}`;
}

/** `["a"]` → `"a"` · `["a","b"]` → `"a y b"` · `["a","b","c"]` → `"a, b y c"`. */
export function enumerar(partes: readonly string[]): string {
  const limpias = partes.filter((p) => p.trim().length > 0);
  if (limpias.length === 0) return "";
  if (limpias.length === 1) return limpias[0];
  return `${limpias.slice(0, -1).join(", ")} y ${limpias[limpias.length - 1]}`;
}

export type FrasesDelRecibo = {
  /** Qué cubrió el pago. `""` si no se sabe. */
  cargos: string;
  /** El saldo a favor, si lo hubo. `""` si no. */
  saldoAFavor: string;
};

/**
 * Construye las dos frases del aviso.
 *
 * `formatMoney` entra por parámetro en vez de importarse: el formateador vive en
 * `index.ts` y es el mismo que ya usa `payment_adjusted`. Pasarlo mantiene esto
 * puro y evita un segundo formateador que acabaría divergiendo del primero.
 */
export function frasesDelRecibo(input: {
  cargos: readonly CargoCubierto[];
  saldoAFavor: number;
  terminoCuota: string;
  formatMoney: (valor: number) => string;
}): FrasesDelRecibo {
  const nombres = input.cargos.map((c) => nombreDelCargo(c, input.terminoCuota));
  const lista = enumerar(nombres);

  // Un pago que no cubrió ningún cargo —todo se fue a saldo a favor (CA8)— no
  // tiene nada que enumerar, y decir «cubrió » a secas sería peor que callar.
  const cargos = lista ? `Cubrió ${lista}.` : "";

  const sobrante = Number.isFinite(input.saldoAFavor) ? input.saldoAFavor : 0;
  const saldoAFavor = sobrante > 0 ? `Te quedó un saldo a favor de ${input.formatMoney(sobrante)}.` : "";

  return { cargos, saldoAFavor };
}
