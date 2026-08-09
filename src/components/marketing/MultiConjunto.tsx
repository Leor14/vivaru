"use client";

import * as React from "react";
import { AssetSlot } from "@/components/marketing/ui/asset-slot";
import { useRevelado } from "@/lib/marketing/revelado";
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
  // Aquí decía «Único en el mercado mexicano con este nivel de aislamiento».
  // Dos problemas en una frase: acotaba el diferenciador a un país en una
  // página que vende a toda la región, y «único en el mercado» es un
  // superlativo sin estudio detrás — la misma razón por la que se retiraron
  // los porcentajes del ImpactBand. Lo sustituye algo que sí se puede
  // enseñar señalando el producto.
  "El aislamiento lo imponen las reglas del sistema, no una configuración que se pueda cambiar por error.",
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
            Varios condominios, cada uno con su propio sistema
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
 * Prueba visual: un recorrido grabado de 20 s por cinco módulos —panel,
 * residentes y unidades, cartera, reservas y comunicaciones— con los datos de
 * un conjunto de producción.
 *
 * Se graba con `scripts/capturar-produccion-admin.mjs`, que documenta las
 * trampas: dos páginas del mismo contexto (la sesión de Firebase vive en
 * IndexedDB), `video.saveAs()` y no copiar el archivo a mano, y la espera a que
 * no queden esqueletos en pantalla.
 *
 * **Se navega pulsando el menú, no recargando por URL.** Con `goto` cada salto
 * era un recargue completo y el vídeo llevaba fotogramas en blanco entre módulo
 * y módulo; pulsando el menú la navegación es del lado del cliente y el paso es
 * continuo, que es lo único que esta sección tiene que demostrar.
 *
 * PQRS queda fuera: su listado son ocho filas con la etiqueta roja «Vencido».
 *
 * Arranca solo, en bucle y sin sonido, con `preload="none"` para no cobrarle
 * 1,3 MB a quien nunca baja hasta aquí; el póster es el tablero con la marca
 * del conjunto, que es lo que sostiene el titular mientras el vídeo carga.
 */
function ConjuntoStack() {
  const { ref, revelado } = useRevelado<HTMLDivElement>(0, 0.25);

  return (
    <div
      ref={ref}
      className={cn(
        // `overflow-clip` y no `hidden`: `hidden` crea un contenedor de
        // desplazamiento y `animation-timeline: view()` resolvería contra él,
        // que nunca se desplaza. Misma trampa que el sticky del header.
        "desvelar overflow-clip rounded-2xl border border-slate-200 shadow-brand-lg",
        revelado.className,
      )}
      style={revelado.style}
    >
      <AssetSlot
        asset={{
          alt: "Recorrido por Vivaru: panel de control, residentes y unidades, cartera, reservas y comunicaciones",
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
