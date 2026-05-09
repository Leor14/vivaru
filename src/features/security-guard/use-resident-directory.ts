"use client";

import { useMemo } from "react";

import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import { db } from "@/lib/firebase/client";
import { useEffect, useState } from "react";

type ResidentRecord = {
  id: string;
  tenantId: string;
  unitId?: string;
  fullName?: string;
  status?: string;
};

function normalizeName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function useResidentDirectory(tenantId?: string) {
  const [people, setPeople] = useState<ResidentRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) {
      setPeople([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    const unsub = subscribeTenantCollection<ResidentRecord>(
      "people",
      tenantId,
      (data) => {
        setPeople(data);
        setError(null);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );

    return () => {
      if (unsub) unsub();
    };
  }, [tenantId]);

  const residentNamesByUnit = useMemo(() => {
    const map = new Map<string, string[]>();

    for (const person of people) {
      const unitId = typeof person.unitId === "string" ? person.unitId.trim() : "";
      const fullName = normalizeName(person.fullName);
      const status = typeof person.status === "string" ? person.status : "active";

      if (!unitId || !fullName || status !== "active") {
        continue;
      }

      const current = map.get(unitId) ?? [];
      if (!current.includes(fullName)) {
        current.push(fullName);
      }
      map.set(unitId, current);
    }

    for (const [unitId, names] of map.entries()) {
      map.set(unitId, [...names].sort((a, b) => a.localeCompare(b, "es")));
    }

    return map;
  }, [people]);

  return {
    residentNamesByUnit,
    loading,
    error,
  };
}
