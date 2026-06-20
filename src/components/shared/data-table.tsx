"use client";

import type { ReactNode } from "react";

import { TablePager } from "@/components/shared/table-pager";
import { DEFAULT_PAGE_SIZE, usePagination } from "@/components/shared/use-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  mobileLabel?: string;
  className?: string;
  headerClassName?: string;
  mobileHidden?: boolean;
  render: (row: T) => ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  loadingText = "Cargando datos...",
  emptyText = "No hay datos para mostrar.",
  errorText,
  renderActions,
  actionsHeader = "Acciones",
  tableMinWidthClassName,
  onRowClick,
  renderMobileRow,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  loadingText?: string;
  emptyText?: string;
  errorText?: string | null;
  renderActions?: (row: T) => ReactNode;
  actionsHeader?: string;
  tableMinWidthClassName?: string;
  onRowClick?: (row: T) => void;
  /**
   * Optional compact mobile renderer.
   * When provided, rows render as slim 2-line list items (~56px)
   * instead of the default expanded label-value card layout (~200px).
   * Return the left-side content (primary + secondary text).
   * Actions are still handled by `renderActions` on the right.
   */
  renderMobileRow?: (row: T) => ReactNode;
  /** Tamaño de página. La paginación aparece solo cuando hay más filas que esto. */
  pageSize?: number;
}) {
  const visibleMobileColumns = columns.filter((column) => !column.mobileHidden);
  const { page, totalPages, total, start, hasPagination, pageItems, prev, next } = usePagination(rows, pageSize);

  return (
    <>
      <div className="sm:hidden">
        {loading ? (
          <div className="space-y-px rounded-xl border border-[var(--slate-200)] overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 bg-white px-3 py-3">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
            ))}
          </div>
        ) : null}
        {!loading && errorText ? <p className="text-sm text-[var(--danger-700)]">{errorText}</p> : null}
        {!loading && !errorText && rows.length === 0 ? <p className="text-sm text-[var(--slate-600)]">{emptyText}</p> : null}

        {!loading && !errorText && renderMobileRow ? (
          // ── Compact list rows ──────────────────────────────────────────────
          <div className="overflow-hidden rounded-xl border border-[var(--slate-200)]">
            {pageItems.map((row) => (
              <article
                key={getRowKey(row)}
                className={cn(
                  "flex min-h-[56px] items-center gap-2 border-b border-[var(--slate-200)] bg-white px-3 py-2.5 last:border-b-0",
                  onRowClick
                    ? "cursor-pointer transition-colors duration-150 hover:bg-[var(--brand-50)]/40 active:bg-[var(--brand-50)] motion-reduce:transition-none"
                    : null,
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                <div className="min-w-0 flex-1">{renderMobileRow(row)}</div>
                {renderActions ? (
                  <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                    {renderActions(row)}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        {!loading && !errorText && !renderMobileRow
          ? pageItems.map((row) => (
              // ── Default expanded card layout ───────────────────────────────
              <article
                key={getRowKey(row)}
                className={cn(
                  "space-y-2 rounded-xl border border-[var(--slate-200)] p-3",
                  onRowClick
                    ? "cursor-pointer [transition:border-color_150ms_ease-out,background-color_150ms_ease-out,transform_120ms_ease-out] hover:border-[var(--brand-700)] hover:bg-[var(--brand-50)]/40 active:scale-[0.98] motion-reduce:[transform:none]"
                    : null,
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {visibleMobileColumns.map((column) => (
                  <div key={column.key} className="text-sm">
                    <p className="text-xs text-[var(--slate-500)]">{column.mobileLabel ?? column.header}</p>
                    <div className={cn("mt-0.5 text-[var(--slate-800)]", column.className)}>{column.render(row)}</div>
                  </div>
                ))}
                {renderActions ? (
                  <div className="pt-1" onClick={(event) => event.stopPropagation()}>
                    {renderActions(row)}
                  </div>
                ) : null}
              </article>
            ))
          : null}
      </div>

      <div className="responsive-table-wrap hidden sm:block">
        <table className={cn("responsive-table text-sm", tableMinWidthClassName)}>
          <thead>
            <tr className="border-b border-[var(--slate-200)] text-left text-[var(--slate-500)]">
              {columns.map((column) => (
                <th key={column.key} className={cn("py-2.5 pr-4 first:pl-1 last:pr-1", column.headerClassName)}>
                  {column.header}
                </th>
              ))}
              {renderActions ? <th className="py-2.5 pl-3 pr-1 text-right">{actionsHeader}</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`} className="border-b border-[var(--slate-100)]">
                  {columns.map((column) => (
                    <td key={column.key} className="py-3 pr-4 first:pl-1 last:pr-1">
                      <Skeleton className="h-4 w-24 rounded" />
                    </td>
                  ))}
                  {renderActions ? (
                    <td className="py-3 pl-3 pr-1 text-right">
                      <Skeleton className="ml-auto h-7 w-16 rounded-lg" />
                    </td>
                  ) : null}
                </tr>
              ))
            ) : null}

            {!loading && errorText ? (
              <tr>
                <td className="py-3 text-[var(--danger-700)]" colSpan={columns.length + (renderActions ? 1 : 0)}>
                  {errorText}
                </td>
              </tr>
            ) : null}

            {!loading && !errorText && rows.length === 0 ? (
              <tr>
                <td className="py-3 text-[var(--slate-600)]" colSpan={columns.length + (renderActions ? 1 : 0)}>
                  {emptyText}
                </td>
              </tr>
            ) : null}

            {!loading && !errorText
              ? pageItems.map((row) => (
                  <tr
                    key={getRowKey(row)}
                    className={cn(
                      "border-b border-[var(--slate-100)] align-middle transition-colors duration-150 ease-out hover:bg-[var(--slate-100)]/60",
                      onRowClick ? "cursor-pointer" : null,
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className={cn("py-3 pr-4 first:pl-1 last:pr-1", column.className)}>
                        {column.render(row)}
                      </td>
                    ))}
                    {renderActions ? (
                      <td className="py-3 pl-3 pr-1 text-right" onClick={(event) => event.stopPropagation()}>
                        {renderActions(row)}
                      </td>
                    ) : null}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      {!loading && !errorText && hasPagination ? (
        <TablePager
          page={page}
          totalPages={totalPages}
          total={total}
          start={start}
          pageSize={pageSize}
          onPrev={prev}
          onNext={next}
        />
      ) : null}
    </>
  );
}
