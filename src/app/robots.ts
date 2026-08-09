import type { MetadataRoute } from "next";

import { isProduction } from "@/lib/env";
import { URL_SITIO } from "@/lib/marketing/sitio";

/**
 * `robots.txt` dependiente del ambiente.
 *
 * Producción indexa normal. Cualquier otro ambiente (staging, preview) se cierra
 * por completo: el landing de pruebas sirve el mismo código y, sin esto, Google
 * puede indexarlo — con dos consecuencias malas: contenido duplicado que
 * canibaliza el SEO de grupovivaru.com, y prospectos reales cayendo desde un
 * buscador en un ambiente de pruebas.
 *
 * El bloqueo de las rutas privadas aplica en todos los ambientes: los portales
 * requieren sesión y no aportan nada a un buscador.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isProduction) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        /*
         * Las rutas de `(auth)` se bloquean por la misma razón que los
         * portales: requieren sesión y no le dicen nada a un buscador. Faltaban,
         * y no era gratis — un rastreador las contaba como páginas del sitio.
         * Como no heredan el layout de `(marketing)`, no llevan canónica ni
         * datos estructurados, y arrastraban a fallo comprobaciones que el resto
         * del sitio sí pasa.
         *
         * `/registro` es la EXCEPCIÓN y no se bloquea: es la página de
         * conversión de la prueba gratuita, la única de `(auth)` que interesa
         * que se encuentre. Por eso tiene metadata propia en su layout.
         */
        disallow: [
          "/admin",
          "/resident",
          "/guard",
          "/superadmin",
          "/api/",
          "/login",
          "/activar",
          "/restablecer",
          "/forgot-password",
          "/setup-error",
          "/unauthorized",
        ],
      },
    ],
    // Declararlo aquí es lo que hace que el sitemap sirva de algo: sin esta
    // línea, `/sitemap.xml` existe y nadie lo va a buscar.
    sitemap: `${URL_SITIO}/sitemap.xml`,
  };
}
