"use client";

import { useEffect, useState } from "react";

import { db } from "@/lib/firebase/client";
import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { ClearanceCertificate } from "@/types/domain";

/**
 * `PRD-V-FEAT-004` — los certificados de paz y salvo del conjunto.
 *
 * **Solo lectura, y no por estilo.** Las dos escrituras —emitir y anular— van
 * por callable, y las reglas cierran `create`, `update` y `delete` incluso al
 * administrador: la única condición del documento es «saldo cero» y si el
 * cliente pudiera escribirlo, cualquiera se emitiría uno debiendo.
 *
 * - Administrador o consejo: pasar solo `tenantId` → ve los del conjunto.
 * - Residente: pasar `tenantId` **y** `unitId` → R9, solo los de su unidad. Sin
 *   el `unitId` la consulta se deniega ENTERA, no filtrada: las reglas rechazan,
 *   no recortan.
 *
 * **No se ordena en la consulta.** `issuedAt` está en todos los certificados de
 * hoy porque lo escribe el servidor, pero ordenar en el servidor ataría esta
 * lista a que el campo exista siempre — que es cómo el 24 de agosto de 2026 una
 * pantalla acabó diciendo «sin documentos» teniendo ocho. Se ordena en memoria.
 */
export function useClearanceCertificates(tenantId?: string, unitId?: string) {
  const [items, setItems] = useState<ClearanceCertificate[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) return;
    setLoading(true);

    const unsub = subscribeTenantCollection<ClearanceCertificate>(
      "clearanceCertificates",
      tenantId,
      (data) => {
        setItems(
          [...data].sort((a, b) => String(b.issuedAt ?? "").localeCompare(String(a.issuedAt ?? ""))),
        );
        setError(null);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
      { equals: unitId ? [{ field: "unitId", value: unitId }] : undefined },
    );

    return () => {
      if (unsub) unsub();
    };
  }, [tenantId, unitId]);

  return { items, loading, error };
}
