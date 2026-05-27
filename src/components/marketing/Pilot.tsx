import * as React from "react";
import { Button } from "@/components/marketing/ui/button";
import { DemoDialog } from "@/components/marketing/DemoDialog";
import { cn } from "@/lib/utils/cn";

/**
 * Piloto pagado — plan §5.10 / journey.md §B step 9.
 *
 * Two-column card (Estructura del piloto + 4 funciones estratégicas), then
 * a horizontal 4-step timeline below.
 *
 * HITL H4 (refund guarantee, "50% reembolso" row) is OMITTED while
 * unresolved. When commercial signs off, drop a row above "Acreditable".
 * HITL H5 (72h promise) is already covered by the trust microline in the
 * Topbar from Sprint 1 — we do NOT repeat it here.
 */

type StructRow = { label: string; value: string };

const STRUCTURE: StructRow[] = [
  { label: "Duración", value: "30 días con flujos reales" },
  { label: "Fee de activación", value: "$2,500 — $5,000 MXN" },
  { label: "Módulos", value: "1-2 workflows críticos del cliente" },
  // HITL H4: refund guarantee row pending — see plan §14
  { label: "Acreditable", value: "100% al primer trimestre" },
];

type Strategic = { num: string; title: string; desc: string };

const STRATEGIC: Strategic[] = [
  {
    num: "01",
    title: "Filtra leads no serios",
    desc: "Quien paga, participa.",
  },
  {
    num: "02",
    title: "Genera compromiso",
    desc: "Cliente activo desde el día 1.",
  },
  {
    num: "03",
    title: "Demuestra valor con datos",
    desc: "30 días con sus datos reales.",
  },
  {
    num: "04",
    title: "Elimina el riesgo percibido",
    desc: "100% acreditable al convertir.",
  },
];

const TIMELINE = [
  { n: "1", label: "Diagnóstico", range: "Sem 1-2" },
  { n: "2", label: "Configuración", range: "Sem 2-3" },
  { n: "3", label: "Piloto", range: "Sem 3-6" },
  { n: "4", label: "Go Live", range: "Sem 7+" },
];

export function Pilot() {
  return (
    <section
      id="piloto"
      aria-labelledby="piloto-heading"
      className="bg-slate-50 scroll-mt-24"
    >
      <div className="container py-xxl">
        <h2
          id="piloto-heading"
          className="max-w-3xl font-display text-h2 text-navy text-balance"
        >
          Tu primer mes con Vivaru
        </h2>

        <div className="mt-xl grid gap-lg lg:grid-cols-2">
          {/* Left: Estructura del piloto */}
          <div className="overflow-hidden rounded-2xl border-2 border-brand-blue bg-background shadow-brand-sm">
            <div className="bg-brand-blue px-lg py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
                Estructura del piloto
              </p>
            </div>
            <dl className="divide-y divide-border">
              {STRUCTURE.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[max-content_1fr] items-baseline gap-md px-lg py-md"
                >
                  <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                    {row.label}
                  </dt>
                  <dd className="text-sm leading-relaxed text-slate-800">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Right: 4 funciones estratégicas */}
          <ul role="list" className="grid gap-md sm:grid-cols-2">
            {STRATEGIC.map((s) => (
              <li
                key={s.num}
                className="rounded-2xl border border-border bg-background p-lg shadow-brand-sm"
              >
                <p
                  aria-hidden="true"
                  className="font-display text-4xl leading-none text-brand-blue"
                >
                  {s.num}
                </p>
                <h3 className="mt-sm font-display text-base font-semibold text-navy">
                  {s.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {s.desc}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Timeline */}
        <ol
          role="list"
          aria-label="Línea de tiempo del piloto"
          className="mt-xxl grid grid-cols-1 gap-md sm:grid-cols-4"
        >
          {TIMELINE.map((step, i) => (
            <li
              key={step.n}
              className="relative flex flex-col items-center text-center"
            >
              {/* connector line — hidden on mobile (stack), visible sm+ */}
              {i < TIMELINE.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-5 left-1/2 hidden h-0.5 w-full bg-brand-blue/30",
                    "sm:block",
                  )}
                />
              ) : null}
              <span
                aria-hidden="true"
                className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue font-display text-base font-semibold text-white shadow-brand-sm"
              >
                {step.n}
              </span>
              <p className="mt-sm font-display text-base font-semibold text-navy">
                {step.label}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">
                {step.range}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-xxl flex justify-center">
          <DemoDialog section="pilot">
            <Button type="button" size="xl" className="px-xl">
              Agenda una demo
            </Button>
          </DemoDialog>
        </div>
      </div>
    </section>
  );
}
