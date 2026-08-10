/**
 * Resolución de una bandera: función pura, sin Firestore, sin React y sin saber
 * qué clase de capacidad está resolviendo.
 *
 * Está separada del lector a propósito. La precedencia es la única parte de
 * esto que puede estar mal de forma peligrosa, y una función pura se prueba
 * entera en milisegundos sin levantar un emulador.
 *
 * ESPEJO de `functions/src/feature-flags.ts` (ver nota en `catalog.ts`).
 */

import {
  FEATURE_FLAG_CATALOG,
  type FeatureFlagKey,
} from "@/lib/feature-flags/catalog";

/** Documento crudo de `featureFlags/{flagKey}`. */
export interface FeatureFlagDoc {
  enabled?: unknown;
  killSwitch?: unknown;
}

/** Documento crudo de `featureFlags/_global`. */
export interface GlobalFeatureFlagDoc {
  killSwitch?: unknown;
  /** Por qué se bajó la palanca. Se muestra en la consola. */
  reason?: unknown;
}

/** Documento crudo de `featureFlagOverrides/{tenantId}`. */
export interface FeatureFlagOverridesDoc {
  flags?: unknown;
}

/**
 * Por qué la bandera quedó como quedó. La consola lo muestra: sin esto, un
 * `enabled: true` que no surte efecto porque hay un kill switch encima parece
 * un fallo del lector.
 */
export type FeatureFlagSource =
  | "kill_switch_maestro"
  | "kill_switch_bandera"
  | "override_conjunto"
  | "valor_global"
  | "default_catalogo";

export interface FeatureFlagDecision {
  enabled: boolean;
  source: FeatureFlagSource;
}

export interface FeatureFlagInput {
  /** Documento de la bandera, si existe. */
  flag?: FeatureFlagDoc | null;
  /** Documento `_global`, si existe. */
  global?: GlobalFeatureFlagDoc | null;
  /** Overrides del conjunto en cuestión, si existen. */
  overrides?: FeatureFlagOverridesDoc | null;
}

/**
 * Solo booleanos de verdad. Un `"true"` escrito a mano en la consola de
 * Firestore NO enciende nada: se ignora y la bandera cae al siguiente nivel.
 *
 * Es la decisión conservadora — fallar apagado — y además es visible, porque la
 * consola muestra de qué nivel salió el valor. Si alguien escribió una cadena
 * creyendo que encendía, ve que la fuente sigue siendo el default.
 */
function asStrictBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function overrideFor(overrides: FeatureFlagOverridesDoc | null | undefined, key: string): boolean | undefined {
  const flags = overrides?.flags;
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) return undefined;
  return asStrictBoolean((flags as Record<string, unknown>)[key]);
}

/**
 * Precedencia, de arriba hacia abajo. La primera que aplica gana:
 *
 * 1. `_global.killSwitch` — apaga todo, sin excepción.
 * 2. `killSwitch` de la bandera — apaga esa capacidad en todos los conjuntos.
 * 3. Override del conjunto — enciende o apaga solo ahí.
 * 4. `enabled` global de la bandera.
 * 5. Default del catálogo (siempre apagado).
 *
 * Los dos kill switches van ARRIBA de los overrides y esa es toda su razón de
 * ser: si `enabled: false` bastara, una capacidad encendida a mano en cinco
 * conjuntos seguiría encendida en los cinco justo cuando hay que apagarla.
 */
export function resolveFeatureFlag(key: FeatureFlagKey, input: FeatureFlagInput): FeatureFlagDecision {
  if (asStrictBoolean(input.global?.killSwitch) === true) {
    return { enabled: false, source: "kill_switch_maestro" };
  }

  if (asStrictBoolean(input.flag?.killSwitch) === true) {
    return { enabled: false, source: "kill_switch_bandera" };
  }

  const override = overrideFor(input.overrides, key);
  if (override !== undefined) {
    return { enabled: override, source: "override_conjunto" };
  }

  const global = asStrictBoolean(input.flag?.enabled);
  if (global !== undefined) {
    return { enabled: global, source: "valor_global" };
  }

  return { enabled: FEATURE_FLAG_CATALOG[key].defaultEnabled, source: "default_catalogo" };
}

export function isFeatureFlagEnabled(key: FeatureFlagKey, input: FeatureFlagInput): boolean {
  return resolveFeatureFlag(key, input).enabled;
}

/** Texto para la consola de superadmin. */
export const FEATURE_FLAG_SOURCE_LABEL: Record<FeatureFlagSource, string> = {
  kill_switch_maestro: "Kill switch maestro",
  kill_switch_bandera: "Kill switch de la bandera",
  override_conjunto: "Override del conjunto",
  valor_global: "Valor global",
  default_catalogo: "Default del catálogo",
};
