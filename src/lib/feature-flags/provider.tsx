"use client";

/**
 * Lector de banderas en el cliente. Mecanismo genérico de plataforma: no sabe
 * qué clase de capacidad está encendiendo (ver `catalog.ts`).
 *
 * Es en tiempo real a propósito: la prueba de que el kill switch existe es que
 * cambias el documento en la consola de Firestore y la aplicación abierta lo
 * acusa sin recargar. Un lector que solo mira al montar no es un kill switch,
 * es una configuración de arranque.
 *
 * Dos suscripciones y ni una más:
 *  - `featureFlags` completa — son diez documentos sin dato de conjunto.
 *  - `featureFlagOverrides/{tenantId}` — SOLO el del conjunto de la sesión.
 *
 * Lo segundo es lo que evita que un residente pueda enumerar los conjuntos de
 * la plataforma leyendo las banderas. Ver el bloque de reglas en
 * `firestore.rules`.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";

import { useAuth } from "@/features/auth/auth-context";
import { db } from "@/lib/firebase/client";
import {
  FEATURE_FLAGS_COLLECTION,
  FEATURE_FLAG_CATALOG,
  FEATURE_FLAG_KEYS,
  FEATURE_FLAG_OVERRIDES_COLLECTION,
  GLOBAL_FLAG_DOC_ID,
  type FeatureFlagKey,
} from "@/lib/feature-flags/catalog";
import {
  resolveFeatureFlag,
  type FeatureFlagDecision,
  type FeatureFlagDoc,
  type FeatureFlagOverridesDoc,
  type GlobalFeatureFlagDoc,
} from "@/lib/feature-flags/resolve";

interface FeatureFlagsContextValue {
  /** `false` mientras no se haya leído Firestore. Durante ese rato todo vale el default (apagado). */
  ready: boolean;
  decisions: Record<FeatureFlagKey, FeatureFlagDecision>;
  /** Motivo escrito en `_global.reason` cuando el kill switch maestro está bajado. */
  killSwitchReason: string | null;
}

const DEFAULT_DECISIONS = FEATURE_FLAG_KEYS.reduce((acc, key) => {
  acc[key] = { enabled: FEATURE_FLAG_CATALOG[key].defaultEnabled, source: "default_catalogo" };
  return acc;
}, {} as Record<FeatureFlagKey, FeatureFlagDecision>);

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const authenticated = status === "authenticated";

  const [flagDocs, setFlagDocs] = useState<Record<string, FeatureFlagDoc>>({});
  const [globalDoc, setGlobalDoc] = useState<GlobalFeatureFlagDoc | null>(null);
  const [overridesDoc, setOverridesDoc] = useState<FeatureFlagOverridesDoc | null>(null);
  const [flagsRead, setFlagsRead] = useState(false);

  // Las reglas exigen sesión para leer banderas, así que fuera del portal
  // (landing, login) no se suscribe nada y todo vale el default.
  useEffect(() => {
    if (!authenticated || !db) {
      setFlagDocs({});
      setGlobalDoc(null);
      setFlagsRead(false);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, FEATURE_FLAGS_COLLECTION),
      (snapshot) => {
        const next: Record<string, FeatureFlagDoc> = {};
        let globalNext: GlobalFeatureFlagDoc | null = null;

        for (const docSnap of snapshot.docs) {
          if (docSnap.id === GLOBAL_FLAG_DOC_ID) {
            globalNext = docSnap.data() as GlobalFeatureFlagDoc;
            continue;
          }
          next[docSnap.id] = docSnap.data() as FeatureFlagDoc;
        }

        setFlagDocs(next);
        setGlobalDoc(globalNext);
        setFlagsRead(true);
      },
      () => {
        // Si no se pueden leer las banderas, todo queda apagado y el flujo
        // manual sigue: es el fallback determinista del programa de IA.
        setFlagDocs({});
        setGlobalDoc(null);
        setFlagsRead(true);
      },
    );

    return unsubscribe;
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated || !tenantId || !db) {
      setOverridesDoc(null);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, FEATURE_FLAG_OVERRIDES_COLLECTION, tenantId),
      (snapshot) => setOverridesDoc(snapshot.exists() ? (snapshot.data() as FeatureFlagOverridesDoc) : null),
      () => setOverridesDoc(null),
    );

    return unsubscribe;
  }, [authenticated, tenantId]);

  const value = useMemo<FeatureFlagsContextValue>(() => {
    const decisions = FEATURE_FLAG_KEYS.reduce((acc, key) => {
      acc[key] = resolveFeatureFlag(key, {
        flag: flagDocs[key] ?? null,
        global: globalDoc,
        overrides: overridesDoc,
      });
      return acc;
    }, {} as Record<FeatureFlagKey, FeatureFlagDecision>);

    const reason = globalDoc?.killSwitch === true && typeof globalDoc.reason === "string" ? globalDoc.reason : null;

    return { ready: !authenticated || flagsRead, decisions, killSwitchReason: reason };
  }, [authenticated, flagDocs, globalDoc, overridesDoc, flagsRead]);

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

/**
 * No lanza si falta el provider: devuelve los defaults del catálogo. Una
 * bandera es una red de seguridad; que tumbe una pantalla por estar montada
 * fuera del árbol sería exactamente lo contrario.
 */
function useFeatureFlagsContext(): FeatureFlagsContextValue {
  const context = useContext(FeatureFlagsContext);
  return context ?? { ready: false, decisions: DEFAULT_DECISIONS, killSwitchReason: null };
}

/** ¿Está encendida esta capacidad para la sesión actual? */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  return useFeatureFlagsContext().decisions[key].enabled;
}

/** Igual que `useFeatureFlag`, pero con el porqué. Para diagnóstico y consola. */
export function useFeatureFlagDecision(key: FeatureFlagKey): FeatureFlagDecision {
  return useFeatureFlagsContext().decisions[key];
}

export function useFeatureFlags(): FeatureFlagsContextValue {
  return useFeatureFlagsContext();
}
