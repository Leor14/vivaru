"use client";

import { useEffect, useMemo, useState } from "react";

import { db } from "@/lib/firebase/client";
import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { TenantDocument } from "@/types/domain";
import { toLocalDate } from "@/utils/date";

/**
 * **Qué documentos ve el residente, por categoría.**
 *
 * `documents` es UNA colección con contenido mezclado: el reglamento y las
 * actas conviven con los archivos que genera `monthlyFinancialArchive`. Y esos
 * llevan **detalle financiero por unidad** — la hoja «Morosos» del histórico de
 * cartera dice qué unidad debe y cuánto, y el reporte de comité trae «mayores
 * deudores». Sin filtro, cualquier residente se los descarga.
 *
 * **ESTO NO ES UNA FRONTERA DE SEGURIDAD, y no hay que confundirlo con una.**
 * `firestore.rules` concede `documents` a `sameTenant` y `storage.rules` pone la
 * carpeta entre las compartidas: con esas reglas, un residente puede leer el
 * documento y su `fileUrl` sin pasar por esta pantalla. Esto es un paliativo que
 * honra lo que la página dice que muestra, mientras se decide la regla.
 *
 * **Lista BLANCA a propósito.** Con lista negra, una categoría nueva se
 * publicaría sola el día que alguien la añada; con blanca, como mucho se esconde
 * algo, que se nota y se corrige. Un documento sin categoría tampoco se enseña:
 * no se sabe qué es. El guardián de `tests/documentos-residente.test.ts`
 * comprueba que toda la taxonomía esté clasificada, para que no crezca en
 * silencio.
 */
export const CATEGORIAS_VISIBLES_PARA_RESIDENTE = [
  "asamblea",
  "comunicado",
  "acuerdo",
  "reglamento",
  "plano",
  "memoria",
  "otro",
] as const;

/** Las de administración. Ninguna llega al portal del residente. */
export const CATEGORIAS_SOLO_ADMINISTRACION = [
  "financiero",
  "reporte",
  "comprobante",
  "contrato",
  "legal",
] as const;

const VISIBLES = new Set<string>(CATEGORIAS_VISIBLES_PARA_RESIDENTE);

export function elResidentePuedeVer(doc: { category?: string }): boolean {
  return typeof doc.category === "string" && VISIBLES.has(doc.category);
}

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
      // **El `where` no es opcional, es lo que la REGLA exige.** Firestore
      // evalúa la consulta contra la regla sin ejecutarla: si la regla concede
      // al residente solo estas categorías y la consulta no las nombra, la
      // rechaza entera. El filtro en memoria de abajo se queda como segunda
      // línea, por si las dos listas se separan algún día.
      { oneOf: { field: "category", values: CATEGORIAS_VISIBLES_PARA_RESIDENTE } },
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
      items
        .filter(elResidentePuedeVer)
        .sort((a, b) => {
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
