import type { MetadataRoute } from "next";

import { isProduction } from "@/lib/env";

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
        disallow: ["/admin", "/resident", "/guard", "/superadmin", "/api/"],
      },
    ],
  };
}
