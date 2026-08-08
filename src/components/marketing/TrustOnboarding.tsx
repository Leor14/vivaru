"use client";

import * as React from "react";
import { AssetSlot, type AssetDef } from "@/components/marketing/ui/asset-slot";
import { useRevelado } from "@/lib/marketing/revelado";
import { cn } from "@/lib/utils/cn";

/**
 * Migración + Confianza — manejo de objeción antes del precio (blueprint §3.9).
 *
 * Resuelve las dos objeciones que frenan la venta B2B cuando se maneja dinero y
 * datos: «cambiar es un dolor» y «¿está seguro?».
 *
 * La anatomía viene de las tarjetas de noticias de Cohere: miniatura 16:9
 * arriba, etiqueta de categoría, título y cuerpo. Sustituye al icono sobre
 * fondo tintado, y a la caja con borde y sombra que envolvía cada tarjeta.
 *
 * **Sin pie con flecha, a diferencia del original.** Las de Cohere son
 * artículos y el pie lleva a leerlos; estas son garantías, y tres de las
 * cuatro no tienen a dónde llevar. Un «Ver cómo →» que no va a ninguna parte
 * es peor que no ponerlo. Ver `docs/plan-rediseno-landing.md`, inc 4.
 */

type Item = {
  key: string;
  /**
   * Lo que va en la muesca del pie.
   *
   * En la referencia ahí hay un «Read more →» porque cada tarjeta es un
   * artículo. Tres de estas cuatro NO llevan a ninguna parte —está decidido y
   * documentado arriba—, y una flecha que no va a ningún sitio es peor que no
   * ponerla. Va un dato, que llena la muesca y además aporta.
   */
  pie: string;
  /** Categoría, para poder escanear las cuatro sin leerlas enteras. */
  meta: string;
  /** Clase del tinte. Literal para que el JIT la recoja. */
  metaColor: string;
  title: string;
  body: string;
  shot: AssetDef;
};

const ITEMS: Item[] = [
  {
    key: "migracion",
    pie: "Día 1",
    meta: "Activación",
    metaColor: "text-brand-teal",
    title: "Migra tu cartera en pocas horas",
    body: "Importa unidades, residentes y la cartera con la que llega tu conjunto desde Excel. Operas el día 1 con tu realidad, no desde cero.",
    shot: {
      alt: "Importación de unidades y residentes desde Excel",
      width: 1280,
      height: 720,
      src: "/product/trust-migracion.webp",
    },
  },
  {
    key: "acceso",
    pie: "Enlace de un solo uso",
    meta: "Seguridad",
    metaColor: "text-brand-green-succ",
    title: "Acceso seguro por enlace",
    body: "Cada usuario activa su cuenta y restablece su contraseña desde un enlace seguro. Sin claves compartidas.",
    shot: {
      // La pantalla de activación vive detrás de un enlace de un solo uso y no
      // se puede fotografiar sin generar una invitación real; esta es la de
      // recuperación, que demuestra lo mismo y dice en pantalla que el enlace
      // caduca. Ver el test «acuse de enlace de acceso».
      alt: "Acuse del envío del enlace de acceso: el enlace caduca por seguridad",
      width: 1056,
      height: 594,
      src: "/product/trust-acceso.webp",
    },
  },
  {
    key: "respaldos",
    pie: "Cada 24 horas",
    meta: "Resguardo",
    metaColor: "text-brand-amber",
    title: "Respaldos diarios y auditoría",
    body: "Copias de seguridad automáticas cada día y registro auditable de las operaciones sensibles. Tu información, protegida.",
    shot: {
      // La pantalla es «Libro y fondos». Antes esto apuntaba a Ajustes, que
      // enseñaba selectores de color: nada que ver con auditar. El libro sí,
      // porque sus asientos no se borran —anular crea un asiento inverso y el
      // original queda visible— y cada línea dice de dónde salió.
      alt: "Libro de ingresos y egresos: cada movimiento con su fecha, concepto, monto y origen",
      width: 1280,
      height: 720,
      src: "/product/trust-respaldos.webp",
    },
  },
  {
    key: "soporte",
    pie: "En español",
    meta: "Acompañamiento",
    metaColor: "text-brand-purple-deep",
    title: "Soporte en español",
    body: "Acompañamiento en tu idioma durante la activación y en el día a día.",
    shot: {
      // Es el formulario, no una conversación: la lista de solicitudes enseñaba
      // una titulada «Problema con el login de residentes», y eso en una página
      // que promete acceso seguro juega en contra.
      alt: "Formulario para abrir una solicitud de soporte sin salir del producto",
      width: 1280,
      height: 720,
      src: "/product/trust-soporte.webp",
    },
  },
];

/**
 * La muesca del pie, calcada de las tarjetas de «The latest news».
 *
 * NO es `clip-path` ni una máscara —eso es lo que parece desde fuera—: en el
 * original es un `<svg>` con un `<path>` pintado del color de la tarjeta, que
 * recorta la esquina inferior derecha en diagonal. En ese hueco se aloja el
 * dato del pie.
 *
 * El trazado es el suyo, medido en el sitio y no reconstruido a ojo:
 * `viewBox="0 0 670 111"`. Se escala con `preserveAspectRatio="none"` porque
 * nuestras tarjetas son más estrechas que las suyas.
 */
function Muesca({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 670 111"
      preserveAspectRatio="none"
      className={className}
    >
      <path
        fill="currentColor"
        d="M670 0H0V91C0 102.046 8.9543 111 20 111H518.641C526.216 111 533.14 106.721 536.529 99.9469L570.988 31.0531C574.377 24.2789 581.301 20 588.875 20H650C661.046 20 670 11.0457 670 0Z"
      />
    </svg>
  );
}

function TrustCard({ item, index }: { item: Item; index: number }) {
  const { ref, revelado } = useRevelado<HTMLLIElement>(index, 0.05);

  return (
    <li ref={ref} className={cn("flex", revelado.className)} style={revelado.style}>
      {/*
        Anatomía de «The latest news»: la tarjeta tiene fondo propio, la imagen
        va DENTRO con su propio redondeo, y el pie lleva la muesca.

        Antes estas tarjetas no tenían ni fondo ni borde: la imagen flotaba
        sobre el blanco de la página y el texto colgaba debajo. Con fondo, las
        cuatro se leen como objetos y no como cuatro columnas de texto.
      */}
      {/*
        El fondo NO va en el <article> sino en el bloque de contenido, y el pie
        lo dibuja el propio SVG.

        Con el fondo en el contenedor, el recorte de la muesca dejaba ver ese
        mismo fondo y la muesca era invisible: se veía una tarjeta con la
        esquina normal. La gracia del patrón es que la zona recortada deje ver
        LA PÁGINA, y para eso el pie tiene que ser el svg y nada más.
      */}
      <article className="group/tarjeta relative flex w-full flex-col">
        <div className="flex flex-1 flex-col rounded-t-2xl bg-slate-50 p-4 pb-0 text-navy">
          <div className="overflow-clip rounded-xl">
            <AssetSlot
              asset={item.shot}
              className={cn(
                "w-full",
                // La imagen crece un punto al pasar el puntero. La tarjeta no se
                // mueve: `overflow-clip` la contiene y el gesto queda dentro.
                "transition-transform duration-[400ms] ease-out-brand",
                "[@media(hover:hover)_and_(pointer:fine)]:group-hover/tarjeta:scale-[1.03]",
                "motion-reduce:transition-none",
              )}
              sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 25vw"
            />
          </div>

          <p className={cn("mt-4 text-[11px] font-semibold uppercase tracking-widest", item.metaColor)}>
            {item.meta}
          </p>
          <p className="mt-1 font-display text-lg leading-snug text-navy">{item.title}</p>
          <p className="mt-1 pb-6 text-sm leading-relaxed text-slate-600">{item.body}</p>
        </div>

        {/* El pie: la muesca dibuja el fondo y el dato se apoya encima. */}
        <div className="relative mt-auto h-[52px] shrink-0">
          <Muesca className="absolute inset-0 h-full w-full text-slate-50" />
          <p className="absolute inset-x-4 bottom-3 text-xs font-semibold text-slate-500">
            {item.pie}
          </p>
        </div>
      </article>
    </li>
  );
}

export function TrustOnboarding() {
  return (
    <section
      id="migracion-confianza"
      aria-labelledby="trust-heading"
      className="container scroll-mt-24 py-xxl"
    >
      <h2
        id="trust-heading"
        className="max-w-3xl font-display text-h2 text-navy text-balance"
      >
        Empieza sin fricción, opera con confianza
      </h2>
      <p className="mt-md max-w-2xl text-base leading-relaxed text-slate-600">
        Migra tu conjunto de forma fácil y sin fricciones.
      </p>

      <ul
        role="list"
        className="mt-xl grid gap-lg sm:grid-cols-2 lg:grid-cols-4"
      >
        {ITEMS.map((item, i) => (
          <TrustCard key={item.key} item={item} index={i} />
        ))}
      </ul>
    </section>
  );
}
