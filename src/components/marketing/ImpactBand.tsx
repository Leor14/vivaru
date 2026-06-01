"use client";

import * as React from "react";
import { useCountUp, useInView, useReducedMotion } from "@/lib/marketing/hooks";
import { cn } from "@/lib/utils/cn";

/**
 * Banda de impacto — journey.md §B step 2 / plan §5.3.
 *
 * Navy-budget zone (one of 3 permitted navy surfaces, per design-system.md
 * §1 — navy ≤15 % of total page surface). No CTA: credibility-only stop.
 *
 * Animation: per-card count-up from 0 → numeric target (800 ms cubic-out)
 * triggered when the card enters the viewport. `prefers-reduced-motion`
 * skips the count-up and snaps to the final value.
 */

type Stat = {
  /** Number to count up to, when a number can be parsed from the label. */
  value: number;
  /** Suffix appended to the animated number (e.g. "%", " horas"). */
  suffix: string;
  /** Optional negative-sign prefix. */
  prefix?: string;
  /** Right-hand part for ranges like "-20 % a -35 %" (rendered static). */
  trailing?: string;
  /** Descriptor line below the big number. */
  label: string;
};

const STATS: Stat[] = [
  {
    prefix: "-",
    value: 20,
    suffix: " %",
    trailing: " a -35 %",
    label: "Interacciones manuales del administrador",
  },
  {
    prefix: "+",
    value: 10,
    suffix: " %",
    trailing: " a +25 %",
    label: "Tracking de morosidad",
  },
  {
    value: 100,
    suffix: " %",
    label: "Trazabilidad auditable",
  },
];

export function ImpactBand() {
  return (
    <section
      id="impacto"
      aria-labelledby="impacto-heading"
      className="scroll-mt-24 bg-navy text-slate-50"
    >
      <div className="container py-xxl">
        <h2 id="impacto-heading" className="sr-only">
          Impacto medible
        </h2>
        <ul
          role="list"
          className="grid gap-xl sm:grid-cols-2 lg:grid-cols-3 lg:gap-xxl"
        >
          {STATS.map((stat, i) => (
            <StatCard key={i} stat={stat} index={i} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function StatCard({ stat, index }: { stat: Stat; index: number }) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLLIElement>(0.4);
  const animated = useCountUp(stat.value, inView, {
    durationMs: 1200,
    reduce: reduced,
  });
  // Step the start of each card slightly so they cascade visually.
  const delayMs = reduced ? 0 : index * 80;
  const display = Math.round(animated);

  return (
    <li
      ref={ref}
      className={cn(
        "flex flex-col gap-sm",
        "transition-opacity duration-base ease-out-brand motion-reduce:transition-none",
        inView ? "opacity-100" : "opacity-0",
      )}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      <p
        className="font-display text-[36px] leading-none tracking-tight text-white lg:text-[48px]"
        aria-label={`${stat.prefix ?? ""}${stat.value}${stat.suffix}${stat.trailing ?? ""}`}
      >
        <span aria-hidden="true">
          {stat.prefix}
          {display}
          {stat.suffix}
          {stat.trailing && (
            <span className="text-slate-200/80">{stat.trailing}</span>
          )}
        </span>
      </p>
      <p className="text-base leading-relaxed text-slate-200/90">{stat.label}</p>
    </li>
  );
}
