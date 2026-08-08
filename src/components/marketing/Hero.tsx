"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/marketing/ui/button";
import { DemoDialog } from "@/components/marketing/DemoDialog";
import { track } from "@/lib/marketing/analytics";
import { useInView, useReducedMotion } from "@/lib/marketing/hooks";
import { cn } from "@/lib/utils/cn";
import { Flecha } from "@/components/marketing/ui/flecha";
import { FondoHero } from "@/components/marketing/FondoHero";

/**
 * Hero — above-the-fold first surface (journey.md §B step 1, plan §5.2).
 *
 * Variant prop is pre-wired for the PostHog feature flag landing in
 * Sprint 7 (plan §13 Experiment 1). For now only `inst` is exposed; the
 * other two strings live here so QA can flip them via prop without code
 * spelunking once the flag lands.
 *
 * Telemetry:
 *   - `cta_primary_view` fires once when the primary CTA enters the viewport
 *     (IntersectionObserver, ≥50 %). Primary click event is owned by
 *     `<DemoDialog />`, secondary click event by the Diagnóstico link.
 */
export type HeroVariant = "inst" | "aggr" | "exec";

const H1_BY_VARIANT: Record<HeroVariant, string> = {
  inst: "Control residencial, vida más simple.",
  aggr: "Deja de administrar tu conjunto entre WhatsApp, Excel y cuadernos de portería.",
  exec: "La plataforma para operar comunidades residenciales con control, trazabilidad y orden.",
};

const SUB =
  "La plataforma para operar conjuntos, condominios y fraccionamientos con orden, trazabilidad y autoservicio.";
const TRUST =
  "Demo y Activación en menos de 72 horas · Soporte en español";

export interface HeroProps {
  variant?: HeroVariant;
}

export function Hero({ variant = "inst" }: HeroProps) {
  const reduced = useReducedMotion();
  const [ctaRef, ctaInView] = useInView<HTMLDivElement>(0.5);
  const fired = React.useRef(false);

  React.useEffect(() => {
    if (ctaInView && !fired.current) {
      fired.current = true;
      track("cta_primary_view");
    }
  }, [ctaInView]);

  // Stagger timings: H1 0ms, sub 80ms, CTA1 160ms, CTA2 240ms (last enters by 240ms).
  const fadeBase =
    "transition-[opacity,transform] duration-slow ease-out-brand motion-reduce:transition-none";
  const fadeIdle = "opacity-0 translate-y-3 motion-reduce:translate-y-0";
  const fadeIn = "opacity-100 translate-y-0";

  // Mount-time gate so the fade plays on first paint.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const shown = mounted || reduced;

  return (
    <section
      id="hero"
      className="relative scroll-mt-24"
      aria-labelledby="hero-h1"
    >
      {/*
        Fondo a sangre completa, y por eso la sección dejó de llevar `container`:
        ahora lo lleva el div del contenido. Si el ancho lo fijara la sección, el
        fondo se cortaría en 1280 px y dejaría dos franjas del color de la página
        a los lados. A sangre, además, la barra de navegación —que flota y es de
        cristal— tiene por debajo algo que mirar.

        El recorte vive DENTRO de FondoHero, nunca aquí. La captura del móvil
        cuelga a propósito por debajo del borde inferior de la sección
        (`-bottom-8`); un `overflow` en la sección la decapitaría.
      */}
      <FondoHero />

      <div className="container relative z-10 grid items-center gap-xl pt-xxl pb-xl lg:grid-cols-12 lg:gap-xxl lg:pb-xxl">
        <div className="lg:col-span-6">
          <h1
            id="hero-h1"
            className={cn(
              "font-display font-bold text-[52px] leading-[1.08] tracking-[-0.02em] text-navy text-balance lg:text-[72px] lg:leading-[1.05] lg:tracking-[-0.02em]",
              fadeBase,
              shown ? fadeIn : fadeIdle,
            )}
            style={{ transitionDelay: reduced ? "0ms" : "0ms" }}
          >
            {H1_BY_VARIANT[variant]}
          </h1>

          <p
            className={cn(
              // slate-700 y no slate-600. El fondo animado del hero obliga: el suelo de
              // luminancia que puede alcanzar el fondo bajo el texto depende del color
              // del subtitulo, y a 4,5:1 slate-600 lo deja en 0,574 mientras slate-700
              // lo baja a 0,406. Esos 0,17 son la diferencia entre un fondo que se ve
              // moverse y uno que se lee quieto. A 18 px sobre casi blanco, slate-600
              // ademas iba justo de peso. Ver la nota de FondoHero.tsx.
              "mt-lg max-w-xl text-lg leading-relaxed text-slate-700",
              fadeBase,
              shown ? fadeIn : fadeIdle,
            )}
            style={{ transitionDelay: reduced ? "0ms" : "80ms" }}
          >
            {SUB}
          </p>

          <div
            ref={ctaRef}
            className="mt-xl flex flex-col gap-sm sm:flex-row sm:items-center"
          >
            <div
              className={cn(fadeBase, shown ? fadeIn : fadeIdle)}
              style={{ transitionDelay: reduced ? "0ms" : "160ms" }}
            >
              {/* Self-service: el trial reemplaza a la demo como camino
                  principal; "Hablar con un asesor" queda como vía asistida
                  (ver docs/plan-self-service-trial.md §4). */}
              <Button
                size="xl"
                variant="default"
                className="w-full sm:w-auto"
                render={
                  <Link
                    href="/registro"
                    onClick={() => track("cta_primary_click", { section: "hero", cta: "trial" })}
                  />
                }
              >
                Prueba gratis 15 días <Flecha />
              </Button>
            </div>

            <div
              className={cn(fadeBase, shown ? fadeIn : fadeIdle)}
              style={{ transitionDelay: reduced ? "0ms" : "240ms" }}
            >
              <Button
                size="xl"
                variant="outline"
                className="w-full sm:w-auto"
                render={
                  <Link
                    href="/diagnostico"
                    onClick={() =>
                      track("cta_secondary_click", { section: "hero" })
                    }
                  />
                }
              >
                Diagnóstico gratuito
              </Button>
            </div>
          </div>

        </div>

        {/* Right-side product composite — desktop dashboard + phone overlay.
            HITL H7: product screenshot — see plan §10.B. */}
        <div className="relative lg:col-span-6">
          <ProductComposite />
        </div>
      </div>
    </section>
  );
}

function ProductComposite() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      {/* Dashboard Admin screenshot (1440×900 @2x). */}
      <Image
        src="/product/hero-admin-dashboard.webp"
        alt="Centro de control del administrador en Vivaru"
        width={1440}
        height={900}
        priority
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="w-full rounded-xl border border-slate-200 shadow-brand-md"
      />

      {/* Portal Residente mobile overlay (390×844 @3x). */}
      <div className="absolute -bottom-6 right-2 hidden w-[24%] min-w-[140px] max-w-[180px] overflow-hidden rounded-[28px] border border-slate-200 shadow-brand-lg sm:block lg:-bottom-8 lg:right-4 lg:w-[28%]">
        <Image
          src="/product/hero-resident-reservations.webp"
          alt="Portal del residente en Vivaru"
          width={390}
          height={844}
          sizes="180px"
          className="w-full h-auto"
        />
      </div>
    </div>
  );
}
