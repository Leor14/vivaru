"use client";

import * as React from "react";
import { useReducedMotion } from "@/lib/marketing/hooks";
import { cn } from "@/lib/utils/cn";

/**
 * Cinta de módulos — plan de animaciones, inc E.
 *
 * El patrón es el de la tira de logos de Cohere, pero el contenido NO es
 * equivalente y conviene decirlo: un logo se reconoce de un vistazo y un nombre
 * hay que leerlo. Una marquesina de texto solo se justifica si el mensaje es
 * **amplitud**, y ahí Vivaru sí tiene algo que decir — dieciocho módulos, que en
 * lista estática serían un muro que nadie lee.
 *
 * Va DEBAJO de `Solution`, no encima: los cuatro pilares explican las áreas y
 * esto enseña lo que hay dentro. Al revés serían dieciocho nombres sin marco.
 *
 * Tres condiciones, y sin ellas la cinta es una molestia:
 *
 *  1. **Se detiene al pasar el puntero.** Algo que se mueve mientras intentas
 *     leerlo es exactamente lo que hace que la gente desvíe la vista.
 *  2. **Con `prefers-reduced-motion` no se mueve.** Y no basta con parar la
 *     animación: se cambia a una rejilla que envuelve, porque una cinta
 *     detenida a mitad de recorrido deja nombres cortados por el borde.
 *  3. **Los bordes se difuminan.** Sin la máscara, los nombres aparecen y
 *     desaparecen de golpe contra el borde, que se lee como un fallo.
 */

/** Tal como los nombra el producto en `admin-sidebar.tsx`. */
const MODULOS = [
  "Cartera",
  "Residentes y unidades",
  "Reservas",
  "Visitantes",
  "Paquetería",
  "PQRS",
  "Comunicaciones",
  "Encuestas",
  "Egresos",
  "Libro y fondos",
  "Conciliación",
  "Reporte de Comité",
  "Documentos",
  "Reglamento",
  "Servicios",
  "Usuarios",
];

function Tira({ oculta = false }: { oculta?: boolean }) {
  return (
    <ul
      role={oculta ? "presentation" : "list"}
      aria-hidden={oculta || undefined}
      className="flex shrink-0 items-center gap-lg px-lg"
    >
      {MODULOS.map((m) => (
        <li
          key={m}
          className="flex shrink-0 items-center gap-lg text-sm font-medium whitespace-nowrap text-slate-600"
        >
          {m}
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-slate-300" />
        </li>
      ))}
    </ul>
  );
}

export function MarquesinaModulos() {
  const reducido = useReducedMotion();

  return (
    <section
      aria-labelledby="modulos-heading"
      className="overflow-x-clip border-y border-border bg-slate-50 py-lg"
    >
      <h2 id="modulos-heading" className="sr-only">
        Módulos incluidos
      </h2>

      {reducido ? (
        // Sin movimiento: rejilla que envuelve. Una cinta parada a mitad de
        // recorrido cortaría nombres contra el borde.
        <ul role="list" className="container flex flex-wrap justify-center gap-x-lg gap-y-2">
          {MODULOS.map((m) => (
            <li key={m} className="text-sm font-medium text-slate-600">
              {m}
            </li>
          ))}
        </ul>
      ) : (
        <div
          className={cn(
            "group flex w-max",
            // La máscara difumina los dos extremos. `mask-image` no pasa por
            // layout: es composición, así que no cuesta fotogramas.
            "[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]",
          )}
        >
          <div className="flex animate-marquesina group-hover:[animation-play-state:paused]">
            <Tira />
            {/* La copia es lo que hace que el bucle no tenga costura: al llegar
                al -50 % queda exactamente donde empezó la primera. Va oculta
                para el lector de pantalla, que si no leería la lista dos veces. */}
            <Tira oculta />
          </div>
        </div>
      )}
    </section>
  );
}
