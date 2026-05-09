"use client";

import { useEffect, useState } from "react";

import { db } from "@/lib/firebase/client";
import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { TenantDocument } from "@/types/domain";

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
      { orderByField: "uploadedAt", orderDirection: "desc" },
    );

    return () => {
      if (unsub) unsub();
    };
  }, [tenantId]);

  if (!tenantId) {
    return { items: [], loading: false };
  }

  if (!db) return { items: [], loading: false };

  return { items, loading };
}

export async function createDocument(input: {
  tenantId: string;
  userId: string;
  title: string;
  category: TenantDocument["category"];
  audience: TenantDocument["audience"];
}) {
  await createTenantDocument("documents", input.tenantId, input.userId, {
    title: input.title,
    category: input.category,
    audience: input.audience,
    uploadedAt: new Date().toISOString(),
  });
}
