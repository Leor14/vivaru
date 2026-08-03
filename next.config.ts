import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next does not auto-detect the wrong one
  // when multiple lockfiles exist (root package-lock.json + functions/package-lock.json).
  // Applies to both `next build` (via outputFileTracingRoot) and Turbopack (via turbopack.root).
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    root: __dirname,
  },
  poweredByHeader: false,
  compress: true,
  // ⚠️ EN APP HOSTING ESTO NO SE APLICA: el optimizador de Next está apagado.
  //
  // `@apphosting/adapter-nextjs` reescribe este archivo durante el build en la
  // nube (guarda el original como `next.config.original.ts`) y le inyecta:
  //
  //     images: { ...config.images,
  //       ...(config.images?.unoptimized === undefined &&
  //           config.images?.loader     === undefined
  //             ? { unoptimized: true } : {}) }
  //
  // Es decir: fuerza `unoptimized: true` SALVO que aquí se declare
  // explícitamente `unoptimized` o un `loader`. Declarar `formats` no basta —
  // el adaptador no lo mira.
  //
  // Síntoma: `/_next/image?...` responde 404 (con `unoptimized` la ruta ni
  // siquiera se genera) y el HTML sale con `src="/product/x.webp"` a pelo, sin
  // `srcset`. En un build local `next build` sí emite el `srcset` completo, así
  // que la diferencia solo aparece desplegado.
  //
  // Por eso `public/product/` se sirve ya redimensionado y en WebP: sin
  // optimizador, el byte que está en disco es el byte que descarga el visitante.
  // Ver `scripts/optimize-product-images.mjs` y
  // `wiki-producto/wiki/decisiones/trampas-conocidas.md`.
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
  async headers() {
    return [
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
