import type { ReactNode } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";

export function CompactDataTable<T>({
  columns,
  rows,
  getRowKey,
  loading,
  emptyText,
  errorText,
  actionsHeader,
  renderActions,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  emptyText?: string;
  errorText?: string | null;
  actionsHeader?: string;
  renderActions?: (row: T) => ReactNode;
}) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={getRowKey}
      loading={loading}
      emptyText={emptyText}
      errorText={errorText}
      actionsHeader={actionsHeader}
      renderActions={renderActions}
      tableMinWidthClassName="min-w-[560px]"
    />
  );
}
