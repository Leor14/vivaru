"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { getModuleVariant, type VisitorsVariant } from "@/lib/config/module-variants";

/**
 * Variante de Visitas del conjunto en tiempo real ("qr_full" por defecto).
 * Si falta el dato, devuelve el default, por lo que los conjuntos existentes
 * mantienen el flujo con QR.
 */
export function useVisitorsVariant(tenantId?: string): VisitorsVariant {
  const [variant, setVariant] = useState<VisitorsVariant>("qr_full");

  useEffect(() => {
    if (!tenantId || !db) return;
    const unsub = onSnapshot(doc(db, "tenantSettings", tenantId), (snap) => {
      const data = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
      setVariant(getModuleVariant(data, "visitors"));
    });
    return unsub;
  }, [tenantId]);

  return variant;
}
