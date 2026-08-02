"use client";

import * as React from "react";
import Link from "next/link";
import { AssetSlot, type AssetDef } from "@/components/marketing/ui/asset-slot";
import { useInView, useReducedMotion } from "@/lib/marketing/hooks";
import { cn } from "@/lib/utils/cn";

/**
 * Tres propiedades del sistema, con su explicación y a dónde ir a verlas.
 *
 * Sustituye a la banda de porcentajes que había aquí («−20 % a −35 %» de
 * interacciones manuales, «+10 % a +25 %» de tracking de morosidad). Se
 * retiraron por una razón concreta: **no tenían fuente**. Con cero clientes no
 * hay de dónde sacarlas, y un prospecto que pregunte de dónde salen deja al
 * comercial sin respuesta. Una cifra que no se puede defender resta más
 * credibilidad de la que suma.
 *
 * Lo que las reemplaza sí se puede comprobar señalando el producto, y cada una
 * enlaza a la sección donde se ve. Ver `docs/plan-rediseno-landing.md`, D1.
 *
 * También sale del navy: la banda oscura pasa a ser una banda suave
 * (`bg-slate-50`, el tono que ya usan Perspectivas y Piloto).
 */

type Claim = {
  key: string;
  icon: AssetDef;
  title: string;
  body: string;
  href: string;
  linkLabel: string;
};

const CLAIMS: Claim[] = [
  {
    key: "aislamiento",
    icon: {
      alt: "Aislamiento",
      width: 100,
      height: 100,
      file: "/landing/claim-aislamiento.svg",
    },
    title: "Aislamiento por conjunto",
    body: "Cada conjunto opera como un sistema independiente. Ningún dato cruza de un edificio a otro, y lo impiden las reglas del servidor, no la interfaz.",
    href: "#multi-conjunto",
    linkLabel: "Cómo funciona",
  },
  {
    key: "trazabilidad",
    icon: {
      alt: "Trazabilidad",
      width: 100,
      height: 100,
      file: "/landing/claim-trazabilidad.svg",
    },
    title: "Trazabilidad auditable",
    body: "Las operaciones sensibles quedan registradas con autor y fecha. Un cobro se reversa, nunca se borra, así que la asamblea puede revisar qué pasó.",
    href: "#diferenciadores",
    linkLabel: "Ver la gobernanza",
  },
  {
    key: "portales",
    icon: {
      alt: "Portales",
      width: 100,
      height: 100,
      file: "/landing/claim-portales.svg",
    },
    title: "Cuatro portales, un dato",
    body: "Administración, residente, portería y comité ven la misma información con permisos distintos. Sin hojas de cálculo en paralelo que se contradicen.",
    href: "#perspectivas",
    linkLabel: "Ver los portales",
  },
];

export function ImpactBand() {
  return (
    <section
      id="impacto"
      aria-labelledby="impacto-heading"
      className="scroll-mt-24 bg-slate-50"
    >
      <div className="container py-xxl">
        {/* Deja de ser sr-only: antes la sección eran tres números sueltos que
            se explicaban solos. Tres afirmaciones necesitan encabezarse. */}
        <h2
          id="impacto-heading"
          className="max-w-3xl font-display text-h2 text-navy text-balance"
        >
          Tres cosas que puedes comprobar
        </h2>
        <p className="mt-sm max-w-2xl text-base leading-relaxed text-slate-600">
          No son promesas de ahorro: son propiedades del sistema, y cada una se
          ve en su sección.
        </p>

        <ul
          role="list"
          className="mt-xl grid gap-xl sm:grid-cols-2 lg:grid-cols-3 lg:gap-xxl"
        >
          {CLAIMS.map((claim, i) => (
            <ClaimCard key={claim.key} claim={claim} index={i} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function ClaimCard({ claim, index }: { claim: Claim; index: number }) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLLIElement>(0.3);
  // Se escalonan para que entren en cascada y no las tres de golpe.
  const delayMs = reduced ? 0 : index * 80;

  return (
    <li
      ref={ref}
      className={cn(
        "flex flex-col items-start gap-sm",
        "transition-opacity duration-base ease-out-brand motion-reduce:transition-none",
        inView ? "opacity-100" : "opacity-0",
      )}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      <AssetSlot
        asset={claim.icon}
        className="w-[76px] rounded-xl"
        sizes="76px"
        compact
      />
      <p className="font-display text-lg text-navy">{claim.title}</p>
      <p className="text-base leading-relaxed text-slate-600">{claim.body}</p>
      <Link
        href={claim.href}
        className="text-sm font-semibold text-brand-blue underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {claim.linkLabel}{" "}
        <span aria-hidden="true" className="ml-0.5">
          →
        </span>
      </Link>
    </li>
  );
}
