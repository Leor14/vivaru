"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/marketing/ui/button";
import { DemoDialog } from "@/components/marketing/DemoDialog";
import { track } from "@/lib/marketing/analytics";
import { useInView, useReducedMotion } from "@/lib/marketing/hooks";
import { cn } from "@/lib/utils/cn";

/**
 * Final CTA — plan §5.12 / journey.md §B step 10.
 *
 * Third (and last) navy zone allowed by design-system §1 — together with
 * the ImpactBand and the Footer, exhausts the 15% surface budget.
 *
 * Background: gradient navy → navy-dark with a subtle drift mesh
 * (two radial gradients overlaid, animated via background-position).
 * Animation gated by prefers-reduced-motion (no drift when reduced).
 *
 * Telemetry: fires `cta_primary_view` with { section: "final" } when the
 * section enters the viewport — distinct from the Hero view event so the
 * funnel can compare top-of-page vs bottom-of-page conversion.
 */
export function FinalCTA() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLElement>(0.35);
  const fired = React.useRef(false);

  React.useEffect(() => {
    if (inView && !fired.current) {
      fired.current = true;
      track("cta_primary_view", { section: "final" });
    }
  }, [inView]);

  return (
    <section
      ref={ref}
      id="final-cta"
      aria-labelledby="final-cta-heading"
      className="relative overflow-hidden bg-gradient-to-br from-navy via-navy to-navy-dark text-white"
    >
      {/* Drift mesh — two soft radial highlights that drift across the
          section. Pure decoration, aria-hidden. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 opacity-70",
          "bg-[radial-gradient(circle_at_20%_20%,rgba(75,95,212,0.35),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(124,58,237,0.30),transparent_55%)]",
          "bg-[length:200%_200%]",
          reduced ? "" : "animate-drift-mesh",
        )}
      />

      <div className="relative container py-3xl text-center">
        <h2
          id="final-cta-heading"
          className="mx-auto max-w-3xl font-display text-hero-mobile md:text-hero text-white text-balance"
        >
          ¿Listo para transformar tu conjunto?
        </h2>
        <p className="mx-auto mt-md max-w-xl text-base leading-relaxed text-slate-200/85 md:text-lg">
          Menos WhatsApp. Menos Excel. Más control residencial.
        </p>

        <div className="mt-xl flex flex-col items-center justify-center gap-sm sm:flex-row">
          <DemoDialog section="final">
            <Button type="button" size="xl" className="px-xl">
              Agenda una demo{" "}
              <span aria-hidden="true" className="ml-0.5">
                →
              </span>
            </Button>
          </DemoDialog>
          <Button
            type="button"
            size="xl"
            variant="outline"
            onClick={() =>
              track("cta_secondary_click", { section: "final" })
            }
            className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
            render={<Link href="/diagnostico" />}
          >
            Diagnóstico gratuito
          </Button>
        </div>

        <p className="mt-lg text-xs text-slate-200/70">
          Respuesta del equipo comercial en menos de 24 horas hábiles.
        </p>
      </div>
    </section>
  );
}
