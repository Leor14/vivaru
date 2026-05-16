"use client";

import { AlertCircle, CheckCircle2, Clock, TrendingUp } from "lucide-react";

import type { BillingStatement } from "@/types/domain";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveOverallStatus(items: BillingStatement[]): "paid" | "pending" | "overdue" {
  if (items.some((s) => s.status === "overdue")) return "overdue";
  if (items.some((s) => s.status === "pending")) return "pending";
  return "paid";
}

function formatPeriod(period: string): string {
  // "YYYY-MM" → "Ene 2025"
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("es-MX", { month: "short", year: "numeric" });
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
    sublabel: "No tienes saldos pendientes",
    icon: CheckCircle2,
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    iconColor: "text-emerald-600",
    pillBg: "bg-emerald-100",
    pillText: "text-emerald-800",
  },
  pending: {
    label: "Pago pendiente",
    sublabel: "Tienes cuotas por pagar",
    icon: Clock,
    bg: "bg-amber-50",
    border: "border-amber-200",
    iconColor: "text-amber-600",
    pillBg: "bg-amber-100",
    pillText: "text-amber-800",
  },
  overdue: {
    label: "Saldo vencido",
    sublabel: "Tienes cuotas con fecha vencida",
    icon: AlertCircle,
    bg: "bg-red-50",
    border: "border-red-200",
    iconColor: "text-red-600",
    pillBg: "bg-red-100",
    pillText: "text-red-800",
  },
} as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface BillingHeroCardProps {
  items: BillingStatement[];
  formatAmount: (n: number) => string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BillingHeroCard({ items, formatAmount }: BillingHeroCardProps) {
  if (items.length === 0) return null;

  const overallStatus = deriveOverallStatus(items);
  const config = STATUS_CONFIG[overallStatus];
  const StatusIcon = config.icon;

  // Aggregates
  const totalPendingBalance = items
    .filter((s) => s.status !== "paid")
    .reduce((sum, s) => sum + (s.balance ?? 0), 0);

  const totalCharged = items.reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const totalPaid = items.reduce((sum, s) => sum + (s.paymentAmount ?? 0), 0);
  const paidMonths = items.filter((s) => s.status === "paid").length;

  // Next due date: earliest dueDate among pending/overdue statements
  const upcomingDue = items
    .filter((s) => s.status !== "paid" && s.dueDate)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0];

  // Most recent overdue period label for context
  const mostRecentPendingPeriod = items
    .filter((s) => s.status !== "paid")
    .sort((a, b) => (a.period > b.period ? -1 : 1))[0];

  return (
    <div
      className={`rounded-xl border ${config.border} ${config.bg} p-4 sm:p-5`}
    >
      {/* ── Header row ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm`}>
            <StatusIcon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--slate-900)]">{config.label}</p>
            <p className="text-xs text-[var(--slate-500)]">{config.sublabel}</p>
          </div>
        </div>

        {/* Status pill */}
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.pillBg} ${config.pillText}`}
        >
          {overallStatus === "paid"
            ? `${paidMonths} ${paidMonths === 1 ? "mes al día" : "meses al día"}`
            : mostRecentPendingPeriod
              ? formatPeriod(mostRecentPendingPeriod.period)
              : ""}
        </span>
      </div>

      {/* ── Metrics row ── */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {/* Saldo pendiente */}
        <div className="rounded-lg bg-white/70 px-3 py-2.5 shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--slate-500)]">
            Saldo pendiente
          </p>
          <p className={`mt-0.5 text-lg font-bold ${overallStatus === "paid" ? "text-emerald-600" : "text-[var(--slate-900)]"}`}>
            {overallStatus === "paid" ? "—" : formatAmount(totalPendingBalance)}
          </p>
        </div>

        {/* Próximo vencimiento */}
        <div className="rounded-lg bg-white/70 px-3 py-2.5 shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--slate-500)]">
            Próximo vencimiento
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--slate-900)]">
            {upcomingDue?.dueDate ? formatDate(upcomingDue.dueDate) : "—"}
          </p>
        </div>

        {/* Total pagado */}
        <div className="col-span-2 rounded-lg bg-white/70 px-3 py-2.5 shadow-sm sm:col-span-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--slate-500)]">
            Total pagado
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <p className="text-sm font-semibold text-[var(--slate-900)]">
              {formatAmount(totalPaid)}
            </p>
          </div>
          {totalCharged > 0 && (
            <p className="mt-0.5 text-[10px] text-[var(--slate-400)]">
              de {formatAmount(totalCharged)} cobrado
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
