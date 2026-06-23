"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import * as XLSX from "xlsx";
import { BarChart2, Download, FileSpreadsheet, Printer } from "lucide-react";

import { TablePager } from "@/components/shared/table-pager";
import { usePagination } from "@/components/shared/use-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import {
  useCommitteeReport,
  periodToDateRange,
  formatPeriodLabel,
  type ReportPeriodKey,
  type DateRange,
} from "@/features/reports/use-committee-report";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";

// ─── Period chips ─────────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { key: ReportPeriodKey; label: string }[] = [
  { key: "this_month",    label: "Este mes" },
  { key: "last_month",    label: "Mes pasado" },
  { key: "last_3_months", label: "Últimos 3 meses" },
  { key: "last_quarter",  label: "Último trimestre" },
  { key: "custom",        label: "Personalizado" },
];

const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981"];
const BAR_COLOR = "#6366f1";

// ─── Small helpers ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  tone = "neutral",
  delta,
  deltaSuffix = "%",
  deltaGoodWhenUp = true,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "neutral" | "danger" | "success";
  delta?: number | null;
  deltaSuffix?: string;
  deltaGoodWhenUp?: boolean;
}) {
  const textColor =
    tone === "danger" ? "text-[var(--danger-700)]" :
    tone === "success" ? "text-emerald-700" :
    "text-[var(--slate-900)]";
  const showDelta = delta !== undefined && delta !== null && delta !== 0;
  const deltaGood = showDelta ? (delta! > 0) === deltaGoodWhenUp : false;
  return (
    <div className="rounded-xl border border-[var(--slate-200)] bg-white p-4 print:border-[var(--slate-300)]">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--slate-500)]">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${textColor}`}>
        {value}
        {showDelta ? (
          <span className={`ml-1.5 align-middle text-xs font-semibold ${deltaGood ? "text-emerald-600" : "text-[var(--danger-700)]"}`}>
            {delta! > 0 ? "▲" : "▼"}{Math.abs(delta!)}{deltaSuffix}
          </span>
        ) : null}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-[var(--slate-500)]">{sub}</p> : null}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--slate-500)] print:text-xs">
      {children}
    </h2>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SectionLoading() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-[68px] animate-pulse rounded-2xl border border-[var(--slate-200)] bg-[var(--slate-50)]" />
      ))}
    </div>
  );
}

export default function AdminReportsPage() {
  const { user } = useAuth();
  const { formatAmount: formatCurrency } = useTenantCurrency();

  const [periodKey, setPeriodKey] = useState<ReportPeriodKey>("last_month");
  const [customRange, setCustomRange] = useState<DateRange>({
    start: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 10),
    end: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().slice(0, 10),
  });

  const range = useMemo(
    () => periodToDateRange(periodKey, customRange),
    [periodKey, customRange],
  );

  const report = useCommitteeReport(user?.tenantId, range);
  const periodLabel = useMemo(() => formatPeriodLabel(range), [range]);

  // Logo del conjunto para el encabezado del informe (R5).
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.tenantId || !db) return;
    return onSnapshot(doc(db, "tenants", user.tenantId), (snap) => {
      const url = (snap.data()?.branding as { logoUrl?: string } | undefined)?.logoUrl;
      setLogoUrl(typeof url === "string" && url ? url : null);
    });
  }, [user?.tenantId]);

  const generatedAt = useMemo(
    () => new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }),
    [],
  );
  const overduePager = usePagination(report?.billing.overdueUnits ?? []);
  const printRef = useRef<HTMLDivElement>(null);

  // ── Resumen ejecutivo: narrativa + alertas (R2) ─────────────────────────────
  const execSummary = useMemo(() => {
    const e = report.executive;
    const f = report.financial;
    const b = report.billing;
    const t = report.tickets;
    const a = report.agreements;
    const fmt = formatCurrency;
    const dPP = (v: number | null) => (v != null && v !== 0 ? ` (${v > 0 ? "+" : ""}${v} pp vs. período anterior)` : "");
    const dPct = (v: number | null) => (v != null && v !== 0 ? ` (${v > 0 ? "+" : ""}${v}% vs. anterior)` : "");

    const bullets: string[] = [];
    bullets.push(`Recaudo del ${e.collectionRate}% de lo facturado${dPP(e.collectionRateDelta)}.`);
    if (b.overdueUnits.length > 0) bullets.push(`${b.overdueUnits.length} unidad(es) con saldo vencido por ${fmt(b.totalOverdue)} (morosidad ${e.delinquencyRate}%).`);
    bullets.push(`Resultado neto: ${fmt(f.netResult)}${dPct(e.netResultDelta)}.`);
    if (e.reserveMonths != null) bullets.push(`Fondo de reserva: ${fmt(f.fundBalance)} (~${e.reserveMonths} meses de gastos).`);
    if (t.total > 0) bullets.push(`${t.total} PQRS: ${t.resolved} resuelto(s) (${e.pqrsResolutionRate}%), ${t.open} abierto(s).`);
    if (a.forSignature > 0) bullets.push(`${a.forSignature} acuerdo(s) de firma: ${a.signatureRate}% firmado, ${a.pending} pendiente(s).`);

    const alerts: { text: string; tone: "danger" | "warn" }[] = [];
    if (f.netResult < 0) alerts.push({ text: "Resultado neto negativo en el período.", tone: "danger" });
    if (e.delinquencyRate > 15) alerts.push({ text: `Morosidad del ${e.delinquencyRate}% (supera el 15%).`, tone: "danger" });
    if (e.reserveMonths != null && e.reserveMonths < 3) alerts.push({ text: `El fondo cubre solo ${e.reserveMonths} mes(es) de gastos (< 3).`, tone: "danger" });
    if (t.open > 0) alerts.push({ text: `${t.open} PQRS abierto(s) sin resolver.`, tone: "warn" });
    if (a.pending > 0) alerts.push({ text: `${a.pending} firma(s) de acuerdos pendiente(s).`, tone: "warn" });

    return { bullets, alerts };
  }, [report, formatCurrency]);

  // ── Antigüedad de cartera (aging) por nº de períodos en mora (R3) ───────────
  const aging = useMemo(() => {
    const buckets = [
      { key: "1", label: "1 período", min: 1, max: 1, units: 0, amount: 0 },
      { key: "2-3", label: "2–3 períodos", min: 2, max: 3, units: 0, amount: 0 },
      { key: "4+", label: "4+ períodos", min: 4, max: Infinity, units: 0, amount: 0 },
    ];
    for (const u of report.billing.overdueUnits) {
      const bk = buckets.find((b) => u.periods >= b.min && u.periods <= b.max);
      if (bk) {
        bk.units += 1;
        bk.amount += u.balance;
      }
    }
    return buckets;
  }, [report.billing.overdueUnits]);

  // ── Excel export ─────────────────────────────────────────────────────────────
  const handleExcelExport = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // Resumen sheet
    const resumenData = [
      ["Reporte de Comité — " + periodLabel],
      [],
      ["RESUMEN EJECUTIVO"],
      ...execSummary.bullets.map((b) => [b]),
      [],
      ["REQUIERE ATENCIÓN DEL COMITÉ"],
      ...(execSummary.alerts.length === 0 ? [["Sin alertas."]] : execSummary.alerts.map((a) => [a.text])),
      [],
      ["TABLERO EJECUTIVO"],
      ["% de recaudo", `${report.executive.collectionRate}%`],
      ["Resultado neto", report.financial.netResult],
      ["Índice de morosidad", `${report.executive.delinquencyRate}%`],
      ["Meses de fondo de reserva", report.executive.reserveMonths ?? "—"],
      ["Resolución de PQRS", `${report.executive.pqrsResolutionRate}%`],
      ["% de firma de acuerdos", `${report.agreements.signatureRate}%`],
      [],
      ["RESUMEN FINANCIERO"],
      ["Ingresos del período", report.financial.totalIncome],
      ["Egresos del período", report.financial.totalExpenses],
      ["Resultado neto", report.financial.netResult],
      ["Saldo de fondos", report.financial.fundBalance],
      [],
      ["CARTERA"],
      ["Cobrado en período", report.billing.totalCollected],
      ["Total vencido", report.billing.totalOverdue],
      ["Pagadas", report.billing.paidCount],
      ["Pendientes", report.billing.pendingCount],
      ["Vencidas", report.billing.overdueCount],
      [],
      ["ANTIGÜEDAD DE LA MORA"],
      ...aging.map((bk) => [bk.label, bk.amount, `${bk.units} unidad(es)`]),
      [],
      ["PAQUETERÍA"],
      ["Recibidos en período", report.packages.totalReceived],
      ["Entregados en período", report.packages.totalDelivered],
      ["Pendientes de entrega", report.packages.stillPending],
      [],
      ["PQRS"],
      ["Total radicados", report.tickets.total],
      ["Abiertos", report.tickets.open],
      ["En proceso", report.tickets.inProgress],
      ["Resueltos", report.tickets.resolved],
      [],
      ["VISITANTES"],
      ["Total en período", report.visitors.total],
      ["Actualmente dentro", report.visitors.insideNow],
      [],
      ["RESERVACIONES"],
      ["Total en período", report.reservations.total],
      ["Aprobadas", report.reservations.approved],
      ["Pendientes", report.reservations.pending],
      ["Canceladas", report.reservations.cancelled],
      [],
      ["ACUERDOS DE COMITÉ"],
      ["Acuerdos del período", report.agreements.total],
      ["De firma", report.agreements.forSignature],
      ["Informativos", report.agreements.informative],
      ["Firmas esperadas", report.agreements.expectedSignatures],
      ["Firmas registradas", report.agreements.signed],
      ["Firmas pendientes", report.agreements.pending],
      ["% de firma", `${report.agreements.signatureRate}%`],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumenData), "Resumen");

    // Egresos por categoría sheet
    if (report.financial.expenseByCategory.length > 0) {
      const finData = [["Categoría", "Egreso"],
        ...report.financial.expenseByCategory.map((c) => [c.label, c.amount])];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(finData), "Egresos");
    }

    // Cartera vencida sheet
    if (report.billing.overdueUnits.length > 0) {
      const cartData = [["Unidad", "Saldo vencido", "Períodos con mora"],
        ...report.billing.overdueUnits.map((u) => [u.unitLabel, u.balance, u.periods])];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cartData), "Cartera vencida");
    }

    // Visitantes por semana sheet
    if (report.visitors.byWeek.length > 0) {
      const visData = [["Semana", "Visitantes"],
        ...report.visitors.byWeek.map((w) => [w.label, w.count])];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(visData), "Visitantes");
    }

    // PQRS por categoría sheet
    const pqrsData = [
      ["Categoría", "Total"],
      ["PQRS", report.tickets.byCategory.pqrs],
      ["Mantenimiento", report.tickets.byCategory.maintenance],
      ["Cartera", report.tickets.byCategory.billing],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pqrsData), "PQRS");

    // Reservaciones por amenidad
    if (report.reservations.byAmenity.length > 0) {
      const resData = [["Amenidad", "Reservaciones"],
        ...report.reservations.byAmenity.map((r) => [r.amenity, r.count])];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resData), "Reservaciones");
    }

    // Acuerdos de firma — estado por acuerdo
    const agForSig = report.agreements.items.filter((a) => a.forSignature);
    if (agForSig.length > 0) {
      const agData = [["Acuerdo", "Firmado", "Esperado", "Pendientes", "%"],
        ...agForSig.map((a) => [a.title, a.signed, a.expected, a.pending, `${a.rate}%`])];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(agData), "Acuerdos");
    }

    XLSX.writeFile(wb, `Reporte-Comite-${range.start}-${range.end}.xlsx`);
  }, [report, periodLabel, range, execSummary, aging]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ── Ticket pie data ───────────────────────────────────────────────────────
  const ticketPieData = [
    { name: "Abiertos", value: report.tickets.open },
    { name: "En proceso", value: report.tickets.inProgress },
    { name: "Resueltos", value: report.tickets.resolved },
  ].filter((d) => d.value > 0);

  return (
    <>
      {/* Print styles — injected globally via <style> */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #committee-report, #committee-report * { visibility: visible; }
          #committee-report { position: absolute; inset: 0; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="space-y-6 pb-10">
        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4 no-print">
          <div>
            <div className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-[var(--brand-700)]" />
              <h1 className="text-xl font-semibold text-[var(--slate-900)]">Reporte de Comité</h1>
            </div>
            <p className="mt-1 text-sm text-[var(--slate-500)]">
              Selecciona el período y descarga el reporte para tu presentación.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExcelExport} disabled={report.loading}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={report.loading}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir / PDF
            </Button>
          </div>
        </div>

        {/* ── Period selector ── */}
        <Card className="p-4 no-print">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--slate-500)]">Período del reporte</p>
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPeriodKey(opt.key)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  periodKey === opt.key
                    ? "border-[var(--brand-700)] bg-[var(--brand-700)] text-white"
                    : "border-[var(--slate-200)] bg-white text-[var(--slate-600)] hover:bg-[var(--slate-50)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {periodKey === "custom" ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-sm text-[var(--slate-700)]">
                Desde
                <input
                  type="date"
                  value={customRange.start}
                  max={customRange.end}
                  onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))}
                  className="ml-2 rounded-lg border border-[var(--slate-300)] px-2 py-1 text-sm"
                />
              </label>
              <label className="text-sm text-[var(--slate-700)]">
                Hasta
                <input
                  type="date"
                  value={customRange.end}
                  min={customRange.start}
                  onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))}
                  className="ml-2 rounded-lg border border-[var(--slate-300)] px-2 py-1 text-sm"
                />
              </label>
            </div>
          ) : null}
        </Card>

        {/* ── Report body (printable) ── */}
        <div id="committee-report" ref={printRef}>
          {/* Print header (informe formal, R5) */}
          <div className="mb-6 hidden items-center justify-between border-b border-[var(--slate-200)] pb-4 print:flex">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-12 w-12 rounded object-contain" />
              ) : null}
              <div>
                <p className="text-lg font-bold text-[var(--slate-900)]">{user?.tenantName ?? "Conjunto"}</p>
                <p className="text-sm text-[var(--slate-600)]">Reporte de Comité · {periodLabel}</p>
              </div>
            </div>
            <div className="text-right text-xs text-[var(--slate-500)]">
              <p>Generado: {generatedAt}</p>
              {user?.fullName ? <p>Preparado por: {user.fullName}</p> : null}
            </div>
          </div>

          <div className="space-y-6">

              {/* ── Período label ── */}
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-[var(--slate-800)]">{periodLabel}</span>
                <span className="rounded-full bg-[var(--brand-50)] px-2.5 py-0.5 text-xs font-medium text-[var(--brand-700)]">
                  {range.start} → {range.end}
                </span>
              </div>

              {report.sectionLoading.financial ? (
                <SectionLoading />
              ) : (
                <>
              {/* ── Resumen ejecutivo ── */}
              <section>
                <SectionTitle>📝 Resumen ejecutivo</SectionTitle>
                <div className="rounded-xl border border-[var(--slate-200)] bg-white p-4">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--slate-700)]">
                    {execSummary.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                  <div className="mt-3 border-t border-[var(--slate-100)] pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Requiere atención del comité</p>
                    {execSummary.alerts.length === 0 ? (
                      <p className="mt-1 text-sm text-emerald-700">✓ Sin alertas para el comité.</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {execSummary.alerts.map((a, i) => (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${a.tone === "danger" ? "bg-red-50 text-[var(--danger-700)]" : "bg-amber-50 text-amber-700"}`}
                          >
                            {a.tone === "danger" ? "⛔" : "⚠️"} {a.text}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* ── Tablero ejecutivo ── */}
              <section>
                <SectionTitle>⭐ Tablero ejecutivo</SectionTitle>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <KpiCard label="% de recaudo" value={`${report.executive.collectionRate}%`} delta={report.executive.collectionRateDelta} deltaSuffix=" pp" />
                  <KpiCard label="Resultado neto" value={formatCurrency(report.financial.netResult)} tone={report.financial.netResult >= 0 ? "success" : "danger"} delta={report.executive.netResultDelta} deltaSuffix="%" />
                  <KpiCard label="Morosidad" value={`${report.executive.delinquencyRate}%`} tone={report.executive.delinquencyRate > 15 ? "danger" : "neutral"} sub={`${report.billing.overdueUnits.length}/${report.executive.activeUnits} unidades`} deltaGoodWhenUp={false} />
                  <KpiCard label="Meses de fondo" value={report.executive.reserveMonths === null ? "—" : `${report.executive.reserveMonths}`} tone={report.executive.reserveMonths !== null && report.executive.reserveMonths < 3 ? "danger" : "success"} sub="reserva ÷ egreso mensual" />
                  <KpiCard label="Resolución PQRS" value={`${report.executive.pqrsResolutionRate}%`} tone={report.executive.pqrsResolutionRate >= 70 ? "success" : "neutral"} />
                  <KpiCard label="% de firma" value={`${report.agreements.signatureRate}%`} tone={report.agreements.signatureRate >= 80 ? "success" : "neutral"} />
                </div>
                <p className="mt-2 text-xs text-[var(--slate-500)]">▲▼ comparado con el período anterior equivalente. Morosidad = unidades con saldo vencido sobre unidades activas; meses de fondo = saldo de reserva ÷ egreso mensual promedio.</p>
              </section>

              {/* ── Resumen financiero ── */}
              <section>
                <SectionTitle>📊 Resumen financiero</SectionTitle>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <KpiCard label="Ingresos del período" value={formatCurrency(report.financial.totalIncome)} tone="success" />
                  <KpiCard label="Egresos del período" value={formatCurrency(report.financial.totalExpenses)} tone={report.financial.totalExpenses > 0 ? "danger" : "neutral"} />
                  <KpiCard label="Resultado neto" value={formatCurrency(report.financial.netResult)} tone={report.financial.netResult >= 0 ? "success" : "danger"} />
                  <KpiCard label="Saldo de fondos" value={formatCurrency(report.financial.fundBalance)} />
                </div>
                {report.financial.expenseByCategory.length > 0 ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-[var(--slate-200)] bg-white">
                    <div className="border-b border-[var(--slate-100)] px-4 py-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Egresos por categoría</p>
                    </div>
                    <div className="divide-y divide-[var(--slate-50)]">
                      {report.financial.expenseByCategory.map((c) => (
                        <div key={c.category} className="flex items-center justify-between px-4 py-2 text-sm">
                          <span className="text-[var(--slate-700)]">{c.label}</span>
                          <span className="font-semibold text-[var(--slate-900)]">{formatCurrency(c.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>

              {/* ── Cartera ── */}
              <section>
                <SectionTitle>💰 Cartera</SectionTitle>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <KpiCard label="Cobrado" value={formatCurrency(report.billing.totalCollected)} tone="success" />
                  <KpiCard label="Total vencido" value={formatCurrency(report.billing.totalOverdue)} tone={report.billing.totalOverdue > 0 ? "danger" : "neutral"} />
                  <KpiCard label="Cuotas pagadas" value={report.billing.paidCount} />
                  <KpiCard label="Pendientes" value={report.billing.pendingCount} />
                  <KpiCard label="Vencidas" value={report.billing.overdueCount} tone={report.billing.overdueCount > 0 ? "danger" : "neutral"} />
                </div>

                {report.billing.overdueUnits.length > 0 ? (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Antigüedad de la mora</p>
                    <div className="grid grid-cols-3 gap-3">
                      {aging.map((bk) => {
                        const chronic = bk.key === "4+" && bk.units > 0;
                        return (
                          <div key={bk.key} className={`rounded-xl border p-3 ${chronic ? "border-red-300 bg-red-50" : "border-[var(--slate-200)] bg-white"}`}>
                            <p className="text-xs text-[var(--slate-500)]">{bk.label}</p>
                            <p className={`mt-0.5 text-lg font-bold ${chronic ? "text-[var(--danger-700)]" : "text-[var(--slate-900)]"}`}>{formatCurrency(bk.amount)}</p>
                            <p className="text-xs text-[var(--slate-500)]">{bk.units} unidad(es)</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {report.billing.overdueUnits.length > 0 ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-[var(--slate-200)] bg-white">
                    <div className="border-b border-[var(--slate-100)] px-4 py-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Mayores deudores (por saldo)</p>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--slate-100)] bg-[var(--slate-50)]">
                          <th className="px-4 py-2 text-left text-xs font-medium text-[var(--slate-500)]">Unidad</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-[var(--slate-500)]">Saldo vencido</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-[var(--slate-500)]">Períodos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overduePager.pageItems.map((u) => (
                          <tr key={u.unitId} className="border-b border-[var(--slate-50)] last:border-0">
                            <td className="px-4 py-2 text-[var(--slate-800)]">{u.unitLabel}</td>
                            <td className="px-4 py-2 text-right font-medium text-[var(--danger-700)]">{formatCurrency(u.balance)}</td>
                            <td className={`px-4 py-2 text-right ${u.periods >= 4 ? "font-semibold text-[var(--danger-700)]" : "text-[var(--slate-500)]"}`}>
                              {u.periods}
                              {u.periods >= 4 ? <span className="ml-1 rounded bg-red-100 px-1 text-[10px] font-medium text-[var(--danger-700)]">crónico</span> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {overduePager.hasPagination ? (
                      <div className="px-4 pb-3">
                        <TablePager
                          page={overduePager.page}
                          totalPages={overduePager.totalPages}
                          total={overduePager.total}
                          start={overduePager.start}
                          pageSize={overduePager.pageSize}
                          onPrev={overduePager.prev}
                          onNext={overduePager.next}
                          onPageSizeChange={overduePager.setPageSize}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-emerald-700">✓ Sin unidades con saldo vencido en este período.</p>
                )}
              </section>
                </>
              )}

              {report.sectionLoading.visitors ||
              report.sectionLoading.tickets ||
              report.sectionLoading.packages ||
              report.sectionLoading.reservations ? (
                <SectionLoading />
              ) : (
                <>
              {/* ── Visitantes ── */}
              <section>
                <SectionTitle>🏠 Visitantes</SectionTitle>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <KpiCard label="Total en período" value={report.visitors.total} />
                  <KpiCard label="Actualmente dentro" value={report.visitors.insideNow} />
                </div>

                {report.visitors.byWeek.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-[var(--slate-200)] bg-white p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Ingresos por semana</p>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={report.visitors.byWeek} barSize={24}>
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                          <Tooltip
                            contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                            cursor={{ fill: "#f1f5f9" }}
                          />
                          <Bar dataKey="count" name="Visitantes" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[var(--slate-500)]">Sin visitas registradas en este período.</p>
                )}
              </section>

              {/* ── PQRS ── */}
              <section>
                <SectionTitle>📋 PQRS y Soporte</SectionTitle>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <KpiCard label="Total radicados" value={report.tickets.total} />
                  <KpiCard label="Abiertos" value={report.tickets.open} tone={report.tickets.open > 0 ? "danger" : "neutral"} />
                  <KpiCard label="En proceso" value={report.tickets.inProgress} />
                  <KpiCard label="Resueltos" value={report.tickets.resolved} tone={report.tickets.resolved > 0 ? "success" : "neutral"} />
                </div>

                {ticketPieData.length > 0 ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-[var(--slate-200)] bg-white p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Por estado</p>
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={ticketPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                              {ticketPieData.map((_, i) => (
                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--slate-200)] bg-white p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Por categoría</p>
                      <div className="space-y-2">
                        {[
                          { label: "PQRS", count: report.tickets.byCategory.pqrs },
                          { label: "Mantenimiento", count: report.tickets.byCategory.maintenance },
                          { label: "Cartera", count: report.tickets.byCategory.billing },
                        ].map((c) => (
                          <div key={c.label} className="flex items-center justify-between text-sm">
                            <span className="text-[var(--slate-700)]">{c.label}</span>
                            <span className="font-semibold text-[var(--slate-900)]">{c.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>

              {/* ── Paquetería ── */}
              <section>
                <SectionTitle>📦 Paquetería</SectionTitle>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <KpiCard label="Recibidos en período" value={report.packages.totalReceived} />
                  <KpiCard label="Entregados en período" value={report.packages.totalDelivered} tone="success" />
                  <KpiCard label="Pendientes de entrega" value={report.packages.stillPending} tone={report.packages.stillPending > 0 ? "danger" : "neutral"} />
                </div>
              </section>

              {/* ── Reservaciones ── */}
              <section>
                <SectionTitle>📅 Reservaciones</SectionTitle>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <KpiCard label="Total" value={report.reservations.total} />
                  <KpiCard label="Aprobadas" value={report.reservations.approved} tone="success" />
                  <KpiCard label="Pendientes" value={report.reservations.pending} />
                  <KpiCard label="Canceladas" value={report.reservations.cancelled} />
                </div>

                {report.reservations.byAmenity.length > 0 ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-[var(--slate-200)] bg-white">
                    <div className="border-b border-[var(--slate-100)] px-4 py-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Por amenidad</p>
                    </div>
                    <div className="divide-y divide-[var(--slate-50)]">
                      {report.reservations.byAmenity.map((r) => (
                        <div key={r.amenity} className="flex items-center justify-between px-4 py-2 text-sm">
                          <span className="text-[var(--slate-700)]">{r.amenity}</span>
                          <span className="font-semibold text-[var(--slate-900)]">{r.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
                </>
              )}

              {report.sectionLoading.agreements ? (
                <SectionLoading />
              ) : report.agreements.total > 0 ? (
                <section>
                  <SectionTitle>🤝 Acuerdos de comité</SectionTitle>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <KpiCard label="Acuerdos del período" value={report.agreements.total} />
                    <KpiCard label="De firma" value={report.agreements.forSignature} />
                    <KpiCard
                      label="% de firma"
                      value={`${report.agreements.signatureRate}%`}
                      tone={report.agreements.signatureRate >= 80 ? "success" : "neutral"}
                    />
                    <KpiCard
                      label="Firmas pendientes"
                      value={report.agreements.pending}
                      tone={report.agreements.pending > 0 ? "danger" : "neutral"}
                    />
                  </div>

                  {report.agreements.items.filter((a) => a.forSignature).length > 0 ? (
                    <div className="mt-4 overflow-hidden rounded-xl border border-[var(--slate-200)] bg-white">
                      <div className="border-b border-[var(--slate-100)] px-4 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Estado de firma por acuerdo</p>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--slate-100)] bg-[var(--slate-50)]">
                            <th className="px-4 py-2 text-left text-xs font-medium text-[var(--slate-500)]">Acuerdo</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-[var(--slate-500)]">Firmado</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-[var(--slate-500)]">Pendientes</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-[var(--slate-500)]">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.agreements.items.filter((a) => a.forSignature).map((a) => (
                            <tr key={a.id} className="border-b border-[var(--slate-50)] last:border-0">
                              <td className="px-4 py-2 text-[var(--slate-800)]">{a.title}</td>
                              <td className="px-4 py-2 text-right text-[var(--slate-600)]">{a.signed}/{a.expected}</td>
                              <td className={`px-4 py-2 text-right font-medium ${a.pending > 0 ? "text-[var(--danger-700)]" : "text-emerald-700"}`}>
                                {a.pending > 0 ? a.pending : "✓"}
                              </td>
                              <td className="px-4 py-2 text-right text-[var(--slate-500)]">{a.rate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {/* ── Aprobación del comité (informe formal, R5) ── */}
              <section className="mt-2 border-t border-[var(--slate-200)] pt-6">
                <SectionTitle>✍️ Aprobación del comité</SectionTitle>
                <p className="text-sm text-[var(--slate-600)]">
                  El comité revisó y aprueba el presente reporte del período <strong>{periodLabel}</strong>.
                </p>
                <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3">
                  {["Presidente", "Tesorero / Secretario", "Administrador"].map((role) => (
                    <div key={role} className="text-center">
                      <div className="border-t border-[var(--slate-400)] pt-1 text-xs font-medium text-[var(--slate-700)]">{role}</div>
                      <div className="mt-0.5 text-[10px] text-[var(--slate-400)]">Nombre, firma y fecha</div>
                    </div>
                  ))}
                </div>
              </section>

            </div>
        </div>

        {/* ── Bottom export bar (mobile-friendly) ── */}
        <div className="flex flex-wrap justify-end gap-2 no-print">
          <Button variant="outline" onClick={handleExcelExport} disabled={report.loading}>
            <Download className="mr-2 h-4 w-4" />
            Descargar Excel
          </Button>
          <Button onClick={handlePrint} disabled={report.loading}>
            <Printer className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>
    </>
  );
}
