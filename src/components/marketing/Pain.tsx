"use client";

import * as React from "react";
import Link from "next/link";
import {
  Cable,
  ClipboardX,
  FileSearch,
  MessageSquareOff,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/marketing/ui/button";
import { track } from "@/lib/marketing/analytics";
import { useRevelado } from "@/lib/marketing/revelado";
import { cn } from "@/lib/utils/cn";

/**
 * Dolor + lead-magnet promo — journey.md §B step 3 / plan §5.4.
 *
 * Microcopy is locked 1:1 to journey.md §D. Icon-to-pillar tint map
 * (per Sprint 2 brief — "color tenue del pilar correspondiente"):
 *   - Fragmentación digital → Finanzas (brand.blue)
 *   - Comunicación opaca   → Comunidad (brand.purple)
 *   - Portería sin tools   → Operaciones (brand.teal)
 *   - Gobernanza nula      → Gobernanza (brand.greenResident)
 */

type Pain = {
  Icon: LucideIcon;
  title: string;
  sub: string;
  iconBg: string;
  iconFg: string;
};

const PAINS: Pain[] = [
  {
    Icon: Cable,
    title: "Fragmentación digital",
    sub: "WhatsApp, Excel y libretas que nunca se sincronizan.",
    iconBg: "bg-brand-blue/10",
    iconFg: "text-brand-blue",
  },
  {
    Icon: MessageSquareOff,
    title: "Comunicación opaca",
    sub: "Los residentes se enteran tarde o no se enteran.",
    iconBg: "bg-brand-purple/10",
    iconFg: "text-brand-purple",
  },
  {
    Icon: ClipboardX,
    title: "Portería sin herramientas",
    sub: "Listas en papel, llamadas para autorizar visitas.",
    iconBg: "bg-brand-teal/10",
    iconFg: "text-brand-teal",
  },
  {
    Icon: ShieldAlert,
    title: "Gobernanza nula",
    sub: "Sin auditoría, sin evidencia para juntas.",
    iconBg: "bg-brand-green-resident/10",
    iconFg: "text-brand-green-resident",
  },
];

export function Pain() {
  return (
    <section
      id="dolor"
      aria-labelledby="dolor-heading"
      className="container scroll-mt-24 py-xxl"
    >
      <h2
        id="dolor-heading"
        className="font-display text-h2 text-navy text-balance"
      >
        ¿Cómo opera tu conjunto hoy?
      </h2>

      <ul
        role="list"
        className="mt-xl grid gap-lg sm:grid-cols-2"
      >
        {PAINS.map((p, i) => (
          <PainCard key={p.title} pain={p} index={i} />
        ))}
      </ul>

      <LeadMagnetPromo className="mt-xl" />
    </section>
  );
}

function PainCard({ pain, index }: { pain: Pain; index: number }) {
  const { ref, revelado } = useRevelado<HTMLLIElement>(index, 0.25);
  const { Icon } = pain;

  return (
    <li
      ref={ref}
      // Revelaba creciendo desde `scale-[0.95]`, no subiendo. Era el único gesto
      // de entrada distinto de la página, y unificarlo es el objeto del helper:
      // unas secciones que suben y otras que crecen se leen inconsistentes.
      className={cn(
        "flex gap-md rounded-xl border border-border bg-background p-lg shadow-brand-sm",
        revelado.className,
      )}
      style={revelado.style}
    >
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
          pain.iconBg,
        )}
      >
        <Icon className={cn("h-6 w-6", pain.iconFg)} aria-hidden="true" />
      </div>
      <div>
        <h3 className="font-display text-h3 text-slate-900">{pain.title}</h3>
        <p className="mt-sm text-sm leading-relaxed text-slate-600">
          {pain.sub}
        </p>
      </div>
    </li>
  );
}

export function LeadMagnetPromo({ className }: { className?: string }) {
  return (
    <aside
      aria-labelledby="lead-magnet-title"
      className={cn(
        "flex flex-col gap-lg rounded-2xl border border-brand-blue/30 bg-slate-50 p-lg shadow-brand-sm sm:flex-row sm:items-center sm:p-xl",
        className,
      )}
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-blue/10 sm:h-16 sm:w-16"
        aria-hidden="true"
      >
        <FileSearch className="h-7 w-7 text-brand-blue sm:h-8 sm:w-8" />
      </div>
      <div className="flex-1">
        <h3
          id="lead-magnet-title"
          className="font-display text-h3 text-slate-900"
        >
          Radiografía de tu conjunto
        </h3>
        <p className="mt-sm text-sm leading-relaxed text-slate-600">
          12 preguntas, 5 minutos y un reporte con lo que ya te funciona y lo
          que te está costando tiempo.
        </p>
      </div>
      <Button
        size="lg"
        variant="default"
        className="w-full shrink-0 sm:w-auto"
        render={
          <Link
            href="/diagnostico"
            onClick={() =>
              track("cta_secondary_click", { section: "pain_lead_magnet" })
            }
          />
        }
      >
        Hacer el diagnóstico
      </Button>
    </aside>
  );
}
