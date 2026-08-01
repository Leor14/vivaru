"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

/**
 * Transición corta al saltar de un paso de la guía a su pantalla.
 *
 * El problema que resuelve: la navegación del App Router es tan inmediata que
 * no se lee como navegación — el usuario pulsa y la pantalla ya es otra, sin
 * señal de que lo movieron de sitio. Una pausa breve y deliberada convierte el
 * salto en un desplazamiento comprensible.
 *
 * Los tiempos son a propósito cortos: **560 ms en total**. Una animación de UI
 * por encima de ~300 ms empieza a sentirse lenta, y aquí solo se sostiene
 * porque es infrecuente (unas 15 veces en toda la puesta en marcha) y porque
 * lleva información: "te estoy llevando a otro lado". Si el usuario recorriera
 * esto a diario, lo correcto sería no animar nada.
 *
 * `HOLD_MS` es el margen antes de empujar la ruta —suficiente para que el velo
 * aparezca sin que se perciba espera— y `SETTLE_MS` lo que el velo permanece
 * ya con la pantalla nueva detrás, para que no parpadee.
 */

const HOLD_MS = 300;
const SETTLE_MS = 260;

let active = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRouteTransitionActive(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => active,
    // En SSR nunca hay transición en curso.
    () => false,
  );
}

function setActive(next: boolean) {
  if (active === next) return;
  active = next;
  emit();
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Navega mostrando el velo de marca. Con `prefers-reduced-motion` navega
 * directo: quien pidió menos movimiento no quiere una pausa decorativa, y sin
 * la animación el velo solo sería una demora.
 */
export function useGuidedNavigation() {
  const router = useRouter();

  return useCallback(
    (href: string) => {
      if (prefersReducedMotion()) {
        router.push(href);
        return;
      }
      setActive(true);
      window.setTimeout(() => {
        router.push(href);
        window.setTimeout(() => setActive(false), SETTLE_MS);
      }, HOLD_MS);
    },
    [router],
  );
}
