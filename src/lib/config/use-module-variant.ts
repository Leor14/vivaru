"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import {
  DEFAULT_MODULE_VARIANTS,
  getModuleVariant,
  type ModuleVariantKey,
  type ModuleVariants,
} from "@/lib/config/module-variants";

/**
 * Lee en tiempo real la variante de un módulo del conjunto. Si falta el dato, devuelve el
 * default (= comportamiento actual), por lo que los conjuntos existentes no cambian.
 */
export function useModuleVariant<K extends ModuleVariantKey>(
  tenantId: string | undefined,
  key: K,
): ModuleVariants[K] {
  const [variant, setVariant] = useState<ModuleVariants[K]>(DEFAULT_MODULE_VARIANTS[key]);

  useEffect(() => {
    if (!tenantId || !db) return;
    const unsub = onSnapshot(doc(db, "tenantSettings", tenantId), (snap) => {
      const data = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
      setVariant(getModuleVariant(data, key));
    });
    return unsub;
  }, [tenantId, key]);

  return variant;
}
