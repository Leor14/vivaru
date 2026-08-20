import type { AppCurrency } from "@/lib/currency";

/**
 * `REVOPS-001C` (primera mitad) — el precio, cableado al producto.
 *
 * **Fuente de verdad: `Vivaru_Guia_Maestra_Precios_por_Pais_2026-08-12` (Drive).**
 * Este archivo es la copia ejecutable de esa tabla, no una decisión nueva. Si la
 * guía cambia, cambia esto; nunca al revés.
 *
 * ## Esto es una TARIFA DE REFERENCIA para cotizar, no lo que paga un conjunto
 *
 * **No mostrar esta cifra como el precio de un conjunto concreto, en ninguna
 * pantalla.** Decisión de David del 19 de agosto de 2026, y la razón es de
 * negocio: **a cada conjunto vendido se le pueden aplicar reglas de diferencia
 * de precio**. Dos conjuntos del mismo país y del mismo tamaño pueden estar
 * pagando cosas distintas, y ninguna de las dos tiene por qué ser la de esta
 * tabla.
 *
 * Derivar «lo que paga este conjunto» de su país sería mostrar un número
 * plausible y equivocado — y con la autoridad de haberlo calculado el sistema,
 * que es justo lo que hace que nadie lo revise.
 *
 * **Para qué SÍ sirve:** preparar una cotización, dimensionar el negocio y
 * calcular márgenes de referencia. El precio real de un conjunto vendido es un
 * dato propio de ese conjunto y **todavía no existe en el producto**; entra con
 * el módulo financiero.
 *
 * ## Tres cosas que este archivo asume, y que son decisiones tomadas
 *
 * 1. **Vivaru se vende como UN solo servicio.** No hay planes con funciones
 *    distintas. Lo que varía es el **precio por unidad**, según país y tamaño.
 *    Lo dice la guía maestra, lo dice `trial-workspace.ts` («Vivaru NO se vende
 *    por planes ni por módulos sueltos»), y David lo confirmó el 19 de agosto de
 *    2026. El vocabulario `starter`/`plus`/`premium` de la consola describe un
 *    producto que no existe.
 * 2. **Manda la guía maestra, no el Documento Rector de Finance.** Eran dos
 *    marcos en circulación —base MXN $27 contra base MXN $40— y mientras
 *    convivieran, cualquier cálculo de margen se apoyaba en la cifra equivocada.
 *    Decidido el 19 de agosto: la guía, por ser posterior y declararse
 *    consolidada.
 * 3. **Se guardan dos capas, no tres.** La guía separa base de Vivaru,
 *    compensación del canal y precio final al cliente. Aquí van la primera y la
 *    tercera; **la del canal se deriva restando**. Tres números que deben cuadrar
 *    entre sí acaban no cuadrando en cuanto alguien edita uno solo.
 *
 * ## Lo que la guía NO publica, y por eso aquí está en `null`
 *
 * La guía tarifa **el segmento Core en trimestral**, y solo ese. Emergente,
 * Enterprise y la frecuencia mensual —que menciona como existente y más
 * costosa— **no tienen cifra publicada**. Están modelados y vacíos a propósito:
 * `resolverTarifa` devuelve «sin tarifa» en vez de inventar un número, porque una
 * cotización con una cifra inventada es peor que una cotización que no sale.
 */

/** Países que la guía maestra tarifa. NO es `FiscalCountry`, que no incluye Panamá. */
export type PaisTarifado = "MX" | "CO" | "EC" | "PA";

/** Segmentación por número de unidades del conjunto. */
export type Segmento = "emergente" | "core" | "enterprise";

/** La guía recomienda trimestral; mensual existe y es más costosa. */
export type Frecuencia = "trimestral" | "mensual";

export const MONEDA_POR_PAIS: Record<PaisTarifado, AppCurrency> = {
  MX: "MXN",
  CO: "COP",
  EC: "USD",
  PA: "USD",
};

/**
 * Panamá quedó **en la nevera** por decisión de David del 17 de agosto de 2026:
 * está tarifado como *reseller* y no tiene a nadie asignado. Se conserva la
 * tarifa para no perderla, pero no se ofrece.
 */
export const PAISES_ACTIVOS: PaisTarifado[] = ["MX", "CO", "EC"];

/** Tramos de la guía. El límite superior de `enterprise` es abierto (201–300+). */
export const TRAMOS: Array<{ segmento: Segmento; min: number; max: number | null }> = [
  { segmento: "emergente", min: 50, max: 100 },
  { segmento: "core", min: 101, max: 200 },
  { segmento: "enterprise", min: 201, max: null },
];

export type TarifaPorUnidad = {
  /**
   * Lo que le queda a Vivaru por unidad al mes. `null` cuando la guía no publica
   * cifra — en Panamá dice literalmente «incluida», que no es un número.
   */
  baseVivaru: number | null;
  /** Lo que paga el cliente por unidad al mes. */
  finalCliente: number;
};

/**
 * La tabla. `null` significa **sin tarifa publicada**, no gratis y no cero.
 *
 * Solo la fila `core` / `trimestral` viene de la guía. Lo demás espera número.
 */
export const TARIFAS: Record<Frecuencia, Record<Segmento, Record<PaisTarifado, TarifaPorUnidad | null>>> = {
  trimestral: {
    emergente: { MX: null, CO: null, EC: null, PA: null },
    core: {
      MX: { baseVivaru: 27, finalCliente: 51 },
      CO: { baseVivaru: 5100, finalCliente: 8500 },
      EC: { baseVivaru: 1.9, finalCliente: 3.15 },
      // «Base incluida» en la guía: el reseller se lleva USD 1,80 de un final de
      // USD 3,77. No se deduce la base restando porque la guía no dice que esas
      // dos cifras sean complementarias — decirlo sería inventar.
      PA: { baseVivaru: null, finalCliente: 3.77 },
    },
    enterprise: { MX: null, CO: null, EC: null, PA: null },
  },
  mensual: {
    emergente: { MX: null, CO: null, EC: null, PA: null },
    core: { MX: null, CO: null, EC: null, PA: null },
    enterprise: { MX: null, CO: null, EC: null, PA: null },
  },
};

/**
 * El único `planId` de un cliente contratado. Espejo de `FULL_SERVICE_PLAN_ID`
 * en `functions/src/trial-workspace.ts`: si los dos divergen, un conjunto
 * convertido por el trial y uno creado a mano dejarían de parecerse.
 */
export const PLAN_SERVICIO_COMPLETO = "completo";

/** El `planId` mientras dura la prueba. Espejo de `TRIAL_PLAN_ID`. */
export const PLAN_TRIAL = "trial";
