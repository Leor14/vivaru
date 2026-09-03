"use client";

import { useState } from "react";
import { ChevronDown, Clock, FileText, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/shared/help-tip";
import { billingConceptLabel } from "@/features/billing/use-billing-statements";
import type { BillingStatement } from "@/types/domain";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  paid: {
    label: "Al día",
    badgeCls: "bg-[var(--success-50)] text-[var(--success-700)]",
    dotCls: "bg-[var(--success-500)]",
    borderCls: "border-[var(--slate-200)]",
    headerBg: "",
  },
  pending: {
    label: "Pendiente",
    badgeCls: "bg-[var(--amber-50)] text-[var(--amber-700)]",
    dotCls: "bg-[var(--amber-400)]",
    borderCls: "border-[var(--slate-200)]",
    headerBg: "",
  },
  overdue: {
    label: "Vencido",
    badgeCls: "bg-[var(--danger-50)] text-[var(--danger-700)]",
    dotCls: "bg-[var(--danger-500)]",
    borderCls: "border-[var(--danger-200)]",
    headerBg: "bg-[var(--danger-50)]/40",
  },
  // `FLOW-001`: la corrida que lo generó se anuló. **No dice «Al día»** — eso
  // afirmaría que se pagó. Gris y sin acento: no hay nada que hacer con él, y
  // el importe sigue visible porque el cargo conserva lo que llegó a decir.
  cancelled: {
    label: "Anulado",
    badgeCls: "bg-[var(--slate-100)] text-[var(--slate-500)]",
    dotCls: "bg-[var(--slate-400)]",
    borderCls: "border-[var(--slate-200)]",
    headerBg: "",
  },
} as const;

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  valueClass = "",
  helpText,
}: {
  label: string;
  value: string;
  valueClass?: string;
  helpText?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="inline-flex items-center gap-1 text-xs text-[var(--slate-500)]">
        {label}
        {helpText ? <HelpTip text={helpText} side="right" /> : null}
      </span>
      <span className={`text-xs font-medium text-[var(--slate-800)] ${valueClass}`}>{value}</span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BillingPeriodCardProps {
  item: BillingStatement;
  formatAmount: (n: number) => string;
  /** Called when the resident clicks "Subir comprobante" for this period */
  onUploadReceipt?: (statementId: string) => void;
  /** True while this specific period's file is being uploaded */
  isUploading?: boolean;
  /** Receipt status for this period */
  receiptStatus?: "pending" | "approved" | "rejected" | null;
  defaultOpen?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BillingPeriodCard({
  item,
  formatAmount,
  onUploadReceipt,
  isUploading = false,
  receiptStatus = null,
  defaultOpen = false,
}: BillingPeriodCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const config = STATUS_CONFIG[item.status];

  // Un cargo anulado no debe nada: `!== "paid"` sin más lo daría por deuda.
  const hasDebt = item.status !== "paid" && item.status !== "cancelled";
  const periodLabel = formatPeriod(item.period);

  return (
    <div
      className={`overflow-hidden rounded-xl border ${config.borderCls} bg-[var(--surface-strong)] transition-shadow hover:shadow-sm`}
    >
      {/* ── Header (always visible) ── */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left ${config.headerBg}`}
      >
        {/* Status dot */}
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${config.dotCls}`} aria-hidden="true" />

        {/* Period label */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold capitalize text-[var(--slate-900)]">
            {periodLabel}
          </p>
          {item.concept && item.concept !== "administracion" ? (
            <span className="mt-0.5 inline-block rounded-full bg-[var(--slate-100)] px-2 py-0.5 text-[11px] font-medium text-[var(--slate-700)]">
              {billingConceptLabel(item.concept)}
            </span>
          ) : null}
          {item.dueDate && hasDebt && (
            <p className="flex items-center gap-1 text-xs text-[var(--slate-500)]">
              <Clock className="h-3 w-3" aria-hidden="true" />
              Vence {formatDate(item.dueDate)}
            </p>
          )}
        </div>

        {/* Balance + badge + chevron */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <p className="text-sm font-bold text-[var(--slate-900)]">
              {formatAmount(item.balance)}
            </p>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${config.badgeCls}`}>
              {config.label}
            </span>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[var(--slate-400)] transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* ── Expanded detail — CSS grid trick for smooth height animation ── */}
      <div className="collapsible-grid" data-open={open ? "true" : "false"}>
        <div className="collapsible-content">
        <div className="border-t border-[var(--slate-100)] px-4 pb-4 pt-3">
          <div className="divide-y divide-[var(--slate-100)]">
            {item.amount !== undefined && (
              <DetailRow
                label="Total cobrado"
                value={formatAmount(item.amount)}
                helpText="Es el monto que la administración generó como cuota para este período. Incluye cuota ordinaria y cualquier cargo adicional que aplique a tu unidad."
              />
            )}
            {item.paymentAmount !== undefined && item.paymentAmount > 0 && (
              <DetailRow
                label="Total pagado"
                value={formatAmount(item.paymentAmount)}
                valueClass="text-[var(--success-700)]"
                helpText="Es el valor que ya quedó registrado como recibido por la administración en este período. Si acabas de pagar, puede tardar unos días en reflejarse."
              />
            )}
            <DetailRow
              label="Saldo pendiente"
              value={formatAmount(item.balance)}
              valueClass={item.balance > 0 ? (item.status === "overdue" ? "text-[var(--danger-600)]" : "text-[var(--amber-600)]") : "text-[var(--success-600)]"}
              helpText="Es la diferencia entre lo cobrado y lo pagado. Si es cero, estás al día en este período. Si es mayor a cero, aún hay un valor por cancelar."
            />
            {item.dueDate && (
              <DetailRow
                label="Fecha de vencimiento"
                value={formatDate(item.dueDate)}
                helpText="Fecha límite para pagar este período sin recargos por mora. Pasada esta fecha el saldo queda marcado como vencido."
              />
            )}
            {item.lastPaymentAt && (
              <DetailRow
                label="Último pago registrado"
                value={formatDate(item.lastPaymentAt)}
                helpText="Fecha en que la administración registró el pago más reciente en este período. Útil para confirmar que tu pago fue procesado correctamente."
              />
            )}
          </div>

          {/* ── Comprobante section — solo visible si hay deuda o hay comprobante con estado ── */}
          {(hasDebt || receiptStatus !== null) && (
            <div className="mt-3 rounded-lg border border-dashed border-[var(--slate-200)] bg-[var(--slate-50)] px-3 py-2.5">
              {receiptStatus === "approved" && (
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-[var(--success-600)]" aria-hidden="true" />
                  <span className="text-xs font-medium text-[var(--success-700)]">Comprobante aprobado</span>
                </div>
              )}
              {receiptStatus === "pending" && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-[var(--amber-500)]" aria-hidden="true" />
                  <span className="text-xs font-medium text-[var(--amber-700)]">Comprobante en revisión</span>
                </div>
              )}
              {receiptStatus === "rejected" && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-[var(--danger-500)]" aria-hidden="true" />
                    <span className="text-xs font-medium text-[var(--danger-700)]">Comprobante rechazado — sube uno nuevo</span>
                  </div>
                  {isUploading ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--slate-500)]">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--slate-300)] border-t-[var(--brand-700)]" />
                      Subiendo…
                    </span>
                  ) : onUploadReceipt ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => onUploadReceipt(item.id)}
                    >
                      <Upload className="mr-1 h-3 w-3" aria-hidden="true" />
                      Subir
                    </Button>
                  ) : null}
                </div>
              )}
              {receiptStatus === null && hasDebt && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--slate-500)]">Sin comprobante adjunto</span>
                  {isUploading ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--slate-500)]">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--slate-300)] border-t-[var(--brand-700)]" />
                      Subiendo…
                    </span>
                  ) : onUploadReceipt ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => onUploadReceipt(item.id)}
                    >
                      <Upload className="mr-1 h-3 w-3" aria-hidden="true" />
                      Subir comprobante
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
