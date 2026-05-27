"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type RadioCardOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
};

type Props<T extends string> = {
  name: string;
  options: RadioCardOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  /** Number of columns on desktop (mobile is always 1 col, sm:2 if > 1 option). */
  columns?: 2 | 4;
};

export function RadioCards<T extends string>({
  name,
  options,
  value,
  onChange,
  columns = 2,
}: Props<T>) {
  return (
    <ul
      role="radiogroup"
      aria-label={name}
      className={cn(
        "grid gap-3",
        "grid-cols-1 sm:grid-cols-2",
        columns === 4 && "lg:grid-cols-2",
      )}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <li key={opt.value}>
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex w-full min-h-[64px] items-center gap-3 rounded-xl border-2 bg-background px-4 py-4 text-left transition-all",
                "hover:border-brand-blue/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-blue/40",
                selected
                  ? "border-brand-blue bg-brand-blue/5 shadow-brand-sm"
                  : "border-border",
              )}
            >
              {opt.icon ? (
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    selected ? "bg-brand-blue text-white" : "bg-slate-100 text-slate-600",
                  )}
                  aria-hidden="true"
                >
                  {opt.icon}
                </span>
              ) : null}
              <span className="flex flex-1 flex-col">
                <span className="text-base font-semibold text-navy">{opt.label}</span>
                {opt.description ? (
                  <span className="mt-0.5 text-xs text-slate-500">{opt.description}</span>
                ) : null}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  selected ? "border-brand-blue bg-brand-blue" : "border-slate-300",
                )}
              >
                {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
