"use client";

import * as React from "react";
import {
  BarChart2,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileText,
  MessageSquare,
  Package,
  Receipt,
  Scale,
  ScrollText,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useReducedMotion } from "@/lib/marketing/hooks";
import { cn } from "@/lib/utils/cn";

/**
 * Cinta de módulos — plan de animaciones, inc E, rediseñada en H2.
 *
 * **Qué falló en la primera versión.** Eran dieciséis nombres en texto plano
 * separados por puntos. Funcionaba como mecanismo y no decía nada como diseño:
 * una tira de palabras grises que el ojo salta. El diagnóstico no era el
 * movimiento sino el material — se estaba tratando como texto algo que tenía
 * que leerse como un inventario.
 *
 * **Qué cambia.** Cada módulo es una pastilla con **el icono real que usa el
 * menú del producto** (`admin-sidebar.tsx`). No es decoración: es la misma
 * señal que verá dentro, así que la cinta deja de ser una lista y pasa a ser un
 * anticipo de la interfaz. Los iconos ya están en el bundle, así que no pesan.
 *
 * **Se probó una segunda cinta de fondo y se descartó.** La idea era dar
 * profundidad con una tira en sentido contrario, más lenta y translúcida. No
 * funciona aquí: las pastillas son opacas y llevan el MISMO texto, así que la
 * de atrás asoma por los huecos entre pastilla y pastilla y se lee como
 * contenido duplicado —fragmentos de palabras sueltos—, no como una capa. El
 * truco del paralaje pide que las dos capas sean distintas; con contenido
 * idéntico solo produce ruido.
 *
 * Se mantiene lo que ya funcionaba: se detiene con el puntero encima, los
 * bordes se difuminan, el contenido va duplicado para que el bucle no tenga
 * costura, y con `prefers-reduced-motion` no hay cinta sino rejilla.
 */

type Modulo = { nombre: string; Icon: LucideIcon };

/** Tal como los nombra y los ilustra el producto. */
const MODULOS: Modulo[] = [
  { nombre: "Cartera", Icon: Wallet },
  { nombre: "Residentes y unidades", Icon: Users },
  { nombre: "Reservas", Icon: CalendarCheck },
  { nombre: "Visitantes", Icon: Users },
  { nombre: "Paquetería", Icon: Package },
  { nombre: "PQRS", Icon: FileText },
  { nombre: "Comunicaciones", Icon: MessageSquare },
  { nombre: "Encuestas", Icon: ClipboardList },
  { nombre: "Egresos", Icon: Receipt },
  { nombre: "Libro y fondos", Icon: BookOpen },
  { nombre: "Conciliación", Icon: Scale },
  { nombre: "Reporte de Comité", Icon: BarChart2 },
  { nombre: "Servicios", Icon: Store },
  { nombre: "Reglamento", Icon: ScrollText },
];

function Pastilla({ m }: { m: Modulo }) {
  return (
    <li
      className={cn(
        "group/pastilla flex shrink-0 items-center gap-2 rounded-full",
        "border border-border bg-background px-4 py-2 shadow-brand-sm",
        "transition-[transform,border-color,box-shadow] duration-fast ease-out-brand",
        "[@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5",
        "[@media(hover:hover)_and_(pointer:fine)]:hover:border-brand-blue/40",
        "motion-reduce:transition-none",
      )}
    >
      <m.Icon
        aria-hidden="true"
        className={cn(
          "h-4 w-4 shrink-0 text-slate-400",
          "transition-colors duration-fast",
          "[@media(hover:hover)_and_(pointer:fine)]:group-hover/pastilla:text-brand-blue",
        )}
      />
      <span className="text-sm font-medium whitespace-nowrap text-slate-700">
        {m.nombre}
      </span>
    </li>
  );
}

function Tira({ oculta = false }: { oculta?: boolean }) {
  return (
    <ul
      role={oculta ? "presentation" : "list"}
      aria-hidden={oculta || undefined}
      className="flex shrink-0 items-center gap-3 px-1.5"
    >
      {MODULOS.map((m) => (
        <Pastilla key={m.nombre} m={m} />
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
        Módulos incluidos en el software de administración
      </h2>

      {reducido ? (
        // Sin movimiento: rejilla que envuelve. Una cinta parada a mitad de
        // recorrido cortaría pastillas contra el borde.
        <ul role="list" className="container flex flex-wrap justify-center gap-3">
          {MODULOS.map((m) => (
            <Pastilla key={m.nombre} m={m} />
          ))}
        </ul>
      ) : (
        <div
          className={cn(
            "group relative",
            // La máscara difumina los dos extremos. `mask-image` es composición:
            // no pasa por layout y no cuesta fotogramas.
            "[mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)]",
          )}
        >
          <div className="relative flex w-max">
            <div className="flex animate-marquesina group-hover:[animation-play-state:paused]">
              <Tira />
              {/* La copia es lo que quita la costura: al llegar al −50 % queda
                  donde empezó la primera. Oculta al lector de pantalla, que si
                  no leería los catorce módulos dos veces. */}
              <Tira oculta />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
