"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/marketing/ui/button";
import { DemoDialog } from "@/components/marketing/DemoDialog";
import { cn } from "@/lib/utils/cn";
import { track } from "@/lib/marketing/analytics";
import { useInView } from "@/lib/marketing/hooks";

/** Pricing — plan §5.9. */

type Tier = {
  key: "operacion" | "profesional" | "enterprise";
  name: string;
  minUnits: string;
  modules: string[];
  borderClass: string;
  badge?: { label: string; className: string };
};

const TIERS: Tier[] = [
  {
    key: "operacion",
    name: "Operación",
    minUnits: "Mínimo 50 unidades",
    modules: [
      "Comunidad",
      "Operaciones",
      "Visitantes con QR",
      "Paquetería",
      "Reservas",
    ],
    borderClass: "border-border",
  },
  {
    key: "profesional",
    name: "Profesional",
    minUnits: "Mínimo 50 unidades",
    modules: [
      "Todo en Operación",
      "Finanzas completas",
      "Dashboard de KPIs",
      "Reportes para asamblea",
    ],
    borderClass: "border-brand-blue ring-2 ring-brand-blue/20",
    // SWEET SPOT badge removido — el cliente no escoge plan por número de
    // unidades sino por lo que tiene que administrar; el incentivo visual
    // generaba ambigüedad comercial.
  },
  {
    key: "enterprise",
    name: "Enterprise",
    minUnits: "Mínimo 100 unidades",
    modules: [
      "Todos los módulos",
      "Gobernanza completa",
      "Multi-conjunto",
      "Branding por conjunto",
    ],
    borderClass: "border-navy ring-2 ring-navy/20",
  },
];

export function Pricing() {
  const [sectionRef, inView] = useInView<HTMLElement>(0.5);
  const fired = React.useRef(false);

  React.useEffect(() => {
    if (inView && !fired.current) {
      fired.current = true;
      track("pricing_view");
    }
  }, [inView]);

  return (
    <section
      ref={sectionRef}
      id="precios"
      aria-labelledby="precios-heading"
      className="container scroll-mt-24 py-xxl"
    >
      <h2
        id="precios-heading"
        className="max-w-3xl font-display text-h2 text-navy text-balance"
      >
        Tres planes diseñados para tu portafolio
      </h2>
      <p className="mt-md max-w-2xl text-base text-slate-600">
        El precio se ajusta al número de unidades y módulos activos. Solicita
        una cotización y te preparamos una propuesta a tu medida.
      </p>

      <ul
        role="list"
        className="mt-xl grid gap-lg lg:grid-cols-3"
      >
        {TIERS.map((tier) => (
          <TierCard key={tier.key} tier={tier} />
        ))}
      </ul>

      <div className="mt-xl flex justify-center">
        <DemoDialog section="pricing">
          <Button type="button" size="xl" className="px-xl">
            Solicita tu cotización
          </Button>
        </DemoDialog>
      </div>
    </section>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = React.useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      track("pricing_tier_hover", { tier: tier.key });
    }, 400);
  }, [tier.key]);

  const handleMouseLeave = React.useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  return (
    <li
      className={cn(
        "relative flex flex-col rounded-2xl border bg-background p-lg shadow-brand-sm",
        tier.borderClass,
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {tier.badge ? (
        <span
          className={cn(
            "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
            tier.badge.className,
          )}
        >
          {tier.badge.label}
        </span>
      ) : null}

      <h3 className="font-display text-h3 text-navy">{tier.name}</h3>
      <p className="mt-1 text-sm text-slate-500">{tier.minUnits}</p>

      <div className="mt-md">
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Cotización a medida
        </span>
      </div>

      <ul role="list" className="mt-md flex-1 space-y-2">
        {tier.modules.map((m) => (
          <li
            key={m}
            className="flex items-start gap-2 text-sm leading-relaxed text-slate-700"
          >
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-brand-green-succ"
              aria-hidden="true"
            />
            <span>{m}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}
