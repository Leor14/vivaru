"use client";

import { useEffect, useMemo, useState } from "react";

export const DEFAULT_PAGE_SIZE = 10;

/**
 * Paginación client-side para listados que crecen sin límite. Corta el arreglo
 * a la página actual y expone los controles. Si los datos se reducen (p. ej. por
 * un filtro) y la página queda fuera de rango, se ajusta sola. Pensado para el
 * DataTable compartido y para las tablas custom del admin (ver TablePager).
 */
export function usePagination<T>(items: T[], pageSize: number = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const hasPagination = total > pageSize;

  const pageItems = useMemo(
    () => (hasPagination ? items.slice(start, start + pageSize) : items),
    [items, hasPagination, start, pageSize],
  );

  return {
    page: safePage,
    setPage,
    totalPages,
    total,
    pageSize,
    start,
    hasPagination,
    pageItems,
    next: () => setPage((p) => Math.min(p + 1, totalPages)),
    prev: () => setPage((p) => Math.max(p - 1, 1)),
  };
}
