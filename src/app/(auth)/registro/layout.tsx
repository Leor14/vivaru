import type { Metadata } from "next";

import { URL_SITIO, openGraphDe } from "@/lib/marketing/sitio";

/**
 * Metadata de `/registro`, la página de conversión de la prueba gratuita.
 *
 * Vive en un layout y no en la página porque `registro/page.tsx` es un
 * componente de cliente (`"use client"`), y un componente de cliente no puede
 * exportar `metadata`.
 *
 * Anula el `robots: { index: false }` que el layout de `(auth)` pone por
 * defecto para las pantallas de acceso. Es la única de ese grupo que interesa
 * que se encuentre: `robots.ts` la deja fuera de la lista de bloqueo a
 * propósito.
 *
 * Hasta ahora no tenía nada: ni título propio, ni descripción, ni canónica, ni
 * Open Graph. Salía en la auditoría como una de las dos peores páginas del
 * sitio y arrastraba a fallo comprobaciones que el resto sí pasa.
 *
 * `openGraphDe` construye el bloque ENTERO. No declarar aquí solo la `url`:
 * Next no fusiona `openGraph` en profundidad y un bloque parcial borra el
 * resto (ver la nota en `lib/marketing/sitio.ts`).
 */
export const metadata: Metadata = {
  /*
   * `metadataBase` hace falta AQUÍ, y esto solo se ve leyendo el HTML
   * construido: lo declara el layout de `(marketing)`, y esta página vive en
   * `(auth)`, que no lo hereda. Sin él Next cae a `http://localhost:3000` y la
   * `og:image` se publica apuntando a la máquina de quien hizo el build — una
   * vista previa rota en cada vez que alguien comparta el enlace de la prueba.
   * La canónica, además, salía relativa.
   */
  metadataBase: new URL(URL_SITIO),
  title: "Prueba gratis 15 días | Vivaru",
  description:
    "Crea el ambiente de prueba de tu condominio en minutos: 15 días con datos de ejemplo listos, sin tarjeta y sin instalar nada.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/registro" },
  openGraph: openGraphDe("/registro"),
};

export default function RegistroLayout({ children }: { children: React.ReactNode }) {
  return children;
}
