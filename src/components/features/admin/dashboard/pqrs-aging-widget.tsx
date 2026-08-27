"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { usePqrsAgingSummary } from "@/features/pqrs/use-pqrs-aging-summary";

type Props = { tenantId?: string };

const CATEGORY_LABELS: Record<string, string> = {
  petition: "Petición",
  complaint: "Queja",
  claim: "Reclamo",
  suggestion: "Sugerencia",
  other: "Otros",
};

export function PqrsAgingWidget({ tenantId }: Props) {
  const [category, setCategory] = useState<string>("all");
  const summary = usePqrsAgingSummary(tenantId, category);
  const fullSummary = usePqrsAgingSummary(tenantId, "all"); // For category options

  const total = summary.total || 1;
  const w1 = Math.round((summary.age0to15 / total) * 100);
  const w2 = Math.round((summary.age15to30 / total) * 100);
  const w3 = Math.round((summary.age30plus / total) * 100);

  return (
    <Card className="soft-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label text-[var(--slate-500)]">PQRS críticas</p>
          <CardTitle className="mt-1 text-lg" help="Distribucion de PQRS abiertas por antiguedad desde su radicacion. Los casos mayores a 30 dias son criticos y requieren atencion inmediata.">Casos por antigüedad</CardTitle>
          <CardDescription className="mt-1">
            Distribución de PQRS abiertas según días desde su radicación.
          </CardDescription>
        </div>
        <Link href="/admin/pqrs" className="text-xs font-medium text-[var(--brand-700)] hover:underline">
          Gestionar →
        </Link>
      </div>

      <div className="mt-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-[var(--slate-300)] bg-white px-2.5 py-1 text-xs text-[var(--slate-700)]"
        >
          <option value="all">Todas las categorías</option>
          {fullSummary.categories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c] ?? c}
            </option>
          ))}
        </select>
      </div>

      {summary.loading ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-3 w-full animate-pulse rounded-sm bg-[var(--slate-200)]" />
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          <AgeBar label="0 – 15 días" width={w1} count={summary.age0to15} tone="ok" />
          <AgeBar label="15 – 30 días" width={w2} count={summary.age15to30} tone="warn" />
          <AgeBar label="+30 días" width={w3} count={summary.age30plus} tone="crit" />
        </div>
      )}

      {summary.age30plus > 0 ? (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#FCEBEB] px-2.5 py-1.5 text-xs text-[#A32D2D]">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {summary.age30plus} {summary.age30plus === 1 ? "caso superó" : "casos superaron"} el umbral de 30 días
        </div>
      ) : null}

      {summary.error ? (
        <p className="mt-2 text-xs text-[var(--danger-700)]">No pudimos cargar la antigüedad de PQRS.</p>
      ) : null}
    </Card>
  );
}

function AgeBar({
  label,
  width,
  count,
  tone,
}: {
  label: string;
  width: number;
  count: number;
  tone: "ok" | "warn" | "crit";
}) {
  const color = tone === "ok" ? "#1D9E75" : tone === "warn" ? "#EF9F27" : "#E24B4A";
  const textColor = tone === "ok" ? "text-[#0F6E56]" : tone === "warn" ? "text-[#854F0B]" : "text-[#A32D2D]";
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-20 shrink-0 text-xs text-[var(--slate-600)]">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--slate-200)]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
      <span className={`w-6 shrink-0 text-right text-xs font-semibold ${textColor}`}>{count}</span>
    </div>
  );
}
