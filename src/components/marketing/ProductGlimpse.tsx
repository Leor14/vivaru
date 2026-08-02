"use client";

import * as React from "react";
import { AssetSlot } from "@/components/marketing/ui/asset-slot";
import { useInView, useReducedMotion } from "@/lib/marketing/hooks";
import { cn } from "@/lib/utils/cn";

/**
 * Vistazo al producto, justo después del hero.
 *
 * Toma la idea del panel que Cohere pone bajo su hero: enseñar la herramienta
 * funcionando antes de argumentar nada. Va antes de `Pain` a propósito —
 * primero se ve qué es, después por qué hace falta.
 *
 * **No repite el mensaje de `Pain`**, que ya habla de Excel, WhatsApp y
 * libretas. Aquí no se nombra el problema: se enseña un mes de cartera
 * resuelto, que es lo que el prospecto vino a ver.
 *
 * **Sin vídeo**, como el original: Cohere no tiene ni un `<video>` en todo su
 * sitio. Un `.webm` aquí costaría cientos de kilobytes en el punto más caro de
 * la página, y el mismo efecto se consigue con texto y CSS.
 */

const ACCIONES = [
  "Emitir la cuota de agosto",
  "Ver quién no ha pagado",
  "Mandar los recordatorios",
];

const ESTADOS = [
  { etiqueta: "Al día", valor: 31, color: "bg-brand-green-succ/10 text-brand-green-succ" },
  { etiqueta: "Pendiente", valor: 8, color: "bg-brand-amber/10 text-brand-amber" },
  { etiqueta: "Vencido", valor: 3, color: "bg-brand-red/10 text-brand-red" },
];

/**
 * Escribe y borra en bucle. Con `prefers-reduced-motion` no anima: deja la
 * primera frase fija, que dice lo mismo sin movimiento.
 */
function useTecleo(frases: string[], activo: boolean) {
  const reduced = useReducedMotion();
  const [texto, setTexto] = React.useState(frases[0]);

  React.useEffect(() => {
    if (reduced || !activo) {
      setTexto(frases[0]);
      return;
    }
    let i = 0;
    let n = 0;
    let borrando = false;
    let id: ReturnType<typeof setTimeout>;

    const paso = () => {
      const frase = frases[i];
      n += borrando ? -1 : 1;
      setTexto(frase.slice(0, n));

      let espera = borrando ? 28 : 58;
      if (!borrando && n === frase.length) {
        borrando = true;
        espera = 1700;
      } else if (borrando && n === 0) {
        borrando = false;
        i = (i + 1) % frases.length;
        espera = 320;
      }
      id = setTimeout(paso, espera);
    };

    id = setTimeout(paso, 600);
    return () => clearTimeout(id);
  }, [frases, reduced, activo]);

  return { texto, anima: !reduced && activo };
}

export function ProductGlimpse() {
  // El tecleo solo corre cuando la sección está a la vista: animar fuera de
  // pantalla gasta batería y no lo ve nadie.
  const [ref, inView] = useInView<HTMLDivElement>(0.25);
  const { texto, anima } = useTecleo(ACCIONES, inView);

  return (
    <section
      id="vistazo"
      aria-labelledby="vistazo-heading"
      className="container scroll-mt-24 py-xxl"
    >
      <h2
        id="vistazo-heading"
        className="max-w-3xl font-display text-h2 text-navy text-balance"
      >
        Un mes de cartera, en una pantalla
      </h2>
      <p className="mt-sm max-w-2xl text-base leading-relaxed text-slate-600">
        Emites la cuota, el sistema recuerda por ti y ves quién falta sin tener
        que preguntar.
      </p>

      <div
        ref={ref}
        className="mt-xl grid items-stretch gap-lg lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]"
      >
        {/* Consola: no es una captura, es la interfaz dibujada con CSS. Pesa
            nada y no se queda obsoleta cuando el producto cambia de tono. */}
        <div className="flex flex-col justify-center gap-lg rounded-2xl border border-border bg-background p-lg shadow-brand-sm sm:p-xl">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue/10 font-display text-lg text-brand-blue"
            >
              V
            </span>
            <span className="min-w-0">
              <span className="block font-display text-lg text-navy">
                Cartera · Torre A
              </span>
              <span className="block text-sm text-slate-500">
                42 unidades · agosto
              </span>
            </span>
          </div>

          <ul role="list" className="flex flex-wrap gap-2">
            {ESTADOS.map((e) => (
              <li
                key={e.etiqueta}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums",
                  e.color,
                )}
              >
                {e.etiqueta} {e.valor}
              </li>
            ))}
          </ul>

          <p className="flex min-h-[3.25rem] items-center rounded-xl bg-muted px-4 text-base text-slate-700">
            {/* `aria-live` no: para quien usa lector de pantalla esto es una
                ilustración, y anunciar cada letra sería ruido. El texto
                completo de las tres acciones vive abajo, fuera de la vista. */}
            <span aria-hidden="true">{texto}</span>
            {anima ? (
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-5 w-px animate-pulse bg-brand-blue"
              />
            ) : null}
            <span className="sr-only">{ACCIONES.join(". ")}.</span>
          </p>
        </div>

        <AssetSlot
          asset={{
            alt: "Administradora revisando la cartera del mes en su escritorio",
            width: 900,
            height: 900,
            file: "/landing/post-hero-admin.jpg",
          }}
          className="h-full w-full rounded-2xl object-cover"
          sizes="(max-width: 1024px) 100vw, 45vw"
        />
      </div>
    </section>
  );
}
