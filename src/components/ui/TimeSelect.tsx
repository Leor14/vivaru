import { forwardRef, useId } from "react";
import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

interface TimeSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let h = 5; h <= 23; h++) {
  for (const m of [0, 30]) {
    const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const period = h < 12 ? "a.m." : "p.m.";
    const displayHour = h > 12 ? h - 12 : h;
    const displayMin = String(m).padStart(2, "0");
    TIME_OPTIONS.push({ value, label: `${displayHour}:${displayMin} ${period}` });
  }
}
// Result: 05:00 → 23:30 = 38 options (19 hours × 2)

export const TimeSelect = forwardRef<HTMLSelectElement, TimeSelectProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block mb-1 text-sm font-medium text-[var(--slate-700)]"
          >
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={cn(
            "h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)]",
            error && "border-red-500",
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : undefined}
          {...props}
        >
          <option value="">Seleccionar hora</option>
          {TIME_OPTIONS.map(({ value, label: optLabel }) => (
            <option key={value} value={value}>
              {optLabel}
            </option>
          ))}
        </select>
        {error && (
          <span id={`${selectId}-error`} className="mt-1 block text-xs text-red-500">
            {error}
          </span>
        )}
      </div>
    );
  },
);
TimeSelect.displayName = "TimeSelect";
