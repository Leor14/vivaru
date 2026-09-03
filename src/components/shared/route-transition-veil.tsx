"use client";

import { useEffect } from "react";

import { endRouteVeil, useRouteTransitionActive } from "@/features/onboarding/route-transition";

/** Tope de seguridad: si algo falla, el velo nunca deja la pantalla bloqueada. */
const MAX_VISIBLE_MS = 4000;

/**
 * El velo de marca que aparece entre un paso de la guía y su pantalla.
 *
 * Decisiones de movimiento (ver `route-transition.ts` para los tiempos):
 *
 * - El logo entra desde `scale(0.94)`, nunca desde `scale(0)`: nada en el mundo
 *   real aparece de la nada, y arrancar en cero se lee como un truco.
 * - Curva `--ease-out` del sistema: empieza rápido y frena, que es lo que hace
 *   que algo que entra se sienta inmediato. `ease-in` a la misma duración se
 *   percibe más lento porque retrasa justo el instante que el ojo vigila.
 * - Solo se anima `opacity` y `transform` —y el `filter` del fondo, que se
 *   aplica una vez—: son las propiedades que no disparan layout ni pintado.
 * - El arco que gira usa `linear`: es movimiento constante, y cualquier easing
 *   ahí produciría un tirón en cada vuelta.
 *
 * Con `prefers-reduced-motion` el velo ni siquiera se monta: la navegación es
 * directa (ver `useGuidedNavigation`). Aquí, además, se desactivan giro y
 * escala por si el ajuste cambia con el velo ya en pantalla.
 */
export function RouteTransitionVeil() {
  const active = useRouteTransitionActive();

  // Un velo que se queda pegado es peor que no tenerlo: bloquea la pantalla y
  // el usuario no tiene forma de salir. Pase lo que pase, se apaga.
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => endRouteVeil(), MAX_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="route-veil fixed inset-0 z-[70] grid place-items-center"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Abriendo la sección…</span>
      <div className="route-veil__mark relative grid h-28 w-28 place-items-center">
        <svg className="route-veil__ring absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke="var(--brand-200)"
            strokeWidth="2"
            opacity="0.5"
          />
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke="var(--brand-700)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="46 249"
          />
        </svg>
        {/* Disco sólido bajo el logo: sin él la marca se mezcla con el contenido
            difuminado de fondo y el logotipo se vuelve ilegible. */}
        <span className="grid h-[86px] w-[86px] place-items-center rounded-full bg-[var(--surface-strong)] shadow-[var(--sombra-media-6)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG local: next/image
              no optimiza SVG sin dangerouslyAllowSVG, y aquí no aporta nada. */}
          <img src="/brand/vivaru-logo.svg" alt="" className="h-14 w-14 object-contain" aria-hidden />
        </span>
      </div>
    </div>
  );
}
