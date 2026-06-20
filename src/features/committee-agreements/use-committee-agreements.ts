"use client";

import { useEffect, useState } from "react";

import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { CommitteeAgreement } from "./types";

/**
 * Acuerdos de comité del tenant, ordenados por fecha de sesión (más nuevos
 * arriba). Realtime; requiere el índice (tenantId, sessionDate desc).
 */
export function useCommitteeAgreements(tenantId?: string) {
  const [items, setItems] = useState<CommitteeAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    const unsub = subscribeTenantCollection<CommitteeAgreement>(
      "committee_agreements",
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
      { orderByField: "sessionDate", orderDirection: "desc" },
    );
    return () => {
      if (unsub) unsub();
    };
  }, [tenantId]);

  return { items, loading, error };
}
