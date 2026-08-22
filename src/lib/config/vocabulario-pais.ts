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
 * ⚠️ **Los términos están PENDIENTES DE CONFIRMAR con David** (22 ago 2026).
 * El de Ecuador está verificado contra `docs/inventario-habitanto.md`, que es
 * un producto ecuatoriano y dice «alícuota» dieciséis veces. Los de Colombia y
 * México salen de sus leyes pero no de un usuario real. **Cambiar una palabra
 * debe ser editar una línea de este archivo y nada más.**
 */

export type TerminosPais = {
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

/**
 * Textos de ayuda. Explican **mecanismo**, que es igual en los tres países, y
 * de paso **nombran las palabras de los otros** — así quien conoce otro
 * término se reconoce en vez de creerse en la pantalla equivocada. Es lo que
 * hace que el icono complemente al mapa en vez de sustituirlo.
 */
export const AYUDA = {
  coeficiente:
    "El porcentaje que representa esta unidad dentro del conjunto. Determina cuánto le toca pagar de los gastos comunes. " +
    "Se llama coeficiente de copropiedad en Colombia, alícuota en Ecuador e indiviso en México: es el mismo dato. " +
    "La suma de todas las unidades activas debe dar exactamente 100 %.",
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
