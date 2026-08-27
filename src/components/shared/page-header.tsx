import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * **La cabecera de una pantalla: dónde estoy.**
 *
 * En escritorio el administrador no tenía cabecera —la del shell es `md:hidden`
 * para su rol— así que la única señal de ubicación era el ítem marcado del menú
 * lateral, que a 671 px de alto **queda bajo el pliegue en más de la mitad de
 * las pantallas**.
 *
 * El grupo llega ya capitalizado y ya decidido desde `resolvePageIdentity`: aquí
 * no se decide nada, solo se pinta. Y no es un enlace, a propósito — un grupo
 * del menú no tiene pantalla propia a la que ir, y una migaja que no lleva a
 * ningún sitio es peor que una migaja que no existe.
 */
export function PageHeader({
  group,
  title,
  actions,
  className,
}: {
  group?: string;
  title: string;
  /** Acciones de la pantalla, alineadas a la derecha del título. */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {group ? (
          <p className="flex items-center gap-0.5 text-label text-[var(--slate-500)]">
            <span className="truncate">{group}</span>
            <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
          </p>
        ) : null}
        <h1 className="font-display truncate text-display text-[var(--slate-900)]">{title}</h1>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
