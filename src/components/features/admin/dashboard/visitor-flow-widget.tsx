"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useVisitorFlowSummary } from "@/features/visitors/use-visitor-flow-summary";

type RangeOption = { key: "7" | "30" | "month"; label: string; days: number };

const RANGE_OPTIONS: RangeOption[] = [
  { key: "7", label: "7 días", days: 7 },
  { key: "30", label: "30 días", days: 30 },
  { key: "month", label: "Este mes", days: new Date().getDate() },
];

const SHORT_DAY_LABELS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

type Props = { tenantId?: string };

export function VisitorFlowWidget({ tenantId }: Props) {
  const [rangeKey, setRangeKey] = useState<RangeOption["key"]>("7");
  const range = RANGE_OPTIONS.find((r) => r.key === rangeKey) ?? RANGE_OPTIONS[0];
  const summary = useVisitorFlowSummary(tenantId, range.days);

  const sample = useMemo(() => {
    const data = summary.dailyCounts;
    if (data.length <= 7) return data;
    const step = Math.max(1, Math.floor(data.length / 7));
    const sliced = data.filter((_, i) => i % step === 0).slice(-7);
    // Always include the last (today) bar
    const last = data[data.length - 1];
    if (sliced[sliced.length - 1]?.date !== last.date) sliced[sliced.length - 1] = last;
    return sliced;
  }, [summary.dailyCounts]);

  const maxCount = Math.max(...sample.map((d) => d.count), 1);

  const labels = useMemo(() => {
    if (rangeKey === "7") {
      return sample.map((d, i) => {
        if (i === sample.length - 1) return "hoy";
        const date = new Date(`${d.date}T00:00:00`);
        return SHORT_DAY_LABELS[date.getDay()] ?? "";
      });
    }
    if (rangeKey === "30") {
      return sample.map((d, i) => {
        if (i === sample.length - 1) return "hoy";
        if (i === 0) return "-30d";
        if (i === Math.floor(sample.length / 2)) return "-14d";
        return "";
      });
    }
    return sample.map((d, i) => {
      if (i === sample.length - 1) return "hoy";
      const dayNum = new Date(`${d.date}T00:00:00`).getDate();
      if (i === 0 || i === Math.floor(sample.length / 2)) return String(dayNum);
      return "";
    });
  }, [sample, rangeKey]);

  return (
    <Card className="soft-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label text-[var(--slate-500)]">Flujo de ingresos</p>
          <CardTitle className="mt-1 text-lg" help="Conteo diario de ingresos de visitantes validados en porteria. El grafico compara el rango seleccionado y muestra cuantos estan actualmente dentro del conjunto.">Visitantes registrados</CardTitle>
          <CardDescription className="mt-1">
            Conteo diario de ingresos validados en portería.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {summary.insideNow > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--tinte-neutro-fondo-3)] px-2.5 py-1 text-xs font-medium text-[var(--tinte-verde-texto-2)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--tinte-verde-fondo-2)]" />
              {summary.insideNow} dentro
            </span>
          ) : null}
          <Link href="/admin/visitors" className="text-xs font-medium text-[var(--brand-700)] hover:underline">
            Ver todo →
          </Link>
        </div>
      </div>

      <div className="mt-3 inline-flex gap-1 rounded-xl bg-[var(--slate-100)] p-1">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setRangeKey(opt.key)}
            className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
              rangeKey === opt.key
                ? "bg-[var(--surface-strong)] font-semibold text-[var(--slate-800)] shadow-sm"
                : "text-[var(--slate-600)] hover:text-[var(--slate-800)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-[var(--slate-900)]">{summary.totalInPeriod}</span>
        <span className="text-sm text-[var(--slate-600)]">
          {rangeKey === "month" ? "ingresos este mes" : `ingresos últimos ${range.days} días`}
        </span>
      </div>

      {summary.loading ? (
        <div className="mt-4 h-12 w-full animate-pulse rounded-sm bg-[var(--slate-200)]" />
      ) : (
        <>
          <div className="mt-3 flex h-12 items-end gap-1.5">
            {sample.map((d, i) => {
              const isToday = i === sample.length - 1;
              const height = Math.max((d.count / maxCount) * 100, 6);
              return (
                <div
                  key={d.date}
                  className="flex-1 rounded-t transition-all"
                  style={{
                    height: `${height}%`,
                    minHeight: "4px",
                    background: isToday ? "#378ADD" : "#B5D4F4",
                    outline: isToday ? "1.5px solid #185FA5" : "none",
                    outlineOffset: 1,
                  }}
                  title={`${d.date}: ${d.count}`}
                />
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-[var(--slate-500)]">
            {labels.map((label, i) => (
              <span key={i} className="flex-1 text-center first:text-left last:text-right">
                {label}
              </span>
            ))}
          </div>
        </>
      )}

      {summary.error ? (
        <p className="mt-2 text-xs text-[var(--danger-700)]">No pudimos cargar el flujo de visitantes.</p>
      ) : null}
    </Card>
  );
}
