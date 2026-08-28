/**
 * Vocabulario de propiedad horizontal según el país **del conjunto**.
 *
 * **El problema que resuelve.** Los mismos conceptos tienen nombre legal
 * distinto en cada país, y no son sinónimos de estilo: son las palabras de sus
 * respectivas leyes. Un administrador mexicano que busca «indiviso» no
 * reconoce «coeficiente de copropiedad», y un icono de ayuda no lo salva
 * porque hay que saber que hay algo que preguntar.
 *
 * **Sigue al CONJUNTO, no al usuario.** La palabra pertenece al inmueble y a
 * la ley que lo rige, no a quien la lee. Una administradora en Bogotá que
 * gestiona un conjunto en Quito debe ver «alícuota» para ese conjunto — y con
 * `PLAT-002` eso pasa de hipótesis a caso normal: una misma sesión con
 * conjuntos de países distintos.
 *
 * **Códigos ISO-2, como `functions/src/country-currency.ts`**, que es el mapa
 * canónico de país del producto. Mismo criterio para lo desconocido: un país
 * fuera de los mercados actuales cae en términos **neutros** en vez de en los
 * de un país concreto — igual que allí cae en USD.
 *
 * ⚠️ **ESPEJO en `functions/src/vocabulario-pais.ts`**, que lo necesita para
 * los mensajes de error de la corrida por coeficiente (son texto que lee una
 * persona). `src/` no puede importar de `functions/` — rompe el build de App
 * Hosting, ver CLAUDE.md. Si cambias uno, cambia el otro.
 *
 * **Los tres términos están CONFIRMADOS** (22 ago 2026), cada uno por una vía
 * distinta: Ecuador contra `docs/inventario-habitanto.md` —un producto
 * ecuatoriano que dice «alícuota» dieciséis veces—, y México y Colombia por
 * David, que conoce los mercados.
 *
 * **`copropiedad` —cómo se llama el inmueble entero— se añadió el 27 de agosto
 * de 2026, y llegó tarde por una razón que conviene no repetir.** Es la palabra
 * más visible del producto y era la única que no estaba aquí: la pantalla decía
 * literalmente «Tenant», que no es que estuviera en el idioma equivocado, es que
 * es jerga de multi-tenancy —vocabulario de cómo está construido el software—
 * enseñada a quien administra un edificio. **El mapa de un vocabulario se hace
 * desde las palabras del usuario, no desde los campos que ya existen en el
 * modelo**, o el término que nadie nombró es justo el que se queda sin traducir.
 *
 * Ecuador se decidió por la misma vía que «alícuota» y con más señal: Habitanto
 * dice «condominio» 46 veces, «conjunto residencial» ninguna, y su propio menú
 * se llama «Mi Condominio». **La vía tiene un límite conocido** —Habitanto se
 * vende también en Uruguay, Bolivia y México, así que podría ser su elección
 * panregional y no la palabra ecuatoriana—; David la confirmó igual el 27 de
 * agosto sabiéndolo. Colombia y México, por David.
 *
 * **Al abrir un mercado nuevo hay que añadir su término aquí**, igual que su
 * moneda en `country-currency.ts`. Mientras no esté, cae en los neutros: no
 * se rompe nada, pero nadie lee su palabra. Y cambiar una palabra debe seguir
 * siendo **editar una línea de este archivo y nada más**.
 */

export type TerminosPais = {
  /**
   * Cómo se llama **el inmueble entero**: lo que en el código es un «tenant».
   *
   * El campo NO se llama `conjunto` a propósito. «Conjunto» es la palabra
   * colombiana, y bautizar el campo con el término de un mercado es la misma
   * confusión que este archivo existe para evitar, solo que escondida en el
   * tipo: quien lea `terminos.conjunto` y le salga «condominio» pensará que
   * hay un error. `copropiedad` es el término legal común a los tres, y el
   * que ya usa el neutro de `coeficiente`.
   *
   * En minúscula, como los demás: casi siempre va dentro de una frase. Para
   * encabezar una, `capitalizar()`.
   */
  copropiedad: string;
  /** El porcentaje de participación de la unidad. Etiqueta larga, para formularios. */
  coeficiente: string;
  /** La misma idea en una palabra, para botones y columnas. */
  coeficienteCorto: string;
  /** La cuota ordinaria mensual que paga la unidad. */
  cuotaMensual: string;
  /** Nombres de los tipos de cuenta bancaria que se usan en el país. */
  tiposCuenta: Array<{ value: string; label: string }>;
  /**
   * Cómo se identifica una cuenta para transferirle. En México **no es el
   * número de cuenta**: es la CLABE de 18 dígitos, y sin ella no se puede
   * pagar. Ver `PRD-V-FEAT-003` §7.
   */
  identificadorCuenta: { label: string; placeholder: string; maxLength?: number };
};

/** Términos neutros: país desconocido o fuera de los mercados abiertos. */
const NEUTRO: TerminosPais = {
  copropiedad: "copropiedad",
  coeficiente: "porcentaje de copropiedad",
  coeficienteCorto: "porcentaje",
  cuotaMensual: "cuota mensual",
  tiposCuenta: [
    { value: "corriente", label: "Corriente" },
    { value: "ahorros", label: "Ahorros" },
  ],
  identificadorCuenta: { label: "Nº de cuenta", placeholder: "Opcional" },
};

const POR_PAIS: Record<string, TerminosPais> = {
  // Colombia — Ley 675 de 2001.
  CO: {
    copropiedad: "conjunto",
    coeficiente: "coeficiente de copropiedad",
    coeficienteCorto: "coeficiente",
    cuotaMensual: "cuota de administración",
    tiposCuenta: [
      { value: "corriente", label: "Corriente" },
      { value: "ahorros", label: "Ahorros" },
    ],
    identificadorCuenta: { label: "Nº de cuenta", placeholder: "Opcional" },
  },
  // Ecuador — Ley de Propiedad Horizontal. OJO: «alícuota» nombra **las dos
  // cosas**, el porcentaje y la cuota mensual. Es ambigüedad del propio idioma
  // legal, no nuestra: por eso aquí el texto de ayuda hace más falta que en
  // ningún otro país.
  EC: {
    copropiedad: "condominio",
    coeficiente: "alícuota",
    coeficienteCorto: "alícuota",
    cuotaMensual: "alícuota mensual",
    tiposCuenta: [
      { value: "corriente", label: "Corriente" },
      { value: "ahorros", label: "Ahorros" },
    ],
    identificadorCuenta: { label: "Nº de cuenta", placeholder: "Opcional" },
  },
  // México — Ley de Propiedad en Condominio (varía por estado; «indiviso» es
  // el término común en todas). La cuenta se identifica por CLABE.
  MX: {
    copropiedad: "condominio",
    coeficiente: "indiviso",
    coeficienteCorto: "indiviso",
    cuotaMensual: "cuota de mantenimiento",
    tiposCuenta: [
      { value: "corriente", label: "Cheques" },
      { value: "ahorros", label: "Ahorro" },
    ],
    identificadorCuenta: { label: "CLABE interbancaria", placeholder: "18 dígitos", maxLength: 18 },
  },
};

export function terminosDePais(country: string | undefined): TerminosPais {
  if (!country) return NEUTRO;
  return POR_PAIS[country.toUpperCase()] ?? NEUTRO;
}

/** Los términos viven en minúscula porque casi siempre van dentro de una frase. */
export function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Textos de ayuda. Explican **mecanismo**, que es igual en los tres países, y
 * de paso **nombran las palabras de los otros** — así quien conoce otro
 * término se reconoce en vez de creerse en la pantalla equivocada. Es lo que
 * hace que el icono complemente al mapa en vez de sustituirlo.
 */
export const AYUDA = {
  coeficiente:
    "El porcentaje que representa esta unidad dentro del conjunto y sus áreas comunes. Manda sobre DOS cosas: " +
    "cuánto le toca pagar de los gastos comunes, ordinarios y extraordinarios, y el peso de su voto en asamblea. " +
    "Se llama coeficiente de copropiedad en Colombia, alícuota en Ecuador e indiviso en México: es el mismo dato, " +
    "y es el que aparece en la escritura. La suma de todas las unidades activas debe dar exactamente 100 %.",
  /**
   * La misma idea para el RESIDENTE. El término legal es el correcto en la
   * escritura y en la pantalla del administrador, pero —confirmado por David
   * el 22 ago 2026— **el condómino rara vez usa la palabra**: piensa en la
   * consecuencia, «la cuota». Vale igual en los tres países. Así que
   * a él se le encabeza con la consecuencia y el término se le ofrece aquí,
   * para que pueda casarlo con su escritura si lo necesita.
   */
  coeficienteResidente:
    "Es la proporción que tu unidad representa dentro del condominio y sus áreas comunes. " +
    "De ahí sale la parte que te toca de los gastos comunes, y también el peso de tu voto en asamblea. " +
    "En la escritura aparece como indiviso en México, coeficiente de copropiedad en Colombia y alícuota en Ecuador.",
  corridaPorCoeficiente:
    "Reparte un total entre las unidades activas según el porcentaje de cada una, en vez de cobrar lo mismo a todas. " +
    "Primero calcula una vista previa y no se genera nada hasta que confirmes. " +
    "Cuando el reparto no da exacto, el sobrante se asigna a las unidades con mayor fracción pendiente (resto mayor), " +
    "así que la suma de las cuotas es siempre exactamente el total: las marcadas con * son las que recibieron ese ajuste.",
  cuotaMensual:
    "El valor ordinario que paga esta unidad cada mes por gastos comunes. " +
    "Se llama cuota de administración en Colombia, alícuota en Ecuador y cuota de mantenimiento en México.",
  datosBancarios:
    "Dónde se le paga a este proveedor. Nunca se muestran a los residentes. " +
    "En México lo que se necesita para transferir es la CLABE de 18 dígitos, no el número de cuenta.",
} as const;
