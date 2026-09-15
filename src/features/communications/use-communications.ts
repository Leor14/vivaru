"use client";

import { useEffect, useState } from "react";

import { db } from "@/lib/firebase/client";
import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import { normalizeResidentCommunication, type ResidentCommunication } from "@/features/communications/visibility";

type Crudo = Record<string, unknown> & { id: string };

/**
 * Los comunicados del conjunto, en vivo.
 *
 * **Dos modos, porque la regla es distinta para cada uno** (`D-2b`, 15 sep 2026):
 * - **Administración** (sin `residente`): todos los del conjunto, como siempre.
 * - **Residente** (`residente: { unitId }`): la regla solo le deja leer los de `audience: "all"`
 *   y los dirigidos a SU unidad, y Firestore rechaza entera una consulta que no filtre por
 *   eso. Así que son **dos consultas** —las generales y las de su unidad— que se juntan aquí.
 *   Sin `orderBy`, para no depender de índices compuestos nuevos: se ordena en memoria, como
 *   ya se hacía.
 *
 * El panel del administrador también usa este hook: por eso el modo residente es explícito y
 * no se deduce de nada.
 */
export function useCommunications(tenantId?: string, options?: { residente?: { unitId?: string | null } }) {
  const [items, setItems] = useState<ResidentCommunication[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  const comoResidente = Boolean(options?.residente);
  const unitIdDelResidente = options?.residente?.unitId ?? null;

  useEffect(() => {
    if (!tenantId || !db) {
      return;
    }

    const publicar = (data: Crudo[]) => {
      const now = new Date();
      const visible = data
        .map((item) => normalizeResidentCommunication(item, now))
        .filter((item): item is ResidentCommunication => Boolean(item))
        .filter((item) => item.tenantId === tenantId)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

      setItems(visible);
      setError(null);
      setLoading(false);
    };

    const alFallar = (message: string) => {
      console.error("[communications]", { tenantId, comoResidente, message });
      setError(message);
      setLoading(false);
    };

    if (!comoResidente) {
      const unsub = subscribeTenantCollection<Crudo>("communications", tenantId, publicar, alFallar, {
        orderByField: "publishedAt",
        orderDirection: "desc",
      });
      return () => {
        if (unsub) unsub();
      };
    }

    // Modo residente: cada consulta guarda su último lote y se publica la unión, sin repetidos.
    const lotes = new Map<"generales" | "de-su-unidad", Crudo[]>();
    const volcar = () => {
      const porId = new Map<string, Crudo>();
      for (const lote of lotes.values()) for (const item of lote) porId.set(item.id, item);
      publicar([...porId.values()]);
    };

    const unsubs = [
      subscribeTenantCollection<Crudo>(
        "communications",
        tenantId,
        (data) => {
          lotes.set("generales", data);
          volcar();
        },
        alFallar,
        { equals: [{ field: "audience", value: "all" }] },
      ),
    ];
    if (unitIdDelResidente) {
      unsubs.push(
        subscribeTenantCollection<Crudo>(
          "communications",
          tenantId,
          (data) => {
            lotes.set("de-su-unidad", data);
            volcar();
          },
          alFallar,
          { arrayContains: { field: "audienceUnitIds", value: unitIdDelResidente } },
        ),
      );
    }

    return () => {
      for (const unsub of unsubs) if (unsub) unsub();
    };
  }, [tenantId, comoResidente, unitIdDelResidente]);

  if (!tenantId) {
    return { items: [], loading: false, error: null };
  }

  if (!db) return { items: [], loading: false, error: "Firebase no esta configurado." };

  return { items, loading, error };
}

export async function createCommunication(input: {
  tenantId: string;
  userId: string;
  title: string;
  body: string;
}) {
  await createTenantDocument("communications", input.tenantId, input.userId, {
    title: input.title,
    body: input.body,
    message: input.body,
    status: "published",
    audience: "all",
    audienceTowers: [],
    audienceUnitIds: [],
    authorName: "Administración",
    publishedAt: new Date().toISOString(),
  });
}
