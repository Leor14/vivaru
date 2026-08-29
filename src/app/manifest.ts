import type { MetadataRoute } from "next";

/**
 * Manifest de web app (PRD-V-PLAT-005 §11). Existe por el push en iOS: sin
 * `display: "standalone"` un sitio añadido a la pantalla de inicio no cuenta
 * como web app y `pushManager` ni aparece. Los iconos son el emblema de marca
 * en blanco sobre `--brand-700`, generados del SVG (D2 de la ficha).
 *
 * `start_url` va a /login a propósito: quien instala es un residente con
 * sesión, y /login redirige a su portal; la raíz es el landing comercial.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vivaru",
    short_name: "Vivaru",
    description: "Administración de propiedad horizontal.",
    start_url: "/login",
    display: "standalone",
    background_color: "#0b3c5d",
    theme_color: "#0b3c5d",
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // El emblema ocupa el 62% del lienzo: dentro de la zona segura maskable.
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
