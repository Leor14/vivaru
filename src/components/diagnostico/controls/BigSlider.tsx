"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Props = {
  name: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  /** Suffix appended after the big number, e.g. "unidades", "%", "horas". */
  unit: string;
  /** Optional helper text below the slider track. */
  hint?: string;
};

/**
 * Large mobile-friendly slider with a hero-sized value readout. Wraps the
 * native <input type="range"> for accessibility — we style only the track
 * and thumb. Touch target on the thumb is 44 px (per WCAG 2.5.5).
 */
export function BigSlider({
  name,
  min,
  max,
  step,
  value,
  onChange,
  unit,
  hint,
}: Props) {
  const id = React.useId();
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col items-center gap-md">
      <output
        htmlFor={id}
        aria-live="polite"
        className="flex items-baseline gap-2"
      >
        <span className="font-display text-[64px] leading-none text-navy tabular-nums">
          {value}
        </span>
        <span className="text-base font-medium text-slate-500">{unit}</span>
      </output>

      <input
        id={id}
        type="range"
        name={name}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={name}
        className={cn(
          "vivaru-big-slider w-full appearance-none bg-transparent",
          "focus-visible:outline-none",
        )}
        style={{
          // Gradient track via background-image: filled portion brand-blue,
          // remaining portion slate-200.
          background: `linear-gradient(to right, #4B5FD4 0%, #4B5FD4 ${pct}%, #E2E8F0 ${pct}%, #E2E8F0 100%)`,
          height: 8,
          borderRadius: 999,
        }}
      />

      <div className="flex w-full justify-between text-xs text-slate-500 tabular-nums">
        <span>{min}</span>
        <span>{max}</span>
      </div>

      {hint ? <p className="text-center text-xs text-slate-500">{hint}</p> : null}

      <style jsx>{`
        .vivaru-big-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          background: #ffffff;
          border: 3px solid #4b5fd4;
          box-shadow: 0 2px 8px rgba(11, 60, 93, 0.18);
          cursor: pointer;
          /* Expand hit area to 44px without growing visual size. */
          margin-top: 0;
        }
        .vivaru-big-slider::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          background: #ffffff;
          border: 3px solid #4b5fd4;
          box-shadow: 0 2px 8px rgba(11, 60, 93, 0.18);
          cursor: pointer;
        }
        .vivaru-big-slider:focus-visible::-webkit-slider-thumb {
          outline: 3px solid rgba(75, 95, 212, 0.4);
          outline-offset: 2px;
        }
        .vivaru-big-slider:focus-visible::-moz-range-thumb {
          outline: 3px solid rgba(75, 95, 212, 0.4);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
