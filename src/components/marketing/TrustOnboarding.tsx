"use client";

import * as React from "react";
import { AssetSlot, type AssetDef } from "@/components/marketing/ui/asset-slot";
import { useInView, useReducedMotion } from "@/lib/marketing/hooks";
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
      alt: "Registro de auditoría con autor y fecha por operación",
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
      alt: "Conversación de soporte dentro del producto",
      width: 1280,
      height: 720,
      src: "/product/trust-soporte.webp",
    },
  },
];

function TrustCard({ item, index }: { item: Item; index: number }) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLLIElement>(0.05);
  const delayMs = reduced ? 0 : index * 60;

  return (
    <li
      ref={ref}
      className={cn(
        "flex flex-col gap-sm",
        "transition-[opacity,transform] duration-[280ms] ease-out motion-reduce:transition-none",
        inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
      style={{ transitionDelay: reduced || inView ? "0ms" : `${delayMs}ms` }}
    >
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
