import type { ReactNode } from "react";

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
}) {
  const visibleMobileColumns = columns.filter((column) => !column.mobileHidden);

  return (
    <>
      <div className="space-y-3 sm:hidden">
        {loading ? (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-[var(--slate-200)] p-3">
                {Array.from({ length: Math.min(visibleMobileColumns.length || 3, 4) }).map((_, j) => (
                  <div key={j} className="space-y-1">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-4 w-32 rounded" />
                  </div>
                ))}
              </div>
            ))}
          </>
        ) : null}
        {!loading && errorText ? <p className="text-sm text-[var(--danger-700)]">{errorText}</p> : null}
        {!loading && !errorText && rows.length === 0 ? <p className="text-sm text-[var(--slate-600)]">{emptyText}</p> : null}

        {!loading && !errorText
          ? rows.map((row) => (
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
              ? rows.map((row) => (
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
    </>
  );
}
