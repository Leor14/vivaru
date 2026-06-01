"use client";

import * as React from "react";
import {
  BadgeCheck,
  BarChart3,
  MessagesSquare,
  Target,
  type LucideIcon,
} from "lucide-react";
import { useInView, useReducedMotion } from "@/lib/marketing/hooks";
import { cn } from "@/lib/utils/cn";

/**
 * Solución — 4 pilares (journey.md §B step 4 / plan §5.5 / slide 7 corregido).
 *
 * Each pillar carries an explicit "PROBLEMA QUE RESUELVE" box: this is the
 * client feedback from the corrected slides — keeps the section from being
 * generic-feature-grid by anchoring every pillar to a pain it neutralizes.
 *
 * Hover anim: -4px lift + shadow-brand-lg, 200ms ease-out-brand, gated by
 * `prefers-reduced-motion`.
 */

type Pillar = {
  key: "finanzas" | "comunidad" | "operaciones" | "gobernanza";
  label: string;
  Icon: LucideIcon;
  accent: string;
  accentText: string;
  accentRing: string;
  problemBg: string;
  /** Explicit bg-* class for the bullet dot. Kept literal so Tailwind's JIT
   * keeps it in the bundle even if `accentText` is later refactored. */
  bulletDot: string;
  bullets: string[];
  problem: string;
};

const PILLARS: Pillar[] = [
  {
    key: "finanzas",
    label: "FINANZAS",
    Icon: BarChart3,
    accent: "bg-brand-blue/10",
    accentText: "text-brand-blue",
    accentRing: "ring-brand-blue/20",
    problemBg: "bg-brand-blue",
    bulletDot: "bg-brand-blue",
    bullets: [
      "Dashboard de cartera con KPIs",
      "Estados de cuenta por unidad",
      "Alertas de morosidad",
      "Comprobantes y conciliación",
      "Import/Export Excel y PDF",
    ],
    problem: "Cartera opaca, morosidad sin control y reportes tardíos.",
  },
  {
    key: "comunidad",
    label: "COMUNIDAD",
    Icon: MessagesSquare,
    accent: "bg-brand-purple-deep/10",
    accentText: "text-brand-purple-deep",
    accentRing: "ring-brand-purple-deep/20",
    problemBg: "bg-brand-purple-deep",
    bulletDot: "bg-brand-purple-deep",
    bullets: [
      "Comunicados con vigencia",
      "Estados de lectura",
      "Feed cronológico oficial",
      "Directorio de residentes",
      "Carga masiva y filtros",
    ],
    problem: "Comunicación fragmentada en WhatsApp, sin canal oficial.",
  },
  {
    key: "operaciones",
    label: "OPERACIONES",
    Icon: Target,
    accent: "bg-brand-teal/10",
    accentText: "text-brand-teal",
    accentRing: "ring-brand-teal/20",
    problemBg: "bg-brand-teal",
    bulletDot: "bg-brand-teal",
    bullets: [
      "PQRS con respuesta en 15 días",
      "Visitantes con QR",
      "Paquetería trazable",
      "Reservas con calendario",
      "Panel de portería dedicado",
    ],
    problem: "Solicitudes sin seguimiento, accesos sin registro.",
  },
  {
    key: "gobernanza",
    label: "GOBERNANZA",
    Icon: BadgeCheck,
    accent: "bg-brand-green/10",
    accentText: "text-brand-green",
    accentRing: "ring-brand-green/20",
    problemBg: "bg-brand-green",
    bulletDot: "bg-brand-green",
    bullets: [
      "3 perfiles de acceso",
      "Registro auditable",
      "Repositorio de documentos",
      "Identidad por conjunto",
      "Configuración multi-conjunto",
    ],
    problem: "Roles difusos, juntas sin datos, sin auditoría.",
  },
];

export function Solution() {
  return (
    <section
      id="solucion"
      aria-labelledby="solucion-heading"
      className="container scroll-mt-24 py-xxl"
    >
      <h2
        id="solucion-heading"
        className="max-w-3xl font-display text-h2 text-navy text-balance"
      >
        La plataforma completa, en cuatro dimensiones
      </h2>

      <ul
        role="list"
        className="mt-xl grid gap-lg sm:grid-cols-2 lg:grid-cols-4"
      >
        {PILLARS.map((p, i) => (
          <PillarCard key={p.key} pillar={p} index={i} />
        ))}
      </ul>
    </section>
  );
}

function PillarCard({ pillar, index }: { pillar: Pillar; index: number }) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLLIElement>(0.2);
  const { Icon } = pillar;
  const delayMs = reduced ? 0 : index * 80;

  return (
    <li
      ref={ref}
      className={cn(
        "group/pillar flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-brand-sm",
        "transition-all duration-base ease-out-brand motion-reduce:transition-none",
        "hover:-translate-y-1 hover:shadow-brand-lg motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-brand-sm",
        inView
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-2 motion-reduce:translate-y-0",
      )}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      <div className="flex flex-1 flex-col p-lg">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full ring-4",
            pillar.accent,
            pillar.accentRing,
          )}
        >
          <Icon className={cn("h-6 w-6", pillar.accentText)} aria-hidden="true" />
        </div>

        <p
          className={cn(
            "mt-md text-sm font-semibold uppercase tracking-[0.12em]",
            pillar.accentText,
          )}
        >
          {pillar.label}
        </p>

        <ul role="list" className="mt-md flex-1 space-y-2">
          {pillar.bullets.map((b) => (
            <li
              key={b}
              className="flex gap-2 text-sm leading-relaxed text-slate-600"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                  pillar.bulletDot,
                )}
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={cn("px-lg py-md text-white", pillar.problemBg)}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85">
          Problema que resuelve
        </p>
        <p className="mt-1 text-sm leading-snug">{pillar.problem}</p>
      </div>
    </li>
  );
}
