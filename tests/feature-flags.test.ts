import { describe, expect, it } from "vitest";

import { FEATURE_FLAG_CATALOG, FEATURE_FLAG_KEYS } from "@/lib/feature-flags/catalog";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";

/**
 * La precedencia de las banderas es la única parte de esto que puede estar mal
 * de forma peligrosa: si un override le gana a un kill switch, apagar deja de
 * funcionar justo el día que hace falta. Por eso el resolutor es puro y por eso
 * la tabla se prueba entera.
 *
 * Paso 1.1 de docs/hoja-de-ruta-ia.md.
 */

const KEY = "ai-communications-draft" as const;

describe("catálogo de banderas", () => {
  it("toda capacidad nueva nace apagada", () => {
    // La regla del catálogo tiene dos mitades: capacidad nueva → false; bandera
    // puesta sobre algo que ya está vivo → true. Hoy el catálogo solo tiene lo
    // primero, y eso es lo que se fija aquí.
    for (const key of FEATURE_FLAG_KEYS) {
      if (FEATURE_FLAG_CATALOG[key].area !== "ia") continue;
      expect(FEATURE_FLAG_CATALOG[key].defaultEnabled).toBe(false);
    }
  });

  it("el resolutor obedece el default del catálogo, no un false fijo", () => {
    // Lo que hace genérico al mecanismo: si mañana se pone una bandera sobre
    // una función que ya está viva, su default en `true` tiene que respetarse.
    for (const key of FEATURE_FLAG_KEYS) {
      expect(resolveFeatureFlag(key, {}).enabled).toBe(FEATURE_FLAG_CATALOG[key].defaultEnabled);
    }
  });

  it("cada bandera dice qué sigue funcionando al apagarla", () => {
    // Una bandera que no responde esto da miedo apagar, y una bandera que da
    // miedo apagar no es una bandera.
    for (const key of FEATURE_FLAG_KEYS) {
      expect(FEATURE_FLAG_CATALOG[key].alApagar.length).toBeGreaterThan(0);
    }
  });
});

describe("resolveFeatureFlag — precedencia", () => {
  it("sin documentos cae al default del catálogo y queda apagada", () => {
    expect(resolveFeatureFlag(KEY, {})).toEqual({ enabled: false, source: "default_catalogo" });
  });

  it("el valor global manda cuando no hay override", () => {
    expect(resolveFeatureFlag(KEY, { flag: { enabled: true } })).toEqual({
      enabled: true,
      source: "valor_global",
    });
  });

  it("el override del conjunto le gana al valor global — encendiendo", () => {
    expect(
      resolveFeatureFlag(KEY, { flag: { enabled: false }, overrides: { flags: { [KEY]: true } } }),
    ).toEqual({ enabled: true, source: "override_conjunto" });
  });

  it("el override del conjunto le gana al valor global — apagando", () => {
    expect(
      resolveFeatureFlag(KEY, { flag: { enabled: true }, overrides: { flags: { [KEY]: false } } }),
    ).toEqual({ enabled: false, source: "override_conjunto" });
  });

  it("un override de OTRA bandera no contamina", () => {
    expect(
      resolveFeatureFlag(KEY, { flag: { enabled: false }, overrides: { flags: { "ai-gateway": true } } }),
    ).toEqual({ enabled: false, source: "valor_global" });
  });

  it("el kill switch de la bandera le gana al override del conjunto", () => {
    // Esta es LA prueba del paso: si `enabled: false` bastara, una capacidad
    // encendida a mano en cinco conjuntos seguiría encendida en los cinco.
    expect(
      resolveFeatureFlag(KEY, {
        flag: { enabled: true, killSwitch: true },
        overrides: { flags: { [KEY]: true } },
      }),
    ).toEqual({ enabled: false, source: "kill_switch_bandera" });
  });

  it("el kill switch maestro le gana a todo", () => {
    expect(
      resolveFeatureFlag(KEY, {
        global: { killSwitch: true },
        flag: { enabled: true, killSwitch: false },
        overrides: { flags: { [KEY]: true } },
      }),
    ).toEqual({ enabled: false, source: "kill_switch_maestro" });
  });

  it("el kill switch maestro apaga TODAS las banderas del catálogo", () => {
    for (const key of FEATURE_FLAG_KEYS) {
      const decision = resolveFeatureFlag(key, {
        global: { killSwitch: true },
        flag: { enabled: true },
        overrides: { flags: { [key]: true } },
      });
      expect(decision.enabled).toBe(false);
    }
  });

  it("un kill switch en false no apaga nada por sí solo", () => {
    expect(resolveFeatureFlag(KEY, { global: { killSwitch: false }, flag: { enabled: true } })).toEqual({
      enabled: true,
      source: "valor_global",
    });
  });
});

describe("resolveFeatureFlag — datos malformados", () => {
  it('ignora la cadena "true" en el valor global y falla apagado', () => {
    // Es lo que se escribe sin querer en la consola de Firestore. Encender por
    // accidente es peor que no encender, y la consola muestra la fuente real.
    expect(resolveFeatureFlag(KEY, { flag: { enabled: "true" } })).toEqual({
      enabled: false,
      source: "default_catalogo",
    });
  });

  it('ignora la cadena "true" en un kill switch: una cadena no apaga nada', () => {
    expect(resolveFeatureFlag(KEY, { global: { killSwitch: "true" }, flag: { enabled: true } })).toEqual({
      enabled: true,
      source: "valor_global",
    });
  });

  it("ignora un override que no sea booleano", () => {
    expect(
      resolveFeatureFlag(KEY, { flag: { enabled: true }, overrides: { flags: { [KEY]: 1 } } }),
    ).toEqual({ enabled: true, source: "valor_global" });
  });

  it("tolera un mapa de overrides que no es un mapa", () => {
    expect(resolveFeatureFlag(KEY, { flag: { enabled: true }, overrides: { flags: "nada" } })).toEqual({
      enabled: true,
      source: "valor_global",
    });
    expect(resolveFeatureFlag(KEY, { flag: { enabled: true }, overrides: { flags: [] } })).toEqual({
      enabled: true,
      source: "valor_global",
    });
  });

  it("tolera documentos nulos", () => {
    expect(resolveFeatureFlag(KEY, { flag: null, global: null, overrides: null })).toEqual({
      enabled: false,
      source: "default_catalogo",
    });
  });
});
