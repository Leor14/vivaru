"use client";

import { useEffect, useMemo, useState } from "react";

import { db } from "@/lib/firebase/client";
import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { TenantDocument } from "@/types/domain";
import { toLocalDate } from "@/utils/date";

/**
 * Documentos del conjunto, para el portal del residente.
 *
 * **Se piden SIN `orderBy` y se ordenan en memoria.** Es el patrón de
 * `watchDocuments` —el lado del administrador, que nunca se rompió— y el mismo
 * de `watchLedger`: no depende de que exista un índice compuesto ni de que un
 * campo esté poblado en todos los documentos.
 *
 * Hasta el 24 de agosto de 2026 esto pedía `orderBy("uploadedAt", "desc")`.
 * **Un `orderBy` descarta los documentos que no traen el campo**, y la subida
 * real escribe `createdAt`, no `uploadedAt`: de 39 documentos en producción, 38
 * no lo tenían. La consulta devolvía cero y la pantalla decía «Sin documentos»
 * teniendo ocho — un fallo mudo, porque una lista vacía se lee como un dato.
 */
export function useDocuments(tenantId?: string) {
  const [items, setItems] = useState<TenantDocument[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));

  useEffect(() => {
    if (!tenantId || !db) {
      return;
    }

    const unsub = subscribeTenantCollection<TenantDocument>(
      "documents",
      tenantId,
      (data) => {
        setItems(data);
        setLoading(false);
      },
      () => setLoading(false),
    );

    return () => {
      if (unsub) unsub();
    };
  }, [tenantId]);

  // `createdAt` llega como `Timestamp` de Firestore, no como cadena: comparar
  // con `localeCompare` daría un orden arbitrario. Los que no traen fecha van al
  // final en vez de desaparecer, que es justo el defecto que esto corrige.
  const ordenados = useMemo(
    () =>
      [...items].sort((a, b) => {
        const fa = toLocalDate(a.createdAt)?.getTime() ?? -Infinity;
        const fb = toLocalDate(b.createdAt)?.getTime() ?? -Infinity;
        return fb - fa;
      }),
    [items],
  );

  if (!tenantId) {
    return { items: [], loading: false };
  }

  if (!db) return { items: [], loading: false };

  return { items: ordenados, loading };
}
