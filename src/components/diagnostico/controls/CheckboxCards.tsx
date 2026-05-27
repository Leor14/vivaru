"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type CheckboxCardOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type Props<T extends string> = {
  name: string;
  options: CheckboxCardOption<T>[];
  value: T[];
  onChange: (value: T[]) => void;
};

export function CheckboxCards<T extends string>({
  name,
  options,
  value,
  onChange,
}: Props<T>) {
  const toggle = (v: T) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  return (
    <ul
      role="group"
      aria-label={name}
      className="grid gap-3 grid-cols-1 sm:grid-cols-2"
    >
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <li key={opt.value}>
            <button
              type="button"
              role="checkbox"
              aria-checked={selected}
              onClick={() => toggle(opt.value)}
              className={cn(
                "flex w-full min-h-[64px] items-center gap-3 rounded-xl border-2 bg-background px-4 py-4 text-left transition-all",
                "hover:border-brand-blue/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-blue/40",
                selected
                  ? "border-brand-blue bg-brand-blue/5 shadow-brand-sm"
                  : "border-border",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                  selected ? "border-brand-blue bg-brand-blue text-white" : "border-slate-300",
                )}
              >
                {selected ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
              </span>
              <span className="flex flex-1 flex-col">
                <span className="text-base font-semibold text-navy">{opt.label}</span>
                {opt.description ? (
                  <span className="mt-0.5 text-xs text-slate-500">{opt.description}</span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
