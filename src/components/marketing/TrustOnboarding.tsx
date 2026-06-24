import * as React from "react";
import { Upload, KeyRound, ShieldCheck, MessageCircle, type LucideIcon } from "lucide-react";

/**
 * Migración + Confianza — manejo de objeción antes del precio (blueprint §3.9).
 *
 * Resuelve las dos objeciones que frenan la venta B2B cuando se maneja dinero y
 * datos: "cambiar es un dolor" y "¿está seguro?". Va justo antes de Pricing.
 * Sección estática (server component).
 */

type Item = {
  Icon: LucideIcon;
  title: string;
  body: string;
};

const ITEMS: Item[] = [
  {
    Icon: Upload,
    title: "Migra tu cartera en 72 horas",
    body: "Importa unidades, residentes y la cartera con la que llega tu conjunto desde Excel. Operas el día 1 con tu realidad, no desde cero.",
  },
  {
    Icon: KeyRound,
    title: "Acceso seguro por enlace",
    body: "Cada usuario activa su cuenta desde un enlace y recupera su clave solo. Sin contraseñas compartidas ni la cédula como llave.",
  },
  {
    Icon: ShieldCheck,
    title: "Respaldos diarios y auditoría",
    body: "Copias de seguridad automáticas cada día y registro auditable de las operaciones sensibles. Tu información, protegida.",
  },
  {
    Icon: MessageCircle,
    title: "Soporte en español",
    body: "Acompañamiento en tu idioma durante la activación y en el día a día.",
  },
];

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
        Migrar tu conjunto no debería costar meses. Y manejar dinero y datos exige respaldo.
      </p>

      <ul role="list" className="mt-xl grid gap-lg sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(({ Icon, title, body }) => (
          <li
            key={title}
            className="flex flex-col rounded-2xl border border-border bg-background p-lg shadow-brand-sm"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue/10 ring-4 ring-brand-blue/20">
              <Icon className="h-6 w-6 text-brand-blue" aria-hidden="true" />
            </div>
            <p className="mt-md font-display text-lg text-navy">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
