"use client";

import { useEffect, useMemo, useState } from "react";

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50];

/**
 * Paginación client-side para listados que crecen sin límite. Corta el arreglo
 * a la página actual y maneja el tamaño de página como estado (para el selector
 * "filas por página" del TablePager). Si los datos se reducen y la página queda
 * fuera de rango, se ajusta sola. El paginador se muestra cuando hay más filas
 * que el tamaño mínimo seleccionable (DEFAULT_PAGE_SIZE), no del tamaño actual,
 * para que el selector no desaparezca al subir a 25/50.
 */
export function usePagination<T>(items: T[], initialPageSize: number = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const hasPagination = total > DEFAULT_PAGE_SIZE;

  const pageItems = useMemo(
    () => (total > pageSize ? items.slice(start, start + pageSize) : items),
    [items, total, pageSize, start],
  );

  function setPageSize(next: number) {
    setPageSizeState(next);
    setPage(1);
  }

  return {
    page: safePage,
    setPage,
    totalPages,
    total,
    pageSize,
    setPageSize,
    start,
    hasPagination,
    pageItems,
    next: () => setPage((p) => Math.min(p + 1, totalPages)),
    prev: () => setPage((p) => Math.max(p - 1, 1)),
  };
}
