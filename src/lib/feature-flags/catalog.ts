/**
 * Catálogo de banderas de funcionalidad.
 *
 * **Es un mecanismo genérico de plataforma, no una pieza del programa de IA.**
 * Sirve para cualquier capacidad que tenga que poder encenderse y apagarse sin
 * desplegar: un módulo nuevo, un experimento, un cambio de comportamiento, una
 * integración con un tercero que se cae. El programa de IA es el primer cliente
 * que lo necesita (Paso 1.1 de `docs/hoja-de-ruta-ia.md`), no su dueño.
 *
 * Nada de lo que hay bajo `src/lib/feature-flags/` sabe qué es una operación de
 * IA, y así debe seguir.
 *
 * **Convención de clave:** `<area>-<capacidad>`, en kebab-case y sin puntos.
 * Sin puntos a propósito: la clave se usa como segmento de field path en
 * `featureFlagOverrides`, y un punto ahí se parsearía como anidamiento.
 *
 * Una bandera que no está aquí no existe: el lector la ignora y la consola de
 * superadmin la marca como desconocida. Eso es deliberado — un `flagKey` mal
 * escrito en la consola de Firestore tiene que ser visible, no silencioso.
 *
 * ESPEJO de `functions/src/feature-flags.ts`. `src/` no puede importar de
 * `functions/` (rompe el build de App Hosting, ver CLAUDE.md), así que el
 * catálogo vive duplicado a propósito. Si cambias uno, cambia el otro.
 */

/** Documento con el kill switch maestro, dentro de la misma colección. */
export const GLOBAL_FLAG_DOC_ID = "_global";

/** Colección de banderas (valores por defecto globales, sin dato de conjunto). */
export const FEATURE_FLAGS_COLLECTION = "featureFlags";

/** Colección de overrides: un documento por conjunto, con su mapa `flags`. */
export const FEATURE_FLAG_OVERRIDES_COLLECTION = "featureFlagOverrides";

/** Área de la que cuelga la capacidad. Se añaden a medida que hagan falta. */
export type FeatureFlagArea = "ia" | "producto" | "operacion";

export const FEATURE_FLAG_AREA_LABEL: Record<FeatureFlagArea, string> = {
  ia: "Inteligencia artificial",
  producto: "Producto",
  operacion: "Operación",
};

export type FeatureFlagKey =
  | "ai-gateway"
  | "ai-communications-draft"
  | "ai-pqrs-shadow"
  | "ai-pqrs-suggestions"
  | "ai-onboarding-column-mapping"
  | "ai-receipts-extraction";

export interface FeatureFlagDefinition {
  key: FeatureFlagKey;
  area: FeatureFlagArea;
  /** Nombre corto para la consola. */
  label: string;
  /** Qué apaga exactamente, en una frase. Lo lee quien tenga que apagarlo de madrugada. */
  description: string;
  /**
   * Valor cuando no hay documento en Firestore. La regla que decide cuál va:
   *
   *  - Capacidad **nueva** → `false`. Nace apagada y se enciende mirando.
   *  - Bandera puesta sobre una capacidad **que ya está viva** → `true`. Si
   *    naciera apagada, añadir la bandera sería apagar la función para todos.
   */
  defaultEnabled: boolean;
  /** De dónde sale, para que la consola no sea una lista de claves sueltas. */
  origen: string;
  /**
   * Qué sigue funcionando con la bandera apagada. Sin esta respuesta escrita,
   * apagar da miedo — y una bandera que da miedo apagar no es una bandera.
   */
  alApagar: string;
}

export const FEATURE_FLAG_CATALOG: Record<FeatureFlagKey, FeatureFlagDefinition> = {
  "ai-gateway": {
    key: "ai-gateway",
    area: "ia",
    label: "Puerta de entrada de IA",
    description:
      "Interruptor general de la plataforma de IA: con esto apagado ninguna operación asistida llega al proveedor, sin importar el resto de banderas.",
    defaultEnabled: false,
    origen: "PLAT-001",
    alApagar: "Todo el producto sigue igual. La IA todavía no tiene consumidores.",
  },
  "ai-communications-draft": {
    key: "ai-communications-draft",
    area: "ia",
    label: "Borrador asistido de comunicaciones",
    description: "Panel de hechos y propuesta de redacción dentro del formulario de comunicaciones.",
    defaultEnabled: false,
    origen: "FEAT-003 — el canario, Paso 2",
    alApagar: "El administrador redacta la comunicación a mano, como hoy.",
  },
  "ai-pqrs-shadow": {
    key: "ai-pqrs-shadow",
    area: "ia",
    label: "Clasificación de PQRS en modo sombra",
    description:
      "Clasifica cada ticket en silencio y guarda el resultado junto a lo que decidió el administrador. No se le muestra a nadie.",
    defaultEnabled: false,
    origen: "FEAT-002 — Paso 3",
    alApagar: "Se deja de acumular conjunto de evaluación. Ningún usuario nota nada.",
  },
  "ai-pqrs-suggestions": {
    key: "ai-pqrs-suggestions",
    area: "ia",
    label: "Sugerencia visible de PQRS",
    description: "Muestra al administrador la categoría y el resumen propuestos para un ticket.",
    defaultEnabled: false,
    origen: "FEAT-002 — Paso 3",
    alApagar: "El administrador clasifica el ticket a mano, como hoy.",
  },
  "ai-onboarding-column-mapping": {
    key: "ai-onboarding-column-mapping",
    area: "ia",
    label: "Mapeo asistido de columnas",
    description: "Resuelve encabezados ambiguos al importar el padrón en CSV o XLSX.",
    defaultEnabled: false,
    origen: "FEAT-001 — Paso 4",
    alApagar: "El importador cae al mapeo manual de columnas, que no depende de IA.",
  },
  "ai-receipts-extraction": {
    key: "ai-receipts-extraction",
    area: "ia",
    label: "Extracción de comprobantes",
    description:
      "Propone campos y niveles de confianza de un comprobante de pago. Nunca aplica el pago: eso sigue siendo de una persona.",
    defaultEnabled: false,
    origen: "DOC-001 — Paso 5",
    alApagar: "El comprobante se captura a mano. `approveReceiptAndRegisterPayment` no cambia.",
  },
};

export const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAG_CATALOG) as FeatureFlagKey[];

/** Claves del catálogo agrupadas por área, en el orden en que se declararon. */
export function featureFlagKeysByArea(): Array<{ area: FeatureFlagArea; keys: FeatureFlagKey[] }> {
  const areas: FeatureFlagArea[] = ["ia", "producto", "operacion"];
  return areas
    .map((area) => ({ area, keys: FEATURE_FLAG_KEYS.filter((key) => FEATURE_FLAG_CATALOG[key].area === area) }))
    .filter((group) => group.keys.length > 0);
}

export function isKnownFeatureFlag(key: string): key is FeatureFlagKey {
  return Object.prototype.hasOwnProperty.call(FEATURE_FLAG_CATALOG, key);
}

/** El estado del que parte el cliente antes de leer Firestore. */
export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = FEATURE_FLAG_KEYS.reduce(
  (acc, key) => {
    acc[key] = FEATURE_FLAG_CATALOG[key].defaultEnabled;
    return acc;
  },
  {} as Record<FeatureFlagKey, boolean>,
);
