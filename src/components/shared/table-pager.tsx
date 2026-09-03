"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { PAGE_SIZE_OPTIONS } from "@/components/shared/use-pagination";

const navClass =
  "flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--slate-200)] bg-[var(--surface-strong)] text-[var(--slate-600)] transition-colors hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Controles de paginación para tablas/listas del admin. Muestra el rango visible,
 * un selector opcional de "filas por página" y botones anterior/siguiente.
 * Diseñado para usarse con usePagination.
 */
export function TablePager({
  page,
  totalPages,
  total,
  start,
  pageSize,
  onPrev,
  onNext,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className,
}: {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}) {
  return (
    <div className={cn("mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--slate-600)]", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Mostrando {start + 1}–{Math.min(start + pageSize, total)} de {total}
        </span>
        {onPageSizeChange ? (
          <label className="flex items-center gap-1.5 text-xs text-[var(--slate-500)]">
            Filas
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-lg border border-[var(--slate-300)] bg-[var(--surface-strong)] px-2 text-sm"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={onPrev} disabled={page === 1} aria-label="Página anterior" className={navClass}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="px-2 text-xs text-[var(--slate-500)]">
          {page} / {totalPages}
        </span>
        <button type="button" onClick={onNext} disabled={page === totalPages} aria-label="Página siguiente" className={navClass}>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
