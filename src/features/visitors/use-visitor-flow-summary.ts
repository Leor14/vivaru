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
import { toDateKeyLocal } from "@/utils/date";

type SummaryReturn = {
  totalInPeriod: number;
  insideNow: number;
  dailyCounts: Array<{ date: string; count: number }>;
  loading: boolean;
  error: string | null;
};

function tsToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "object") {
    const obj = value as { toDate?: () => Date; seconds?: number };
    if (typeof obj.toDate === "function") {
      try {
        const d = obj.toDate();
        return Number.isNaN(d.getTime()) ? null : d;
      } catch {
        return null;
      }
    }
    if (typeof obj.seconds === "number") return new Date(obj.seconds * 1000);
  }
  return null;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildDateRange(days: number): string[] {
  const today = startOfDay(new Date());
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(toDateKeyLocal(d));
  }
  return out;
}

/**
 * Aggregates visitor flow for the admin dashboard sparkline.
 *
 * Subscribes to ALL passes for the tenant (matching the existing dashboard
 * pattern) and filters/groups client-side. `days` controls the rolling window.
 */
export function useVisitorFlowSummary(tenantId?: string, days = 7): SummaryReturn {
  const [docs, setDocs] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, "visitorPasses"), where("tenantId", "==", tenantId)),
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

  return useMemo(() => {
    const window = buildDateRange(days);
    const windowSet = new Set(window);
    const counts = new Map<string, number>(window.map((d) => [d, 0]));
    let insideNow = 0;

    for (const raw of docs) {
      const status = typeof raw.status === "string" ? raw.status : "";
      if (status === "inside") insideNow += 1;

      const checkIn = tsToDate(raw.checkInAt);
      const fallbackDate = typeof raw.date === "string" && raw.date
        ? new Date(`${raw.date}T00:00:00`)
        : tsToDate(raw.visitDate);
      const refDate = checkIn ?? fallbackDate;
      if (!refDate) continue;
      const key = toDateKeyLocal(refDate);
      if (windowSet.has(key)) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const dailyCounts = window.map((date) => ({ date, count: counts.get(date) ?? 0 }));
    const totalInPeriod = dailyCounts.reduce((acc, item) => acc + item.count, 0);

    return { totalInPeriod, insideNow, dailyCounts, loading, error };
  }, [docs, days, loading, error]);
}
