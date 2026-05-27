"use client";

import * as React from "react";
import {
  Boxes,
  CircleDollarSign,
  Clock,
  FileCheck,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useInView, useReducedMotion } from "@/lib/marketing/hooks";
import { cn } from "@/lib/utils/cn";

/**
 * 6 Diferenciadores — journey.md §B step 6 / plan §5.8 / slide 25.
 *
 * IMPORTANT: this section does NOT repeat Solución content. The 4 pillars
 * (Solución) are *features grouped by domain*; the 6 differentiators here
 * are *competitive reasons* — how we sell vs Residentify / Conjunto Feliz /
 * Excel. Tone is comparative, not descriptive.
 *
 * Hover: subtle scale 1.02 (no lift). Stagger fade-in on viewport entry,
 * 80ms per card, gated by prefers-reduced-motion.
 */

type Differentiator = {
  key: string;
  Icon: LucideIcon;
  title: string;
  desc: string;
  /** Tailwind classes. Kept literal so the JIT picks them up. */
  iconBg: string;
  iconRing: string;
  iconFg: string;
};

const ITEMS: Differentiator[] = [
  {
    key: "aislados",
    Icon: Boxes,
    title: "Edificios aislados",
    desc: "Cada conjunto funciona como un sistema independiente. Único en el mercado mexicano.",
    iconBg: "bg-brand-blue/10",
    iconRing: "ring-brand-blue/20",
    iconFg: "text-brand-blue",
  },
  {
    key: "perfiles",
    Icon: Users,
    title: "3 perfiles de acceso",
    desc: "Permisos granulares por rol. Cada quien ve solo lo que le corresponde.",
    iconBg: "bg-brand-purpleDeep/10",
    iconRing: "ring-brand-purpleDeep/20",
    iconFg: "text-brand-purpleDeep",
  },
  {
    key: "ciclo",
    Icon: CircleDollarSign,
    title: "Ciclo financiero completo",
    desc: "Desde la cuota hasta la reconciliación, con KPIs en tiempo real.",
    iconBg: "bg-brand-teal/10",
    iconRing: "ring-brand-teal/20",
    iconFg: "text-brand-teal",
  },
  {
    key: "pqrs",
    Icon: Clock,
    title: "PQRS con compromiso de tiempo",
    desc: "Código único, semáforo de 15 días y auditoría completa.",
    iconBg: "bg-brand-greenSucc/10",
    iconRing: "ring-brand-greenSucc/20",
    iconFg: "text-brand-greenSucc",
  },
  {
    key: "porteria",
    Icon: Shield,
    title: "Portería digital",
    desc: "Panel dedicado con 4 funciones. Diseñado para no-técnicos.",
    iconBg: "bg-brand-amber/10",
    iconRing: "ring-brand-amber/20",
    iconFg: "text-brand-amber",
  },
  {
    key: "gobernanza",
    Icon: FileCheck,
    title: "Gobernanza total",
    desc: "Auditoría de operaciones sensibles. Evidencia para juntas.",
    iconBg: "bg-brand-red/10",
    iconRing: "ring-brand-red/20",
    iconFg: "text-brand-red",
  },
];

export function Differentiators() {
  return (
    <section
      id="diferenciadores"
      aria-labelledby="diferenciadores-heading"
      className="container scroll-mt-24 py-xxl"
    >
      <h2
        id="diferenciadores-heading"
        className="max-w-3xl font-display text-h2 text-navy text-balance"
      >
        6 razones para elegir Vivaru
      </h2>

      <ul
        role="list"
        className="mt-xl grid gap-md sm:grid-cols-2 lg:grid-cols-3"
      >
        {ITEMS.map((item, i) => (
          <DiffCard key={item.key} item={item} index={i} />
        ))}
      </ul>
    </section>
  );
}

function DiffCard({ item, index }: { item: Differentiator; index: number }) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLLIElement>(0.2);
  const { Icon } = item;
  const delayMs = reduced ? 0 : index * 80;

  return (
    <li
      ref={ref}
      className={cn(
        "rounded-2xl border border-border bg-background p-lg shadow-brand-sm",
        "transition-all duration-base ease-out-brand motion-reduce:transition-none",
        "hover:scale-[1.02] hover:shadow-brand-md motion-reduce:hover:scale-100",
        inView
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-2 motion-reduce:translate-y-0",
      )}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full ring-4",
          item.iconBg,
          item.iconRing,
        )}
      >
        <Icon className={cn("h-6 w-6", item.iconFg)} aria-hidden="true" />
      </div>
      <h3 className="mt-md font-display text-h4 text-navy">{item.title}</h3>
      <p className="mt-sm text-sm leading-relaxed text-slate-600">
        {item.desc}
      </p>
    </li>
  );
}
