import type { MetadataRoute } from "next";

import { RUTAS_PUBLICAS, URL_SITIO } from "@/lib/marketing/sitio";

/**
 * `sitemap.xml`.
 *
 * No existía: `/sitemap.xml` devolvía 404 y `robots.txt` no lo declaraba. Con
 * cinco páginas Google las encuentra igual siguiendo enlaces, así que esto no
 * cambia nada por sí solo; se añade ahora porque en cuanto se creen páginas por
 * intención de búsqueda sí importa, y porque declararlo en `robots.txt` es
 * gratis.
 *
 * `lastModified` sale de la fecha del build. Es una aproximación honesta —el
 * contenido cambia cuando se despliega— y evita inventar fechas por página que
 * nadie va a mantener.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const desplegado = new Date();

  return RUTAS_PUBLICAS.map(({ ruta, prioridad, frecuencia }) => ({
    url: `${URL_SITIO}${ruta}`,
    lastModified: desplegado,
    changeFrequency: frecuencia,
    priority: prioridad,
  }));
}
