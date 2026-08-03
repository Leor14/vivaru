"use client";

import * as React from "react";
import Link from "next/link";
import { AssetSlot } from "@/components/marketing/ui/asset-slot";
import { Button } from "@/components/marketing/ui/button";
import { DemoDialog } from "@/components/marketing/DemoDialog";
import { track } from "@/lib/marketing/analytics";
import { useInView, useReducedMotion } from "@/lib/marketing/hooks";
import { cn } from "@/lib/utils/cn";

/**
 * Final CTA — plan §5.12 / journey.md §B step 10.
 *
 * Partido: el argumento a la izquierda, el producto a la derecha saliéndose
 * por el borde, como el pre-footer de Synthesia.
 *
 * **Deja de ser navy.** Era la tercera de las tres zonas oscuras que permitía
 * el design system, junto a ImpactBand y el pie. ImpactBand ya salió en el
 * incremento 3, y el pie sigue en navy, así que la página no se queda sin
 * ancla oscura: cierra con ella, igual que Synthesia. El degradado lavanda es
 * el del original, que es claro y no oscuro.
 *
 * Jerarquía de acciones, alineada con el resto de la página: el trial lidera,
 * la demo acompaña y el diagnóstico queda como enlace. Los tres eventos que ya
 * existían siguen disparándose con la misma forma — mover `cta_secondary_click`
 * a otra acción rompería la comparabilidad del histórico.
 *
 * Telemetry: `cta_primary_view` con { section: "final" } al entrar en pantalla,
 * distinto del evento del hero para poder comparar arriba contra abajo.
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
      className="relative overflow-x-clip bg-gradient-to-br from-brand-purple-deep/10 via-brand-blue/10 to-brand-blue-light/25"
    >
      {/* Bruma: dos halos suaves que derivan por la sección. Decoración pura.
          Bajan de opacidad respecto a la versión navy porque sobre fondo claro
          el mismo valor ensuciaba el degradado en vez de darle profundidad. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 opacity-40",
          "bg-[radial-gradient(circle_at_20%_20%,rgba(75,95,212,0.28),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(124,58,237,0.22),transparent_55%)]",
          "bg-[length:200%_200%]",
          reduced ? "" : "animate-drift-mesh",
        )}
      />

      <div className="relative container">
        <div className="grid items-center gap-xl py-3xl lg:grid-cols-[minmax(0,46%)_minmax(0,54%)] lg:gap-xxl">
          <div>
            <h2
              id="final-cta-heading"
              className="font-display text-hero-mobile md:text-hero text-navy text-balance"
            >
              ¿Listo para transformar tu conjunto?
            </h2>
            <p className="mt-md max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
              15 días con tu conjunto cargado y datos de ejemplo listos. Sin
              tarjeta y sin instalar nada.
            </p>

            <div className="mt-xl flex flex-col gap-sm sm:flex-row sm:items-center">
              <Button
                size="xl"
                className="px-xl"
                render={
                  <Link
                    href="/registro"
                    onClick={() =>
                      track("cta_primary_click", {
                        section: "final",
                        cta: "trial",
                      })
                    }
                  />
                }
              >
                Prueba gratis 15 días{" "}
                <span aria-hidden="true" className="ml-0.5">
                  →
                </span>
              </Button>

              <DemoDialog section="final">
                <Button type="button" size="xl" variant="outline">
                  Agenda una demo
                </Button>
              </DemoDialog>
            </div>

            <p className="mt-lg text-sm text-slate-600">
              ¿Prefieres empezar por un diagnóstico?{" "}
              <Link
                href="/diagnostico"
                onClick={() => track("cta_secondary_click", { section: "final" })}
                className="font-semibold text-brand-blue underline-offset-4 hover:underline"
              >
                Es gratuito
              </Link>
              .
            </p>
          </div>

          {/*
            Se sale por el borde derecho, como en el pre-footer de Synthesia.

            Aquí había declarado un vídeo de tres portales que nunca llegó a
            grabarse: el slot llevaba semanas rindiendo el placeholder de rayas
            al cierre de la página. Grabarlo tampoco era barato —en Firebase
            cada login sustituye al anterior, así que los tres portales caen en
            tres grabaciones distintas y unirlas pide ffmpeg—, y sobre todo ya
            no hacía falta: el recorrido en movimiento vive en «Cada conjunto,
            su propio sistema», ocho secciones más arriba. Un segundo vídeo
            reproduciéndose solo en la misma página compite con aquel y pesa
            más que el argumento que aporta.

            La foto es el comportamiento histórico de cartera de un conjunto
            REAL, no del ambiente de siembra: 87,3 % de recaudo, con la brecha
            a la vista. Es el argumento que cierra la página —esto es lo que
            vas a poder ver de tu conjunto— y con datos sembrados no existía:
            el ambiente de pruebas enseña «Recaudado $0» en todas partes.
            Recortada a la tarjeta; no hay ningún nombre de residente.
          */}
          <div className="lg:-mr-16 xl:-mr-32">
            <AssetSlot
              asset={{
                alt: "Comportamiento histórico de cartera: cobrado, recaudado, brecha y 87,3 % de recaudo",
                width: 1440,
                height: 550,
                src: "/product/pre-footer-cartera.webp",
              }}
              className="w-full rounded-2xl border border-white/60 shadow-brand-lg"
              sizes="(max-width: 1024px) 100vw, 54vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
