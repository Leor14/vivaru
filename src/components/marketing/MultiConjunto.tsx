"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { useInView, useReducedMotion } from "@/lib/marketing/hooks";
import { cn } from "@/lib/utils/cn";

/**
 * Multi-conjunto — plan §5.7 / slide 6 corregido.
 *
 * Split layout: copy + bullets on the left, three "demo conjunto" cards
 * stacked over a navy gradient on the right. Each card slides in from the
 * right when the section enters the viewport; stagger 100 ms, skipped on
 * `prefers-reduced-motion`.
 */

type Conjunto = {
  name: string;
  units: string;
  accent: string;
  ring: string;
};

const CONJUNTOS: Conjunto[] = [
  {
    name: "Santa María",
    units: "120 unidades",
    accent: "text-brand-blue",
    ring: "ring-brand-blue/40",
  },
  {
    name: "Las Bromelias",
    units: "85 unidades",
    accent: "text-brand-purple",
    ring: "ring-brand-purple/40",
  },
  {
    name: "Los Pinos",
    units: "210 unidades",
    accent: "text-brand-teal",
    ring: "ring-brand-teal/40",
  },
];

const BULLETS = [
  "Cada conjunto funciona aislado: sus datos, residentes y configuración no se mezclan.",
  "Un administrador puede gestionar varios conjuntos desde una sola cuenta.",
  "Identidad propia por conjunto: nombre, logo y colores personalizados.",
  "Único en el mercado mexicano con este nivel de aislamiento.",
];

export function MultiConjunto() {
  return (
    <section
      id="multi-conjunto"
      aria-labelledby="multi-heading"
      className="container scroll-mt-24 py-xxl"
    >
      <div className="grid items-center gap-xl lg:grid-cols-2 lg:gap-xxl">
        <div>
          <h2
            id="multi-heading"
            className="font-display text-h2 text-navy text-balance"
          >
            Cada conjunto, su propio sistema.
          </h2>
          <ul role="list" className="mt-lg space-y-3">
            {BULLETS.map((b) => (
              <li
                key={b}
                className="flex gap-2 text-base leading-relaxed text-slate-600"
              >
                <span
                  aria-hidden="true"
                  className="mt-2.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue"
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <ConjuntoStack />
      </div>
    </section>
  );
}

function ConjuntoStack() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.25);

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-navy-dark p-lg shadow-brand-lg sm:p-xl"
    >
      <ul role="list" className="space-y-md">
        {CONJUNTOS.map((c, i) => {
          const delayMs = reduced ? 0 : i * 100;
          return (
            <li
              key={c.name}
              className={cn(
                "flex items-center gap-md rounded-xl bg-white/95 p-md shadow-brand-sm ring-1",
                c.ring,
                "transition-all duration-slow ease-out-brand motion-reduce:transition-none",
                inView
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-6 motion-reduce:translate-x-0",
              )}
              style={{ transitionDelay: `${delayMs}ms` }}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100",
                  c.accent,
                )}
                aria-hidden="true"
              >
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-slate-900">
                  {c.name}
                </p>
                <p className="text-sm text-slate-600">{c.units}</p>
              </div>
              <span
                className={cn(
                  "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                  c.accent,
                )}
              >
                Aislado
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
