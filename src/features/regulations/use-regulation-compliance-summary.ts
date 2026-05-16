"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";

type TowerStat = { tower: string; signed: number; total: number; pct: number };

type SummaryReturn = {
  signed: number;
  total: number;
  pending: number;
  pct: number;
  byTower: TowerStat[];
  activeRegulationId: string | null;
  loading: boolean;
  error: string | null;
};

type UnitRow = { id: string; tower: string; status?: string };
type SignatureRow = { unitId: string };

function deriveTower(rawTower: unknown, unitLabel?: string, unitId?: string) {
  const fromField = typeof rawTower === "string" ? rawTower.trim() : "";
  if (fromField) return fromField;
  const source = (typeof unitLabel === "string" ? unitLabel : typeof unitId === "string" ? unitId : "").trim();
  if (!source) return "Sin torre";
  const prefix = source.split("-")[0]?.trim();
  if (prefix && prefix !== source) return prefix;
  return "Sin torre";
}

/**
 * Aggregates regulation-signature progress for the admin dashboard.
 *
 * `totalUnits` is an override; when omitted (0) we use the count of active
 * units in the `units` collection.
 */
export function useRegulationComplianceSummary(
  tenantId?: string,
  totalUnitsOverride?: number,
): SummaryReturn {
  const [activeRegulationId, setActiveRegulationId] = useState<string | null>(null);
  const [signatures, setSignatures] = useState<SignatureRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(Boolean(tenantId));
  const [loadingSignatures, setLoadingSignatures] = useState(Boolean(tenantId));
  const [loadingUnits, setLoadingUnits] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  // Subscribe to tenantSettings to track active regulation id.
  useEffect(() => {
    if (!tenantId || !db) {
      setLoadingSettings(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "tenantSettings", tenantId),
      (snap) => {
        const next = snap.exists() ? ((snap.data().activeRegulationId as string | undefined) ?? null) : null;
        setActiveRegulationId(next ?? null);
        setLoadingSettings(false);
      },
      (err) => {
        setError(err.message);
        setLoadingSettings(false);
      },
    );
    return () => unsub();
  }, [tenantId]);

  // Subscribe to the units collection (used for totals + tower grouping).
  useEffect(() => {
    if (!tenantId || !db) {
      setLoadingUnits(false);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, "units"), where("tenantId", "==", tenantId)),
      (snap) => {
        const rows: UnitRow[] = snap.docs.map((d) => {
          const data = d.data() as DocumentData;
          return {
            id: d.id,
            tower: deriveTower(data.tower, data.displayName as string, d.id),
            status: typeof data.status === "string" ? data.status : undefined,
          };
        });
        setUnits(rows);
        setLoadingUnits(false);
      },
      (err) => {
        setError(err.message);
        setLoadingUnits(false);
      },
    );
    return () => unsub();
  }, [tenantId]);

  // Subscribe to regulation signatures for the active regulation.
  useEffect(() => {
    if (!tenantId || !db || !activeRegulationId) {
      setSignatures([]);
      setLoadingSignatures(false);
      return;
    }
    const unsub = onSnapshot(
      query(
        collection(db, "regulation_signatures"),
        where("tenantId", "==", tenantId),
        where("regulationId", "==", activeRegulationId),
      ),
      (snap) => {
        const rows: SignatureRow[] = snap.docs.map((d) => {
          const data = d.data() as DocumentData;
          return { unitId: typeof data.unitId === "string" ? data.unitId : "" };
        });
        setSignatures(rows);
        setLoadingSignatures(false);
      },
      (err) => {
        setError(err.message);
        setLoadingSignatures(false);
      },
    );
    return () => unsub();
  }, [tenantId, activeRegulationId]);

  return useMemo(() => {
    const activeUnits = units.filter((u) => u.status !== "inactive");
    const signedUnitIds = new Set(signatures.map((s) => s.unitId).filter(Boolean));

    const total = totalUnitsOverride && totalUnitsOverride > 0 ? totalUnitsOverride : activeUnits.length;
    const signed = activeUnits.filter((u) => signedUnitIds.has(u.id)).length;
    const pending = Math.max(total - signed, 0);
    const pct = total > 0 ? Math.round((signed / total) * 100) : 0;

    const towerMap = new Map<string, { signed: number; total: number }>();
    for (const u of activeUnits) {
      const bucket = towerMap.get(u.tower) ?? { signed: 0, total: 0 };
      bucket.total += 1;
      if (signedUnitIds.has(u.id)) bucket.signed += 1;
      towerMap.set(u.tower, bucket);
    }
    const byTower: TowerStat[] = Array.from(towerMap.entries())
      .map(([tower, agg]) => ({
        tower,
        signed: agg.signed,
        total: agg.total,
        pct: agg.total > 0 ? Math.round((agg.signed / agg.total) * 100) : 0,
      }))
      .sort((a, b) => a.tower.localeCompare(b.tower));

    return {
      signed,
      total,
      pending,
      pct,
      byTower,
      activeRegulationId,
      loading: loadingSettings || loadingSignatures || loadingUnits,
      error,
    };
  }, [activeRegulationId, units, signatures, totalUnitsOverride, loadingSettings, loadingSignatures, loadingUnits, error]);
}
