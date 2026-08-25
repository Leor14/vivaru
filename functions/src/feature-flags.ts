import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * Banderas de funcionalidad en el servidor — **la capa que protege de verdad**.
 *
 * Mecanismo genérico de plataforma: vale para cualquier capacidad que tenga que
 * poder apagarse sin desplegar, no solo para las de IA. El programa de IA es su
 * primer cliente (Paso 1.1 de `docs/hoja-de-ruta-ia.md`), no su dueño.
 *
 * El gate del cliente (`src/lib/feature-flags/provider.tsx`) oculta la interfaz;
 * esto es lo que impide que se ejecute la operación. Misma lección que el gate
 * de módulos del trial: lo que se ve se salta escribiendo la URL o llamando la
 * callable directo.
 *
 * ESPEJO de `src/lib/feature-flags/catalog.ts` y `resolve.ts`. `src/` no puede
 * importar de `functions/` (rompe el build de App Hosting, ver CLAUDE.md), así
 * que el catálogo y la precedencia viven duplicados a propósito.
 *
 * **EL CATÁLOGO VIVE EN CINCO SITIOS, no en dos.** Añadir una bandera y tocar
 * solo los dos primeros la deja **imposible de encender**: el sembrador no crea
 * su documento y el movedor la rechaza como clave desconocida, así que la
 * capacidad se queda apagada para siempre y sin síntoma visible. Pasó con las
 * tres banderas de producto de agosto de 2026, y se descubrió al ir a
 * encenderlas en staging.
 *
 * **Esta cabecera decía CUATRO y se dejaba fuera el quinto**, que es el que
 * enciende POR CONJUNTO. `producto-multiconjunto` nació el 25 de agosto de 2026
 * con los otros cuatro tocados y ese no: se podía encender global pero no a un
 * solo conjunto, que es justo la vía del canario con la que se encendió el lote
 * de Habitanto. Los cinco:
 *
 *   1. `src/lib/feature-flags/catalog.ts`      — el cliente
 *   2. `functions/src/feature-flags.ts`        — el servidor
 *   3. `functions/scripts/seed-feature-flags.mjs` — crea los documentos
 *   4. `functions/scripts/mover-bandera.mjs`   — enciende y apaga GLOBAL
 *   5. `functions/scripts/mover-bandera-de-conjunto.mjs` — POR CONJUNTO
 */

export const FEATURE_FLAGS_COLLECTION = "featureFlags";
export const FEATURE_FLAG_OVERRIDES_COLLECTION = "featureFlagOverrides";
export const GLOBAL_FLAG_DOC_ID = "_global";

export type FeatureFlagKey =
  | "ai-gateway"
  | "ai-communications-draft"
  | "ai-pqrs-shadow"
  | "ai-pqrs-suggestions"
  | "ai-onboarding-column-mapping"
  | "ai-receipts-extraction"
  | "ia-proveedor-real"
  | "producto-importacion-masiva"
  | "producto-reservas-servidor"
  | "producto-cobro-por-coeficiente"
  | "producto-registro-proveedores"
  | "producto-plan-de-cuentas"
  | "producto-concepto-al-libro"
  | "producto-anticipos"
  | "producto-pago-multiple"
  | "producto-multiconjunto"
  | "producto-prorrateo-de-gastos"
  | "operacion-app-check-monitor";

/**
 * Valor sin documento en Firestore. La regla: capacidad nueva nace en `false`;
 * bandera puesta sobre una capacidad que ya está viva nace en `true`, porque si
 * no, añadir la bandera sería apagar la función para todos.
 */
export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  "ai-gateway": false,
  "ai-communications-draft": false,
  "ai-pqrs-shadow": false,
  "ai-pqrs-suggestions": false,
  "ai-onboarding-column-mapping": false,
  "ai-receipts-extraction": false,
  // Apagada = proveedor simulado. Encenderla es lo que empieza a gastar dinero.
  "ia-proveedor-real": false,
  // Encendida porque los dos asistentes de importación ya estaban vivos antes
  // que la bandera. Ver el catálogo en `src/`.
  "producto-importacion-masiva": true,
  // Apagada = el residente sigue escribiendo directo (comportamiento de hoy).
  // Es el paso 2 del despliegue de PRD-V-FIX-001; ver el catálogo en `src/`.
  "producto-reservas-servidor": false,
  // Apagada = sin botón de generar por coeficiente; la corrida plana sigue.
  "producto-cobro-por-coeficiente": false,
  "producto-registro-proveedores": false,
  // Apagada = el plan sembrado se ve y no se edita.
  "producto-plan-de-cuentas": false,
  // Apagada = `aplicarPago` sigue escribiendo "alicuota" fijo, como hasta hoy.
  // Encenderla cambia lo que muestra el estado financiero; ver el catálogo en `src/`.
  "producto-concepto-al-libro": false,
  // Apagada = el sobrepago se sigue contabilizando entero contra la cuota, como
  // hasta hoy, y no nace ningún anticipo. Ver el catálogo en `src/`.
  "producto-anticipos": false,
  // Apagada = un pago sigue aplicándose a un solo cargo, como hasta hoy.
  "producto-pago-multiple": false,
  // Encendida = la puerta de IA no bloquea por App Check, solo registra. Nace
  // así porque describe lo que ya pasa hoy. Ver el catálogo en `src/`.
  // Apagada = sin selector de conjunto. Ver el catálogo en `src/`.
  "producto-multiconjunto": false,
  // Apagada = no se puede repartir un egreso. Ver el catálogo en `src/`.
  "producto-prorrateo-de-gastos": false,
  "operacion-app-check-monitor": true,
};

export type FeatureFlagSource =
  | "kill_switch_maestro"
  | "kill_switch_bandera"
  | "override_conjunto"
  | "valor_global"
  | "default_catalogo"
  | "error_de_lectura";

export interface FeatureFlagDecision {
  enabled: boolean;
  source: FeatureFlagSource;
}

/** Solo booleanos de verdad: un `"true"` escrito a mano no enciende nada. */
function asStrictBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/**
 * Precedencia, de arriba hacia abajo:
 *
 * 1. `_global.killSwitch` — apaga todo.
 * 2. `killSwitch` de la bandera — apaga esa capacidad en todos los conjuntos.
 * 3. Override del conjunto.
 * 4. `enabled` global de la bandera.
 * 5. Default del catálogo (apagado).
 *
 * Los kill switches van ARRIBA de los overrides y esa es su razón de ser: si
 * `enabled: false` bastara, una capacidad encendida a mano en cinco conjuntos
 * seguiría encendida justo cuando hay que apagarla.
 *
 * **Sin caché, a propósito.** Un TTL de treinta segundos convierte «apagado
 * inmediato» en «apagado casi siempre», y una instancia caliente puede vivir
 * minutos. La lectura extra son dos o tres documentos frente a una llamada a un
 * modelo que cuesta dinero y tarda segundos: no es donde está el costo.
 */
export async function resolveFeatureFlag(
  key: FeatureFlagKey,
  tenantId?: string | null,
): Promise<FeatureFlagDecision> {
  const db = getFirestore();

  const refs = [
    db.collection(FEATURE_FLAGS_COLLECTION).doc(GLOBAL_FLAG_DOC_ID),
    db.collection(FEATURE_FLAGS_COLLECTION).doc(key),
  ];
  if (tenantId) refs.push(db.collection(FEATURE_FLAG_OVERRIDES_COLLECTION).doc(tenantId));

  let snaps;
  try {
    snaps = await db.getAll(...refs);
  } catch {
    // Falla cerrado: si no se sabe si está encendida, está apagada. El flujo
    // manual sigue funcionando — fallback determinista.
    return { enabled: false, source: "error_de_lectura" };
  }

  const globalData = snaps[0]?.data() as { killSwitch?: unknown } | undefined;
  if (asStrictBoolean(globalData?.killSwitch) === true) {
    return { enabled: false, source: "kill_switch_maestro" };
  }

  const flagData = snaps[1]?.data() as { enabled?: unknown; killSwitch?: unknown } | undefined;
  if (asStrictBoolean(flagData?.killSwitch) === true) {
    return { enabled: false, source: "kill_switch_bandera" };
  }

  const overridesData = snaps[2]?.data() as { flags?: unknown } | undefined;
  const flags = overridesData?.flags;
  if (flags && typeof flags === "object" && !Array.isArray(flags)) {
    const override = asStrictBoolean((flags as Record<string, unknown>)[key]);
    if (override !== undefined) return { enabled: override, source: "override_conjunto" };
  }

  const global = asStrictBoolean(flagData?.enabled);
  if (global !== undefined) return { enabled: global, source: "valor_global" };

  return { enabled: FEATURE_FLAG_DEFAULTS[key], source: "default_catalogo" };
}

export async function isFeatureEnabled(key: FeatureFlagKey, tenantId?: string | null): Promise<boolean> {
  return (await resolveFeatureFlag(key, tenantId)).enabled;
}

/**
 * Lanza si la capacidad está apagada para este conjunto.
 *
 * `failed-precondition` y no `permission-denied`: no es que al usuario le falte
 * un permiso, es que la capacidad no está disponible. Por eso el mensaje por
 * defecto apunta al camino manual — cada llamador puede dar el suyo, más
 * concreto, con `message`.
 */
export async function assertFeatureEnabled(
  key: FeatureFlagKey,
  tenantId?: string | null,
  message?: string,
): Promise<void> {
  if (await isFeatureEnabled(key, tenantId)) return;

  throw new HttpsError(
    "failed-precondition",
    message ?? "Esta función no está disponible en este momento. Puedes continuar con el proceso manual.",
  );
}
