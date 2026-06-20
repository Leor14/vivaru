"use client";

import { useState } from "react";

import { cn } from "@/lib/utils/cn";

export type PeriodOption = { months: number; label: string };

const DEFAULT_OPTIONS: PeriodOption[] = [
  { months: 1, label: "1 mes" },
  { months: 3, label: "3 meses" },
  { months: 6, label: "6 meses" },
  { months: 12, label: "12 meses" },
];

const MIN_MONTHS = 1;
const MAX_MONTHS = 24;

const chipClass = (active: boolean) =>
  cn(
    "rounded-lg px-3 py-1.5 text-sm transition-colors",
    active
      ? "bg-white font-medium text-[var(--brand-700)] shadow-[0_1px_2px_rgba(12,33,53,0.08)]"
      : "text-[var(--slate-600)] hover:text-[var(--slate-900)]",
  );

/**
 * Control segmentado del período de análisis: presets de un clic más un chip
 * "Personalizado" que abre un input para elegir un número de meses arbitrario
 * (1–24). El valor sigue siendo un número de meses; granularityFor lo absorbe.
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
  const isPreset = options.some((o) => o.months === value);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  function selectPreset(months: number) {
    onChange(months);
    setOpen(false);
  }
  function toggleCustom() {
    setDraft(value);
    setOpen((prev) => !prev);
  }
  function applyCustom() {
    const n = Math.max(MIN_MONTHS, Math.min(MAX_MONTHS, Math.round(Number(draft) || MIN_MONTHS)));
    onChange(n);
    setOpen(false);
  }

  const customLabel = isPreset ? "Personalizado" : `${value} ${value === 1 ? "mes" : "meses"}`;

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div
        role="group"
        aria-label="Período de análisis"
        className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-1"
      >
        {options.map((o) => (
          <button
            key={o.months}
            type="button"
            aria-pressed={value === o.months}
            onClick={() => selectPreset(o.months)}
            className={chipClass(value === o.months)}
          >
            {o.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={!isPreset}
          aria-expanded={open}
          onClick={toggleCustom}
          className={chipClass(!isPreset)}
        >
          {customLabel}
        </button>
      </div>

      {open ? (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--slate-200)] bg-white px-3 py-2">
          <label className="flex items-center gap-2 text-sm text-[var(--slate-600)]">
            Meses
            <input
              type="number"
              min={MIN_MONTHS}
              max={MAX_MONTHS}
              value={draft}
              onChange={(e) => setDraft(Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyCustom();
              }}
              className="h-8 w-16 rounded-lg border border-[var(--slate-300)] bg-white px-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={applyCustom}
            className="rounded-lg border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-1 text-sm font-medium text-[var(--brand-700)] transition-colors hover:bg-[var(--brand-200)]/40"
          >
            Aplicar
          </button>
        </div>
      ) : null}
    </div>
  );
}
