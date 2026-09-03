"use client";

import { useEffect, useState } from "react";

import { ATRIBUTO } from "@/lib/ui/tema";

/**
 * Los colores de las graficas, leidos del tema EN EJECUCION.
 *
 * `PRD-V-FEAT-007`. Recharts pinta el color en atributos del SVG
 * (`stroke="#335f88"`), y ahi `var(--token)` NO vale: `var()` solo funciona en
 * declaraciones CSS, no en atributos de presentacion. Por eso un token no las
 * alcanza y en oscuro la linea y su rotulo se quedaban en 2,40:1.
 *
 * La salida es un hook y no una constante porque el tema cambia sin recargar:
 * hay que releer cuando el atributo de la raiz cambia.
 */
export type ColoresDeGrafica = Record<string, string>;

function leer(nombres: readonly string[]): ColoresDeGrafica {
  if (typeof window === "undefined") return {};
  const cs = getComputedStyle(document.documentElement);
  const salida: ColoresDeGrafica = {};
  for (const n of nombres) salida[n] = cs.getPropertyValue(`--${n}`).trim();
  return salida;
}

export function useColoresDeGrafica(nombres: readonly string[]): ColoresDeGrafica {
  const [colores, setColores] = useState<ColoresDeGrafica>(() => leer(nombres));

  useEffect(() => {
    setColores(leer(nombres));
    const obs = new MutationObserver(() => setColores(leer(nombres)));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: [ATRIBUTO] });
    return () => obs.disconnect();
    // `nombres` es una constante del modulo que lo llama; se compara por contenido.
  }, [nombres.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return colores;
}
