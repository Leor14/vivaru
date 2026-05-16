"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Clock, FileText, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/shared/help-tip";
import type { BillingStatement } from "@/types/domain";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  paid: {
    label: "Al día",
    badgeCls: "bg-emerald-50 text-emerald-700",
    dotCls: "bg-emerald-500",
    borderCls: "border-[var(--slate-200)]",
    headerBg: "",
  },
  pending: {
    label: "Pendiente",
    badgeCls: "bg-amber-50 text-amber-700",
    dotCls: "bg-amber-400",
    borderCls: "border-[var(--slate-200)]",
    headerBg: "",
  },
  overdue: {
    label: "Vencido",
    badgeCls: "bg-red-50 text-red-700",
    dotCls: "bg-red-500",
    borderCls: "border-red-200",
    headerBg: "bg-red-50/40",
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
  /** Placeholder for F2: receipt status for this period */
  receiptStatus?: "pending" | "approved" | "rejected" | null;
  defaultOpen?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BillingPeriodCard({
  item,
  formatAmount,
  onUploadReceipt,
  receiptStatus = null,
  defaultOpen = false,
}: BillingPeriodCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const config = STATUS_CONFIG[item.status];
  const ChevronIcon = open ? ChevronDown : ChevronRight;

  const hasDebt = item.status !== "paid";
  const periodLabel = formatPeriod(item.period);

  return (
    <div
      className={`overflow-hidden rounded-xl border ${config.borderCls} bg-white transition-shadow hover:shadow-sm`}
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
          {item.dueDate && hasDebt && (
            <p className="flex items-center gap-1 text-xs text-[var(--slate-500)]">
              <Clock className="h-3 w-3" aria-hidden="true" />
              Vence {formatDate(item.dueDate)}
            </p>
          )}
        </div>

        {/* Balance + badge */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-bold text-[var(--slate-900)]">
              {formatAmount(item.balance)}
            </p>
          </div>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${config.badgeCls}`}>
            {config.label}
          </span>
          <ChevronIcon className="h-4 w-4 shrink-0 text-[var(--slate-400)]" aria-hidden="true" />
        </div>
      </button>

      {/* ── Expanded detail ── */}
      {open && (
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
                valueClass="text-emerald-700"
                helpText="Es el valor que ya quedó registrado como recibido por la administración en este período. Si acabas de pagar, puede tardar unos días en reflejarse."
              />
            )}
            <DetailRow
              label="Saldo pendiente"
              value={formatAmount(item.balance)}
              valueClass={item.balance > 0 ? (item.status === "overdue" ? "text-red-600" : "text-amber-600") : "text-emerald-600"}
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

          {/* ── Comprobante section ── */}
          <div className="mt-3 rounded-lg border border-dashed border-[var(--slate-200)] bg-[var(--slate-50)] px-3 py-2.5">
            {receiptStatus === "approved" && (
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                <span className="text-xs font-medium text-emerald-700">Comprobante aprobado</span>
              </div>
            )}
            {receiptStatus === "pending" && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                <span className="text-xs font-medium text-amber-700">Comprobante en revisión</span>
              </div>
            )}
            {receiptStatus === "rejected" && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                  <span className="text-xs font-medium text-red-700">Comprobante rechazado — sube uno nuevo</span>
                </div>
                {onUploadReceipt && (
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
                )}
              </div>
            )}
            {receiptStatus === null && hasDebt && onUploadReceipt && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--slate-500)]">Sin comprobante adjunto</span>
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
              </div>
            )}
            {receiptStatus === null && !hasDebt && (
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-[var(--slate-400)]" aria-hidden="true" />
                <span className="text-xs text-[var(--slate-400)]">Período pagado sin comprobante pendiente</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
