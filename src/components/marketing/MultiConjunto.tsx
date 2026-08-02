"use client";

import * as React from "react";
import { AssetSlot } from "@/components/marketing/ui/asset-slot";
import { useInView } from "@/lib/marketing/hooks";
import { cn } from "@/lib/utils/cn";

/**
 * Multi-conjunto — plan §5.7 / slide 6 corregido.
 *
 * Copy a la izquierda, prueba visual a la derecha.
 *
 * La prueba era un dibujo: tres tarjetas con la etiqueta «AISLADO». Ilustraba
 * el concepto sin enseñar nada, y una etiqueta no se puede comprobar. Ahora
 * son capturas del producto: el selector de conjunto, y el MISMO tablero con
 * la marca de dos conjuntos distintos — que es lo que `tenantSettings` hace
 * de verdad.
 */

const BULLETS = [
  "Casas o departamentos: cada conjunto funciona aislado y sus datos, residentes y configuración no se mezclan.",
  "Un administrador puede llevar varios conjuntos desde una sola cuenta, sin cerrar sesión.",
  "Identidad propia por conjunto: nombre, logo y colores personalizados.",
  "Único en el mercado mexicano con este nivel de aislamiento.",
];

export function MultiConjunto() {
  return (
    <section
      id="multi-conjunto"
      aria-labelledby="multi-heading"
      className="container scroll-mt-24 py-xxl"
    >
      <div className="grid items-center gap-xl lg:grid-cols-2 lg:gap-xxl">
        <div>
          <h2
            id="multi-heading"
            className="font-display text-h2 text-navy text-balance"
          >
            Cada conjunto, su propio sistema
          </h2>
          <ul role="list" className="mt-lg space-y-3">
            {BULLETS.map((b) => (
              <li
                key={b}
                className="flex gap-2 text-base leading-relaxed text-slate-600"
              >
                <span
                  aria-hidden="true"
                  className="mt-2.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue"
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <ConjuntoStack />
      </div>
    </section>
  );
}

/**
 * Prueba visual del aislamiento: el selector de conjunto del producto, y dos
 * capturas del MISMO tablero con la marca de dos conjuntos distintos.
 *
 * Antes había aquí tres tarjetas dibujadas con la etiqueta «AISLADO». Ilustraba
 * el concepto sin enseñar nada: el prospecto no puede comprobar una etiqueta.
 * Que la misma pantalla aparezca con dos logos y dos colores sí se comprueba,
 * y además es lo que `tenantSettings` hace de verdad (branding por conjunto).
 */
function ConjuntoStack() {
  const [ref, inView] = useInView<HTMLDivElement>(0.25);

  return (
    <div
      ref={ref}
      className={cn(
        "relative",
        "transition-[opacity,transform] duration-slow ease-out-brand motion-reduce:transition-none",
        inView
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 motion-reduce:translate-y-0",
      )}
    >
      <AssetSlot
        asset={{
          alt: "Selector de conjunto: pasar de Santa María a Las Bromelias sin cerrar sesión",
          width: 1440,
          height: 900,
          file: "/product/multiconjunto-selector.png",
        }}
        sizes="(max-width: 1024px) 100vw, 45vw"
        className="w-full rounded-2xl border border-slate-200 shadow-brand-md"
      />

      {/* Las dos marcas, una sobre otra, para que la diferencia se lea de un
          vistazo sin tener que comparar dos imágenes separadas. */}
      <div className="mt-md grid grid-cols-2 gap-md">
        <AssetSlot
          asset={{
            alt: "El tablero con la marca de Santa María",
            width: 800,
            height: 600,
            file: "/product/multiconjunto-marca-a.png",
          }}
          sizes="(max-width: 1024px) 50vw, 22vw"
          className="w-full rounded-xl border border-slate-200 shadow-brand-sm"
        />
        <AssetSlot
          asset={{
            alt: "El mismo tablero con la marca de Las Bromelias",
            width: 800,
            height: 600,
            file: "/product/multiconjunto-marca-b.png",
          }}
          sizes="(max-width: 1024px) 50vw, 22vw"
          className="w-full rounded-xl border border-slate-200 shadow-brand-sm"
        />
      </div>
    </div>
  );
}
