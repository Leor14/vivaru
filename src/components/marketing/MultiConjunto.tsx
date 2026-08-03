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
 * el concepto sin enseñar nada, y una etiqueta no se puede comprobar.
 *
 * Ahora es un recorrido grabado por seis módulos del producto. Dos capturas
 * quietas demostraban la marca por conjunto, pero no que esto sea un sistema
 * en marcha; el paseo sí, y el póster del vídeo sigue siendo el tablero con su
 * marca. En WebM y no GIF: un GIF de interfaz a este tamaño pesa varios megas
 * y sus 256 colores ensucian el texto pequeño.
 */

const BULLETS = [
  "Casas o departamentos: cada conjunto funciona aislado y sus datos, residentes y configuración no se mezclan.",
  // OJO: aquí decía «un administrador puede llevar varios conjuntos desde una
  // sola cuenta, sin cerrar sesión». Es falso. Los custom claims llevan UN
  // `tenantId` (todas las llamadas a `setCustomUserClaims` en
  // `functions/src/index.ts`), `auth-context.tsx` resuelve la membresía con
  // `limit(1)` y no existe ningún selector de conjunto en el producto. Hoy cada
  // conjunto es un acceso propio. Si algún día se construye el selector, es una
  // PRD de plataforma —toca claims, refresco de token y reglas—, no un cambio
  // de copy.
  "Si llevas varios conjuntos, cada uno tiene su propio espacio de trabajo y su propio acceso.",
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
 * Prueba visual: un recorrido grabado de 15 s por seis módulos —panel,
 * residentes y unidades, cartera, reservas, PQRS y comunicaciones—, con datos
 * reales de un conjunto de staging.
 *
 * Se graba con Playwright, no a mano: ver el bloque `Recorrido` en
 * `tests/capture-product-screenshots.spec.ts`, que además documenta por qué
 * hacen falta dos páginas del mismo contexto (la sesión de Firebase vive en
 * IndexedDB y `storageState()` no la hereda).
 *
 * Arranca solo, en bucle y sin sonido, con `preload="none"` para no cobrarle
 * 1,1 MB a quien nunca baja hasta aquí; el póster es el tablero con la marca
 * del conjunto, que es lo que sostiene el titular mientras el vídeo carga.
 */
function ConjuntoStack() {
  const [ref, inView] = useInView<HTMLDivElement>(0.25);

  return (
    <div
      ref={ref}
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200 shadow-brand-lg",
        "transition-[opacity,transform] duration-slow ease-out-brand motion-reduce:transition-none",
        inView
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0 motion-reduce:translate-y-0",
      )}
    >
      <AssetSlot
        asset={{
          alt: "Recorrido por Vivaru: panel de control, residentes y unidades, cartera, reservas, PQRS y comunicaciones",
          width: 1280,
          height: 800,
          kind: "video",
          src: "/product/multiconjunto-recorrido.webm",
          poster: "/product/multiconjunto-marca-b.webp",
        }}
        sizes="(max-width: 1024px) 100vw, 45vw"
        className="block w-full"
      />
    </div>
  );
}
