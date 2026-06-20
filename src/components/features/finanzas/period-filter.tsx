"use client";

import { cn } from "@/lib/utils/cn";

export type PeriodOption = { months: number; label: string };

const DEFAULT_OPTIONS: PeriodOption[] = [
  { months: 1, label: "1 mes" },
  { months: 3, label: "3 meses" },
  { months: 6, label: "6 meses" },
  { months: 12, label: "12 meses" },
];

/**
 * Control segmentado de un clic para el período de análisis de los tableros.
 * Reemplaza el dropdown: cada opción es un botón. Períodos cortos (1 mes)
 * activan una vista más granular (semanal) en los tableros con serie temporal.
 */
export function PeriodFilter({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
}: {
  value: number;
  onChange: (months: number) => void;
  options?: PeriodOption[];
}) {
  return (
    <div
      role="group"
      aria-label="Período de análisis"
      className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-1"
    >
      {options.map((o) => {
        const active = value === o.months;
        return (
          <button
            key={o.months}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.months)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-white font-medium text-[var(--brand-700)] shadow-[0_1px_2px_rgba(12,33,53,0.08)]"
                : "text-[var(--slate-600)] hover:text-[var(--slate-900)]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
