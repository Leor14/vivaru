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

function TrustCard({ item, index }: { item: Item; index: number }) {
  const { ref, revelado } = useRevelado<HTMLLIElement>(index, 0.05);

  return (
    <li
      ref={ref}
      className={cn("group relative flex flex-col gap-sm", revelado.className)}
      style={revelado.style}
    >
      {/*
        La pastilla de hover, tomada de las tarjetas de noticias de Cohere: un
        rectángulo redondeado un poco MAYOR que la tarjeta que aparece detrás.

        Por qué aquí y no en las otras tres secciones: estas tarjetas no tienen
        borde ni fondo ni hover de ningún tipo, así que hoy no acusan el puntero.
        `CasosDeUso` y `Solution` ya se elevan y ganan sombra —una pastilla
        encima diría lo mismo dos veces— y las de `Differentiators` son fotos a
        sangre, donde un rectángulo detrás no se vería.

        Solo `opacity`: la tarjeta no se mueve. Y solo con puntero fino, porque
        en táctil el hover se queda pegado después de tocar.
      */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -inset-x-2 -inset-y-3 -z-10 rounded-2xl bg-slate-100",
          "opacity-0 transition-opacity duration-[200ms] ease-out-brand",
          "[@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100",
          "motion-reduce:transition-none",
        )}
      />
      <AssetSlot
        asset={item.shot}
        className="w-full rounded-2xl"
        sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 25vw"
      />
      <p
        className={cn(
          "mt-1 text-[11px] font-semibold uppercase tracking-widest",
          item.metaColor,
        )}
      >
        {item.meta}
      </p>
      <p className="font-display text-lg leading-snug text-navy">{item.title}</p>
      <p className="text-sm leading-relaxed text-slate-600">{item.body}</p>
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
        className="mt-xl grid items-start gap-lg sm:grid-cols-2 lg:grid-cols-4"
      >
        {ITEMS.map((item, i) => (
          <TrustCard key={item.key} item={item} index={i} />
        ))}
      </ul>
    </section>
  );
}
