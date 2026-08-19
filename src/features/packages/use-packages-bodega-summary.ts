"use client";

import { useEffect, useMemo, useState } from "react";

import { usePackages } from "@/features/packages/use-packages";

export type BodegaPackage = {
  id: string;
  name: string;
  unitLabel: string;
  tower: string;
  daysInBodega: number;
  createdAt: string;
};

type SummaryReturn = {
  items: BodegaPackage[];
  loading: boolean;
  error: string | null;
};

function deriveTower(rawTower: unknown, unitLabel: string) {
  const fromField = typeof rawTower === "string" ? rawTower.trim() : "";
  if (fromField) return fromField;
  const prefix = unitLabel.split("-")[0]?.trim();
  if (prefix && prefix !== unitLabel) return prefix;
  return "Sin torre";
}

function parseArrivedAt(value: unknown): number {
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? Date.now() : ms;
  }
  if (value && typeof value === "object") {
    const obj = value as { toDate?: () => Date; seconds?: number };
    if (typeof obj.toDate === "function") {
      try {
        return obj.toDate().getTime();
      } catch {
        return Date.now();
      }
    }
    if (typeof obj.seconds === "number") return obj.seconds * 1000;
  }
  return Date.now();
}

export function usePackagesBodegaSummary(tenantId?: string): SummaryReturn {
  const { items: packages, loading, error } = usePackages(tenantId);
  // Inicializador perezoso: pasado como valor, `Date.now()` se evalúa en CADA
  // render aunque solo se use en el primero. Es lo que marca la regla de pureza.
  const [now, setNow] = useState(() => Date.now());

  // Refresh "days" once per hour so badges stay accurate without a reload.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const items = useMemo<BodegaPackage[]>(() => {
    return packages
      .filter((pkg) => pkg.status === "pending")
      .map((pkg) => {
        const unitLabel = pkg.unitLabel ?? "";
        const arrivedMs = parseArrivedAt(pkg.arrivedAt);
        const daysInBodega = Math.max(Math.floor((now - arrivedMs) / 86400000), 0);
        const recipient = pkg.residentName || pkg.recipientName || "Residente";
        const tower = deriveTower(pkg.tower, unitLabel);
        return {
          id: pkg.id,
          name: pkg.description?.trim() || pkg.reference || "Paquete",
          unitLabel: `${tower}${unitLabel && !unitLabel.startsWith(tower) ? ` · ${unitLabel}` : ""} · ${recipient}`,
          tower,
          daysInBodega,
          createdAt: typeof pkg.arrivedAt === "string" ? pkg.arrivedAt : new Date(arrivedMs).toISOString(),
        };
      })
      .sort((a, b) => b.daysInBodega - a.daysInBodega);
  }, [packages, now]);

  return { items, loading, error };
}
