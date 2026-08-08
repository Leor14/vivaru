"use client";

import * as React from "react";
import { useInView, useReducedMotion } from "@/lib/marketing/hooks";

/**
 * El revelado al entrar en pantalla, en un solo sitio.
 *
 * Nació de medir el landing y encontrar dos cosas:
 *
 * **1. El mismo gesto se hacía con cuatro duraciones distintas** —250 ms, 400 ms,
 * 280 ms y algún valor suelto— y **tres desplazamientos** —16 px, 12 px y 4 px—.
 * Nadie lo decidió así: se fue copiando de sección en sección.
 *
 * **2. En tres secciones el escalonado no escalonaba nada.** Usaban
 *
 *     transitionDelay: reduced || inView ? "0ms" : `${delayMs}ms`
 *
 * que pone el retraso a cero **en el mismo commit** en que el elemento entra en
 * vista. Una transición usa los parámetros que están vigentes DESPUÉS del
 * cambio, así que el retraso efectivo era siempre 0. Medido en el navegador:
 * `transitionDelay: ["0s","0s","0s","0s"]` y las cuatro tarjetas subiendo a la
 * vez, frente a `["0s","0.08s","0.16s","0.24s"]` en las secciones que sí
 * funcionaban.
 *
 * Aquí el retraso se aplica siempre. Puede hacerlo porque `useInView` marca
 * «visto» una sola vez y deja de observar: no hay salida que escalonar.
 */

/** Separación entre elementos de una misma tanda. */
const PASO_MS = 60;

/**
 * Tope del escalonado.
 *
 * Sin tope, una rejilla de nueve tarjetas dejaría la última medio segundo por
 * detrás de la primera, y eso ya no se lee como elegancia sino como lentitud.
 */
const TOPE_MS = 240;

/**
 * Desplazamiento de entrada, **proporcional a la altura del propio elemento**.
 *
 * Un valor fijo falla por los dos lados: 16 px en una tarjeta de 400 px no se
 * percibe, y en una línea de texto es un brinco. El porcentaje resuelve el
 * primer caso y el tope en píxeles el segundo — que es la corrección que le
 * faltaba al `translateY(25%)` de la referencia.
 */
const DESPLAZAMIENTO = "min(22%, 28px)";

export type Revelado = {
  className: string;
  style: React.CSSProperties;
};

export function useRevelado<T extends Element = HTMLElement>(
  indice = 0,
  umbral = 0.12,
): { ref: React.MutableRefObject<T | null>; visible: boolean; revelado: Revelado } {
  const reducido = useReducedMotion();
  const [ref, visible] = useInView<T>(umbral);
  const retraso = reducido ? 0 : Math.min(indice * PASO_MS, TOPE_MS);

  return {
    ref,
    visible,
    revelado: {
      className: [
        "transition-[opacity,transform] duration-[420ms] ease-out-brand",
        "motion-reduce:transition-none",
        visible ? "opacity-100" : "opacity-0",
      ].join(" "),
      style: {
        // Solo `opacity` y `transform`: son las dos propiedades que el navegador
        // puede animar sin volver a calcular layout ni repintar.
        transform: visible ? "translateY(0)" : `translateY(${DESPLAZAMIENTO})`,
        transitionDelay: `${retraso}ms`,
      },
    },
  };
}
