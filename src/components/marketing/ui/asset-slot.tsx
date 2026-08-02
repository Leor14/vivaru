import Image from "next/image";

import { cn } from "@/lib/utils/cn";

/**
 * Hueco de imagen o vídeo que se maqueta antes de existir.
 *
 * Nació dentro de `Perspectives` como el helper `Shot` y se extrae aquí porque
 * el rediseño del landing abre 19 espacios nuevos (ver
 * `docs/plan-rediseno-landing.md`). Sin esto habría que elegir entre maquetar
 * con imágenes falsas —que alguien acabaría promoviendo por descuido— o
 * esperar a tener las piezas para empezar a construir.
 *
 * Con `src` pinta la imagen. Sin `src` pinta un marcador que **respeta la
 * proporción final**, así que la maqueta no se mueve cuando llegue el archivo:
 * lo único que cambia es el contenido del hueco.
 *
 * El marcador muestra el nombre de archivo propuesto porque quien produce la
 * pieza necesita saber cómo llamarla y dónde dejarla, y ese dato acaba
 * perdiéndose en un chat si no vive en la interfaz.
 */

export type AssetKind = "image" | "video";

export type AssetDef = {
  /** Sin definir mientras la pieza no exista. */
  src?: string;
  /** Descripción real, no un relleno: es el `alt` y también el texto del marcador. */
  alt: string;
  /** Dimensiones intrínsecas. Fijan la proporción del marcador. */
  width: number;
  height: number;
  kind?: AssetKind;
  /** Ruta propuesta, visible en el marcador. Ej. `/landing/trust-migracion.png`. */
  file?: string;
  /** Solo vídeo: fotograma de espera mientras carga. */
  poster?: string;
};

export function AssetSlot({
  asset,
  className,
  sizes = "(max-width: 1024px) 100vw, 50vw",
  priority,
  compact,
}: {
  asset: AssetDef;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /**
   * Para huecos pequeños (un icono de 100×100). El marcador completo lleva
   * tres líneas de texto que ahí no caben y salen apelotonadas; en compacto
   * se queda solo la descripción.
   */
  compact?: boolean;
}) {
  const { src, alt, width, height, kind = "image", file, poster } = asset;

  if (src && kind === "video") {
    return (
      // Sin controles y en bucle: es ambientación, no un vídeo que alguien
      // vaya a pausar. `playsInline` evita que iOS lo abra a pantalla completa.
      <video
        className={cn("h-auto w-full", className)}
        width={width}
        height={height}
        poster={poster}
        autoPlay
        loop
        muted
        playsInline
        preload="none"
        aria-label={alt}
      >
        <source src={src} type="video/webm" />
      </video>
    );
  }

  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        className={cn("h-auto", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center border border-dashed border-slate-300 bg-slate-50 text-center",
        className,
      )}
      style={{ aspectRatio: `${width} / ${height}` }}
      role="img"
      aria-label={alt}
    >
      <div className={compact ? "p-1.5" : "p-3"}>
        <p
          className={cn(
            "font-medium leading-snug text-slate-500",
            compact ? "text-[10px]" : "text-[11px]",
          )}
        >
          {alt}
        </p>
        {compact ? null : (
          <>
            <p className="mt-1 text-[9px] uppercase tracking-widest text-slate-400">
              {kind === "video" ? "Vídeo pendiente" : "Pendiente"} · {width}×{height}
            </p>
            {file ? (
              <p className="mt-0.5 font-mono text-[9px] text-slate-400">{file}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
