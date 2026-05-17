"use client";

import { useEffect, useState } from "react";

import { watchActiveServices, type ServiceItem } from "@/features/admin/services";

export function useServices(tenantId?: string) {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const unsub = watchActiveServices(
      tenantId,
      (data) => {
        setItems(data);
        setError(null);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [tenantId]);

  if (!tenantId) return { items: [], loading: false, error: null };

  return { items, loading, error };
}
