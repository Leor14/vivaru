"use client";

import * as React from "react";
import { AssetSlot, type AssetDef } from "@/components/marketing/ui/asset-slot";
import { useInView, useReducedMotion } from "@/lib/marketing/hooks";
import { cn } from "@/lib/utils/cn";

/**
 * 6 Diferenciadores — journey.md §B step 6 / plan §5.8 / slide 25.
 *
 * IMPORTANT: this section does NOT repeat Solución content. The 4 pillars
 * (Solución) are *features grouped by domain*; the 6 differentiators here
 * are *competitive reasons* — how we sell vs Residentify / Conjunto Feliz /
 * Excel. Tone is comparative, not descriptive.
 *
 * Tarjetas con foto y rejilla desigual, tomadas del carrusel de industrias de
 * Cohere. Con una diferencia: **allí las tarjetas solo enlazan, aquí revelan
 * el texto**. Sus etiquetas son nombres de sector y no hay nada que explicar;
 * las nuestras son argumentos y el argumento es el contenido.
 *
 * El título se ve siempre. La descripción aparece al pasar el cursor, al
 * enfocar con teclado o al tocar. **Nunca se quita del DOM**: se atenúa con
 * `opacity`, así que un lector de pantalla la anuncia aunque visualmente no
 * esté. Esconder texto de verdad detrás de un hover lo haría inaccesible en
 * cualquier dispositivo sin puntero.
 */

type Differentiator = {
  key: string;
  title: string;
  desc: string;
  photo: AssetDef;
  /** Colocación en la rejilla. Literal para que el JIT la recoja. */
  span: string;
};

const ITEMS: Differentiator[] = [
  {
    key: "aislados",
    title: "Cada conjunto, aislado",
    desc: "Casas o departamentos, cada conjunto funciona como un sistema independiente. Único en el mercado mexicano.",
    photo: {
      alt: "Conjunto de casas y torre de departamentos",
      width: 1200,
      height: 1200,
      src: "/landing/razon-aislados.jpg",
    },
    span: "lg:col-span-2 lg:row-span-2",
  },
  {
    key: "perfiles",
    title: "3 perfiles de acceso",
    desc: "Permisos granulares por rol. Cada quien ve solo lo que le corresponde.",
    photo: {
      alt: "Tres personas usando la plataforma en dispositivos distintos",
      width: 1200,
      height: 600,
      src: "/landing/razon-perfiles.jpg",
    },
    span: "lg:col-span-2",
  },
  {
    key: "ciclo",
    title: "Ciclo financiero completo",
    desc: "De la cuota a la conciliación: campañas de cobro, recordatorios automáticos, comprobantes en un clic y cierre de períodos.",
    photo: {
      alt: "Administradora revisando la cartera del mes",
      width: 800,
      height: 800,
      src: "/landing/razon-ciclo.jpg",
    },
    span: "",
  },
  {
    key: "pqrs",
    title: "PQRS con compromiso de tiempo",
    desc: "Código único, semáforo de 15 días y auditoría completa.",
    photo: {
      alt: "Residente levantando una solicitud desde el móvil",
      width: 800,
      height: 800,
      src: "/landing/razon-pqrs.jpg",
    },
    span: "",
  },
  {
    key: "porteria",
    title: "Portería digital",
    desc: "Un panel propio para el portero: valida visitas con QR, recibe paquetes y registra el turno. Fácil de usar.",
    photo: {
      alt: "Portero validando una visita con el escáner",
      width: 1200,
      height: 600,
      src: "/landing/razon-porteria.jpg",
    },
    span: "lg:col-span-2",
  },
  {
    key: "gobernanza",
    title: "Gobernanza total",
    desc: "Reporte de comité para asambleas, acuerdos firmados y auditoría de operaciones sensibles.",
    photo: {
      alt: "Reunión de comité revisando el reporte",
      width: 1200,
      height: 600,
      src: "/landing/razon-gobernanza.jpg",
    },
    span: "lg:col-span-2",
  },
];

export function Differentiators() {
  return (
    <section
      id="diferenciadores"
      aria-labelledby="diferenciadores-heading"
      className="container scroll-mt-24 py-xxl"
    >
      <h2
        id="diferenciadores-heading"
        className="max-w-3xl font-display text-h2 text-navy text-balance"
      >
        6 razones para elegir Vivaru
      </h2>
      <p className="mt-sm max-w-2xl text-base leading-relaxed text-slate-600">
        Pasa el cursor o toca cada una para ver el detalle.
      </p>

      {/*
        Rejilla desigual: seis cuadros iguales es justo lo que hace que una
        sección se lea como plantilla. En `lg` son cuatro columnas de 190px de
        alto, y los `span` de cada tarjeta las llenan sin dejar huecos:
        fila 1 → 2+2, fila 2 → (la grande continúa) 1+1, fila 3 → 2+2.
      */}
      <ul
        role="list"
        className="mt-xl grid gap-md sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[190px]"
      >
        {ITEMS.map((item, i) => (
          <DiffCard key={item.key} item={item} index={i} />
        ))}
      </ul>
    </section>
  );
}

function DiffCard({ item, index }: { item: Differentiator; index: number }) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLLIElement>(0.2);
  const [abierta, setAbierta] = React.useState(false);
  const delayMs = reduced ? 0 : index * 80;

  return (
    <li
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-2xl",
        // Sin `lg`, todas iguales: el alto fijo de fila solo aplica en la
        // rejilla ancha, así que en móvil y tablet mandan las proporciones.
        "aspect-[4/3] sm:aspect-square lg:aspect-auto",
        item.span,
        "transition-opacity duration-base ease-out-brand motion-reduce:transition-none",
        inView ? "opacity-100" : "opacity-0",
      )}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      <button
        type="button"
        // El toque abre y cierra; en escritorio el hover ya lo hace solo.
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        className={cn(
          "group absolute inset-0 block h-full w-full text-left",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        <AssetSlot
          asset={item.photo}
          className="absolute inset-0 h-full w-full rounded-none border-0 object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />

        {/* Velo: sube al revelar para que el texto largo siga legible. */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 bg-gradient-to-t from-navy-dark/85 via-navy-dark/35 to-transparent",
            "transition-opacity duration-base ease-out-brand motion-reduce:transition-none",
            "group-hover:opacity-100 group-focus-visible:opacity-100",
            abierta ? "opacity-100" : "opacity-90",
          )}
        />

        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-lg">
          <span className="font-display text-h4 text-white">{item.title}</span>
          <span
            className={cn(
              "text-sm leading-relaxed text-white/85",
              "transition-opacity duration-base ease-out-brand motion-reduce:transition-none",
              // Oculta de partida y revelada por cursor, foco de teclado o
              // toque. Los tres caminos escriben la MISMA clase sin variante:
              // un `opacity-100` dentro de un `@media` no puede ganarle a otro
              // fuera de él, así que el toque no hacía nada donde hay cursor.
              "opacity-0",
              "group-hover:opacity-100 group-focus-visible:opacity-100",
              abierta && "opacity-100",
            )}
          >
            {item.desc}
          </span>
        </span>
      </button>
    </li>
  );
}
