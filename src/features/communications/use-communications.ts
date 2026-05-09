"use client";

import { useEffect, useState } from "react";

import { db } from "@/lib/firebase/client";
import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import { normalizeResidentCommunication, type ResidentCommunication } from "@/features/communications/visibility";

export function useCommunications(tenantId?: string) {
  const [items, setItems] = useState<ResidentCommunication[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) {
      return;
    }

    const unsub = subscribeTenantCollection<Record<string, unknown> & { id: string }>(
      "communications",
      tenantId,
      (data) => {
        const now = new Date();
        const visible = data
          .map((item) => normalizeResidentCommunication(item, now))
          .filter((item): item is ResidentCommunication => Boolean(item))
          .filter((item) => item.tenantId === tenantId)
          .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

        setItems(visible);
        setError(null);
        setLoading(false);
      },
      (message) => {
        console.error("[admin-dashboard:communications]", { tenantId, message });
        setError(message);
        setLoading(false);
      },
      { orderByField: "publishedAt", orderDirection: "desc" },
    );

    return () => {
      if (unsub) unsub();
    };
  }, [tenantId]);

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
    authorName: "Administración",
    publishedAt: new Date().toISOString(),
  });
}
