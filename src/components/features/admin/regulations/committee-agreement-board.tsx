"use client";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import type { CommitteeAgreement } from "@/features/committee-agreements/types";
import { useAgreementSignatures } from "@/features/committee-agreements/use-committee-agreements";
import { formatDateSafe } from "@/utils/date";

export type BoardUnit = { id: string; displayName?: string; tower?: string; status?: string };
export type BoardPerson = { fullName?: string; email?: string };

type SignedRow = { id: string; unitLabel: string; tower: string; resident: string; signedAt: Date | null };

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "green" | "amber" }) {
  const styles =
    tone === "green"
      ? "border-[var(--success-200)] bg-[var(--success-50)] text-[var(--success-700)]"
      : tone === "amber"
        ? "border-[var(--amber-200)] bg-[var(--amber-50)] text-[var(--amber-700)]"
        : "border-[var(--slate-200)] bg-[var(--surface-strong)] text-[var(--slate-900)]";
  return (
    <div className={`rounded-xl border px-4 py-3 ${styles}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="mt-0.5 text-xl font-semibold">{value}</p>
    </div>
  );
}

/**
 * Tablero comparativo de firmas de un acuerdo: firmados vs pendientes y % de
 * cumplimiento, contra el conjunto de firmantes definido al crear (todas las
 * unidades activas o las seleccionadas). Tablas paginadas (sin listas infinitas).
 */
export function CommitteeAgreementBoard({
  agreement,
  tenantId,
  units,
  peopleByUnitId,
}: {
  agreement: CommitteeAgreement;
  tenantId?: string;
  units: BoardUnit[];
  peopleByUnitId: ReadonlyMap<string, BoardPerson>;
}) {
  const { signatures, loading } = useAgreementSignatures(tenantId, agreement.id);

  const signerUnits =
    agreement.signerScope === "selected"
      ? units.filter((u) => (agreement.signerUnitIds ?? []).includes(u.id))
      : units.filter((u) => u.status === "active");

  const signedSet = new Set(signatures.map((s) => s.unitId));
  const pendingUnits = signerUnits.filter((u) => !signedSet.has(u.id));
  const total = signerUnits.length;
  const signed = signerUnits.filter((u) => signedSet.has(u.id)).length;
  const pending = Math.max(total - signed, 0);
  const pct = total > 0 ? Math.round((signed / total) * 100) : 0;

  const signedRows: SignedRow[] = signatures
    .filter((s) => signerUnits.some((u) => u.id === s.unitId))
    .map((s) => {
      const unit = units.find((u) => u.id === s.unitId);
      return {
        id: s.id,
        unitLabel: unit?.displayName ?? s.unitId,
        tower: unit?.tower ?? "—",
        resident: peopleByUnitId.get(s.unitId)?.fullName ?? "—",
        signedAt: s.signedAt?.toDate?.() ?? null,
      };
    });

  const signedColumns: DataTableColumn<SignedRow>[] = [
    { key: "unit", header: "Unidad", render: (r) => <span className="font-medium text-[var(--slate-900)]">{r.unitLabel}</span> },
    { key: "tower", header: "Agrupación", render: (r) => <span className="text-[var(--slate-600)]">{r.tower}</span> },
    { key: "resident", header: "Residente", render: (r) => <span className="text-[var(--slate-700)]">{r.resident}</span> },
    { key: "signedAt", header: "Fecha de firma", render: (r) => <span className="text-[var(--slate-600)]">{formatDateSafe(r.signedAt)}</span> },
  ];

  const pendingColumns: DataTableColumn<BoardUnit>[] = [
    { key: "unit", header: "Unidad", render: (u) => <span className="font-medium text-[var(--slate-900)]">{u.displayName ?? u.id}</span> },
    { key: "tower", header: "Agrupación", render: (u) => <span className="text-[var(--slate-600)]">{u.tower ?? "—"}</span> },
    {
      key: "titular",
      header: "Titular",
      render: (u) =>
        peopleByUnitId.get(u.id)?.fullName ? (
          <span className="text-[var(--slate-700)]">{peopleByUnitId.get(u.id)?.fullName}</span>
        ) : (
          <span className="text-[var(--slate-400)]">Sin titular</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--slate-600)]">Sesión del {formatDateSafe(agreement.sessionDate)}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Firmantes" value={total} />
        <Kpi label="Firmados" value={signed} tone="green" />
        <Kpi label="Pendientes" value={pending} tone="amber" />
        <Kpi label="Cumplimiento" value={`${pct}%`} />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Firmados</p>
        <DataTable
          columns={signedColumns}
          rows={signedRows}
          getRowKey={(r) => r.id}
          loading={loading}
          loadingText="Cargando firmas…"
          emptyText="Nadie ha firmado todavía."
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Pendientes</p>
        <DataTable
          columns={pendingColumns}
          rows={pendingUnits}
          getRowKey={(u) => u.id}
          loading={loading}
          emptyText="Todos los firmantes han firmado. 🎉"
        />
      </div>
    </div>
  );
}
