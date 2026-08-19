"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";

type SummaryReturn = {
  age0to15: number;
  age15to30: number;
  age30plus: number;
  total: number;
  categories: string[];
  loading: boolean;
  error: string | null;
};

function tsToMs(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === "object") {
    const obj = value as { toDate?: () => Date; seconds?: number };
    if (typeof obj.toDate === "function") {
      try {
        const ms = obj.toDate().getTime();
        return Number.isNaN(ms) ? null : ms;
      } catch {
        return null;
      }
    }
    if (typeof obj.seconds === "number") return obj.seconds * 1000;
  }
  return null;
}

const CLOSED_STATUSES = new Set(["resolved", "closed", "responded"]);

export function usePqrsAgingSummary(tenantId?: string, categoryFilter: string = "all"): SummaryReturn {
  const [docs, setDocs] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, "tickets"), where("tenantId", "==", tenantId)),
      (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [tenantId]);

  // `now` como estado y no como `Date.now()` dentro del useMemo, por dos motivos
  // que apuntan al mismo sitio: llamar una función impura durante el render es lo
  // que marcaba la regla de lint, y además la antigüedad quedaba **congelada**
  // hasta que cambiara algún ticket — un tablero abierto toda la tarde seguía
  // diciendo «hace 2 días» al día siguiente. Mismo patrón que
  // `usePackagesBodegaSummary`, que ya lo resolvía así.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    const categories = new Set<string>();
    let age0to15 = 0;
    let age15to30 = 0;
    let age30plus = 0;

    for (const raw of docs) {
      const type = typeof raw.type === "string" && raw.type ? raw.type : "other";
      categories.add(type);

      const status = typeof raw.status === "string" ? raw.status : "open";
      if (CLOSED_STATUSES.has(status)) continue;

      if (categoryFilter !== "all" && type !== categoryFilter) continue;

      const startMs = tsToMs(raw.radicationDate) ?? tsToMs(raw.createdAt) ?? tsToMs(raw.updatedAt);
      if (startMs == null) continue;
      const ageDays = Math.floor((now - startMs) / 86400000);

      if (ageDays < 15) age0to15 += 1;
      else if (ageDays < 30) age15to30 += 1;
      else age30plus += 1;
    }

    return {
      age0to15,
      age15to30,
      age30plus,
      total: age0to15 + age15to30 + age30plus,
      categories: Array.from(categories).sort(),
      loading,
      error,
    };
  }, [docs, categoryFilter, loading, error]);
}
