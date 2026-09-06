"use client";

import { ModulePreviewGate } from "@/components/shared/module-preview-gate";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { toast } from "sonner";
import { createDocumentRecord } from "@/features/admin/services";
import { ensureSystemFolderCallable } from "@/lib/firebase/callables";
import { toastFirebaseError } from "@/lib/utils/error-handler";
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
  ComposedChart,
  Line,
  CartesianGrid,
} from "recharts";
import * as XLSX from "xlsx";
import { AlertTriangle, BarChart2, Download, FileSpreadsheet, FolderPlus, Printer } from "lucide-react";

import { InformeMensualCard } from "@/components/features/finanzas/InformeMensualCard";
import { TablePager } from "@/components/shared/table-pager";
import { usePagination } from "@/components/shared/use-pagination";
import { WidgetErrorBoundary } from "@/components/shared/widget-error-boundary";
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
import { useFeatureFlag } from "@/lib/feature-flags/provider";
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
const CARTERA_COLORS = ["#10b981", "#f59e0b", "#ef4444"]; // al día / pendiente / vencida
const EXPENSE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#0ea5e9", "#a855f7", "#64748b"];
// Paleta propia para los ingresos: si compartieran la de egresos, dos porciones
// del mismo color en dos tortas contiguas se leerían como el mismo rubro.
const INCOME_COLORS = ["#2f775f", "#0ea5e9", "#a855f7", "#f59e0b", "#14b8a6", "#6366f1", "#64748b"];
const BAR_COLOR = "#6366f1";
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function monthShort(period: string): string {
  const m = parseInt(period.slice(5, 7), 10);
  return MONTHS_SHORT[m - 1] ?? period;
}

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
    tone === "success" ? "text-[var(--success-700)]" :
    "text-[var(--slate-900)]";
  const showDelta = delta !== undefined && delta !== null && delta !== 0;
  const deltaGood = showDelta ? (delta! > 0) === deltaGoodWhenUp : false;
  return (
    <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4 print:border-[var(--slate-300)]">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--slate-500)]">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${textColor}`}>
        {value}
        {showDelta ? (
          <span className={`ml-1.5 align-middle text-xs font-semibold ${deltaGood ? "text-[var(--success-600)]" : "text-[var(--danger-700)]"}`}>
            {delta! > 0 ? "▲" : "▼"}{Math.abs(delta!)}{deltaSuffix}
          </span>
        ) : null}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-[var(--slate-500)]">{sub}</p> : null}
    </div>
  );
}

/**
 * Tooltip del gráfico de recaudo — **existe para que la línea y las barras dejen
 * de contradecirse.**
 *
 * Las barras son `facturado` y `recaudado`; la línea es el «% recaudo», que desde
 * `FLOW-002` R16 mide **liquidación** y no ingreso. Un mes en el que una unidad
 * cubre su cuota con un anticipo de otro mes deja la barra verde corta y la línea
 * al 100 %, y con el tooltip por defecto no había forma de entender por qué. Se
 * enseña lo saldado con anticipos **solo cuando los dos números se separan**:
 * repetir dos cifras iguales invita a buscarles la diferencia.
 */
function RecaudoTooltip({
  active,
  payload,
  label,
  formatCurrency,
}: {
  active?: boolean;
  payload?: Array<{ payload: { facturado: number; recaudado: number; liquidado: number; collectionRate: number } }>;
  label?: string;
  formatCurrency: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const { facturado, recaudado, liquidado, collectionRate } = payload[0].payload;
  const pendiente = Math.max(facturado - liquidado, 0);
  return (
    <div className="rounded-lg border border-[var(--tinte-neutro-borde-4)] bg-[var(--surface-strong)] px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--slate-800)]">{label ? monthShort(String(label)) : ""}</p>
      <div className="mt-1 space-y-0.5 text-[var(--slate-700)]">
        <p className="flex justify-between gap-4"><span>Facturado</span><span className="font-semibold">{formatCurrency(facturado)}</span></p>
        <p className="flex justify-between gap-4"><span>Recaudado</span><span className="font-semibold">{formatCurrency(recaudado)}</span></p>
        {liquidado !== recaudado ? (
          <p className="flex justify-between gap-4"><span>Saldado con anticipos</span><span className="font-semibold">{formatCurrency(Math.max(liquidado - recaudado, 0))}</span></p>
        ) : null}
        <p className="flex justify-between gap-4"><span>Pendiente</span><span className="font-semibold">{formatCurrency(pendiente)}</span></p>
        <p className="flex justify-between gap-4"><span>% recaudo</span><span className="font-semibold">{collectionRate}%</span></p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  // El Reporte de Comité es un documento formal (se imprime, se archiva y se firma):
  // los encabezados van sin emojis. Si el título llega con un símbolo/emoji al inicio
  // (p. ej. "📊 Resumen financiero"), se retira antes de renderizar.
  const clean = typeof children === "string" ? children.replace(/^[^\p{L}\p{N}]+/u, "") : children;
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--slate-500)] print:text-xs">
      {clean}
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

function AdminReportsPageContent() {
  const { user } = useAuth();
  const { formatAmount: formatCurrency, formatAmountCompact } = useTenantCurrency();
  // `PRD-V-FLOW-007`. **Apagada en los nueve**, así que hoy esto no pinta nada:
  // se enciende por conjunto cuando alguien vaya a mirar un informe generado.
  const informeMensual = useFeatureFlag("producto-informe-mensual");

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
    if (b.totalOverdue > 0) bullets.push(`Morosidad acumulada ${e.delinquencyAmount}% del facturado (${fmt(b.totalOverdue)} vencido en ${b.overdueUnits.length} unidad(es); ${e.delinquencyRate}% de unidades).`);
    bullets.push(`Resultado neto: ${fmt(f.netResult)}${dPct(e.netResultDelta)}.`);
    if (e.reserveMonths != null) bullets.push(`Fondo de reserva: ${fmt(f.fundBalance)} (~${e.reserveMonths} meses de gastos).`);
    if (t.total > 0) bullets.push(`${t.total} PQRS: ${t.resolved} resuelto(s) (${e.pqrsResolutionRate}%), ${t.open} abierto(s).`);
    if (a.forSignature > 0) bullets.push(`${a.forSignature} acuerdo(s) de firma: ${a.signatureRate}% firmado, ${a.pending} pendiente(s).`);

    const alerts: { text: string; tone: "danger" | "warn" }[] = [];
    if (f.netResult < 0) alerts.push({ text: "Resultado neto negativo en el período.", tone: "danger" });
    if (e.delinquencyAmount > 15) alerts.push({ text: `Morosidad (monto) del ${e.delinquencyAmount}% del facturado (supera el 15%).`, tone: "danger" });
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

  // ── Excel: arma el libro (reusado por descargar y por guardar en Documentos) ──
  const buildWorkbook = useCallback(() => {
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
      ["Índice de morosidad (monto, acum.)", `${report.executive.delinquencyAmount}%`],
      ["% de unidades morosas", `${report.executive.delinquencyRate}%`],
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

    return wb;
  }, [report, periodLabel, execSummary, aging]);

  const handleExcelExport = useCallback(() => {
    XLSX.writeFile(buildWorkbook(), `Reporte-Comite-${range.start}-${range.end}.xlsx`);
  }, [buildWorkbook, range]);

  // PDF estructurado del reporte (texto seleccionable, sin depender de oklch/charts).
  const buildPdfBlob = useCallback(async (): Promise<Blob> => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const left = 48;
    const rightX = pageW - 48;
    let y = 56;
    const fmt = formatCurrency;
    const ensure = (space: number) => { if (y + space > pageH - 56) { pdf.addPage(); y = 56; } };
    const heading = (t: string) => {
      ensure(30); y += 8;
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(15, 23, 42);
      pdf.text(t, left, y); y += 16;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(51, 65, 85);
    };
    const row = (label: string, value: string) => {
      ensure(16);
      pdf.setTextColor(71, 85, 105); pdf.text(label, left, y);
      pdf.setTextColor(15, 23, 42); pdf.text(value, rightX, y, { align: "right" }); y += 15;
    };
    const bullet = (t: string) => {
      const lines = pdf.splitTextToSize(`• ${t}`, rightX - left);
      ensure(lines.length * 13 + 2);
      pdf.setTextColor(51, 65, 85); pdf.text(lines, left, y); y += lines.length * 13 + 2;
    };

    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.setTextColor(15, 23, 42);
    pdf.text(user?.tenantName ?? "Conjunto", left, y); y += 20;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(71, 85, 105);
    pdf.text(`Reporte de Comité · ${periodLabel}`, left, y); y += 15;
    pdf.setFontSize(9); pdf.setTextColor(100, 116, 139);
    pdf.text(`Generado: ${generatedAt}${user?.fullName ? ` · Preparado por: ${user.fullName}` : ""}`, left, y); y += 10;

    heading("Resumen ejecutivo");
    execSummary.bullets.forEach(bullet);
    heading("Requiere atención del comité");
    if (execSummary.alerts.length === 0) bullet("Sin alertas para el comité.");
    else execSummary.alerts.forEach((a) => bullet(a.text));

    heading("Tablero ejecutivo");
    row("% de recaudo", `${report.executive.collectionRate}%`);
    row("Resultado neto", fmt(report.financial.netResult));
    row("Morosidad (monto, acum.)", `${report.executive.delinquencyAmount}%`);
    row("Meses de fondo de reserva", report.executive.reserveMonths == null ? "—" : `${report.executive.reserveMonths}`);
    row("Resolución de PQRS", `${report.executive.pqrsResolutionRate}%`);
    row("% de firma de acuerdos", `${report.agreements.signatureRate}%`);

    heading("Resumen financiero");
    row("Ingresos del período", fmt(report.financial.totalIncome));
    row("Egresos del período", fmt(report.financial.totalExpenses));
    row("Resultado neto", fmt(report.financial.netResult));
    row("Saldo de fondos", fmt(report.financial.fundBalance));
    report.financial.expenseByCategory.forEach((c) => row(`   ${c.label}`, fmt(c.amount)));

    heading("Cartera");
    row("Cobrado", fmt(report.billing.totalCollected));
    row("Total vencido", fmt(report.billing.totalOverdue));
    row("Pagadas / Pendientes / Vencidas", `${report.billing.paidCount} / ${report.billing.pendingCount} / ${report.billing.overdueCount}`);
    aging.forEach((bk) => row(`   Mora ${bk.label}`, `${fmt(bk.amount)} (${bk.units} u.)`));

    heading("Operación");
    row("Visitantes (período)", String(report.visitors.total));
    row("PQRS (total / abiertos / resueltos)", `${report.tickets.total} / ${report.tickets.open} / ${report.tickets.resolved}`);
    row("Paquetería (recibidos / entregados / pendientes)", `${report.packages.totalReceived} / ${report.packages.totalDelivered} / ${report.packages.stillPending}`);
    row("Reservas (total / aprobadas / pendientes)", `${report.reservations.total} / ${report.reservations.approved} / ${report.reservations.pending}`);
    row("Acuerdos (de firma / % firmado / pendientes)", `${report.agreements.forSignature} / ${report.agreements.signatureRate}% / ${report.agreements.pending}`);

    ensure(90); y += 26; heading("Aprobación del comité"); y += 28;
    const colW = (rightX - left) / 3;
    ["Presidente", "Tesorero / Secretario", "Administrador"].forEach((roleLabel, i) => {
      const cx = left + colW * i + 6;
      pdf.setDrawColor(148, 163, 184); pdf.line(cx, y, cx + colW - 24, y);
      pdf.setFontSize(8); pdf.setTextColor(71, 85, 105); pdf.text(roleLabel, cx, y + 12);
    });

    return pdf.output("blob");
  }, [report, execSummary, aging, periodLabel, generatedAt, user, formatCurrency]);

  const [savingDoc, setSavingDoc] = useState(false);
  async function handleSaveToDocuments() {
    const tid = user?.tenantId;
    const uid = user?.uid;
    if (!tid || !uid || !storage) return;
    const st = storage;
    setSavingDoc(true);
    try {
      const { folderId } = await ensureSystemFolderCallable({ tenantId: tid, systemKey: "committee_reports" });
      const stamp = `${range.start}-${range.end}`;
      const uploadOne = async (blob: Blob, ext: string, sourceSuffix: string) => {
        const path = `tenants/${tid}/committee-reports/${stamp}-${Date.now()}.${ext}`;
        const sref = storageRef(st, path);
        await uploadBytes(sref, blob);
        const fileUrl = await getDownloadURL(sref);
        await createDocumentRecord({
          tenantId: tid, userId: uid, userName: user?.fullName,
          fileName: `Reporte-Comite-${stamp}.${ext}`, fileUrl, storagePath: path,
          fileSize: blob.size, contentType: blob.type, category: "reporte",
          description: `Reporte de comité ${periodLabel}`, source: "committee_report",
          sourceId: `${stamp}${sourceSuffix}`, folderId,
        });
      };
      const xlsxBuf = XLSX.write(buildWorkbook(), { bookType: "xlsx", type: "array" });
      await uploadOne(new Blob([xlsxBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "xlsx", "");
      await uploadOne(await buildPdfBlob(), "pdf", "-pdf");
      toast.success("Reporte guardado en Documentos (Excel + PDF).");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingDoc(false);
    }
  }

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ── Ticket pie data ───────────────────────────────────────────────────────
  const ticketPieData = [
    { name: "Abiertos", value: report.tickets.open },
    { name: "En proceso", value: report.tickets.inProgress },
    { name: "Resueltos", value: report.tickets.resolved },
  ].filter((d) => d.value > 0);

  const carteraStateData = [
    { name: "Al día", value: report.billing.paidCount },
    { name: "Pendiente", value: report.billing.pendingCount },
    { name: "Vencida", value: report.billing.overdueCount },
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
          {/* El nombre lo pone `PageHeader` desde el shell. */}
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-[var(--brand-700)]" />
            <p className="text-sm text-[var(--slate-500)]">
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
            <Button onClick={() => void handleSaveToDocuments()} disabled={report.loading || savingDoc}>
              <FolderPlus className="mr-2 h-4 w-4" />
              {savingDoc ? "Guardando..." : "Guardar en Documentos"}
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
                    ? "border-[var(--brand-700)] bg-[var(--relleno-marca)] text-[var(--on-fill)]"
                    : "border-[var(--slate-200)] bg-[var(--surface-strong)] text-[var(--slate-600)] hover:bg-[var(--slate-50)]"
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
                <img src={logoUrl} alt="" className="h-12 w-12 rounded-sm object-contain" />
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

              {/*
                El hook lleva desde siempre poniendo este `error` cuando una de sus
                lecturas falla, y **esta página nunca lo leía**. El 23 de agosto de
                2026 cuatro consultas del informe reventaban por índices ausentes
                —`ledgerEntries`, `visitorPasses`, `tickets` y `committee_agreements`—
                y la pantalla enseñaba «Egresos $0», «PQRS 0» y «✓ Sin alertas para
                el comité» **sin una sola señal**. Un informe que no cargó era
                indistinguible de un conjunto sin movimiento.

                Va DENTRO del bloque imprimible y sin `no-print` a propósito: el daño
                no es que el administrador lo vea mal en pantalla, es que se lleve el
                PDF a la asamblea. Si el informe está incompleto, el papel lo dice.
              */}
              {report.error ? (
                <div className="flex items-start gap-2 rounded-xl border border-[var(--tinte-rojo-borde-2)] bg-[var(--tinte-neutro-fondo-2)] px-4 py-3 text-sm text-[var(--tinte-rojo-texto-2)]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
                  <span>
                    <strong>Informe incompleto.</strong> {report.error} Los totales que
                    aparecen abajo pueden estar por debajo de lo real —incluidos egresos,
                    visitantes y PQRS—, así que <strong>no uses este documento para
                    aprobar cuentas</strong> hasta que cargue completo.
                  </span>
                </div>
              ) : null}

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
                <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--slate-700)] [&>li]:max-w-[var(--medida-lectura)]">
                    {execSummary.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                  <div className="mt-3 border-t border-[var(--slate-100)] pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Requiere atención del comité</p>
                    {execSummary.alerts.length === 0 ? (
                      <p className="mt-1 text-sm text-[var(--success-700)]">✓ Sin alertas para el comité.</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {execSummary.alerts.map((a, i) => (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${a.tone === "danger" ? "bg-[var(--danger-50)] text-[var(--danger-700)]" : "bg-[var(--amber-50)] text-[var(--amber-700)]"}`}
                          >
                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                            {a.text}
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
                  <KpiCard label="Morosidad (monto, acum.)" value={`${report.executive.delinquencyAmount}%`} tone={report.executive.delinquencyAmount > 15 ? "danger" : "neutral"} sub={`${report.executive.delinquencyRate}% de unidades · ${report.billing.overdueUnits.length}/${report.executive.delinquencyBase}`} />
                  <KpiCard label="Meses de fondo" value={report.executive.reserveMonths === null ? "—" : `${report.executive.reserveMonths}`} tone={report.executive.reserveMonths !== null && report.executive.reserveMonths < 3 ? "danger" : "success"} sub="reserva ÷ egreso mensual" />
                  <KpiCard label="Resolución PQRS" value={`${report.executive.pqrsResolutionRate}%`} tone={report.executive.pqrsResolutionRate >= 70 ? "success" : "neutral"} />
                  <KpiCard label="% de firma" value={`${report.agreements.signatureRate}%`} tone={report.agreements.signatureRate >= 80 ? "success" : "neutral"} />
                </div>
                <p className="mt-2 max-w-[var(--medida-lectura)] text-xs text-[var(--slate-500)]">▲▼ comparado con el período anterior equivalente. Morosidad = unidades con saldo vencido sobre las unidades activas y las que deben; meses de fondo = saldo de reserva ÷ egreso mensual promedio.</p>
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
                {/*
                  Envuelto porque CLAUDE.md lo exige para toda sección que
                  consuma datos del tenant, «en especial charts de recharts»: el
                  único error boundary de ruta convierte un fallo de widget en la
                  pantalla «No pudimos cargar el workspace» para TODO /admin. La
                  torta de egresos llevaba aquí sin envolver desde antes; entra
                  ahora porque este incremento le pone otra al lado.
                */}
                {/*
                  `PRD-V-FLOW-007` entrega 2 · el informe emitible.
                  **Detrás de la bandera y de su propio boundary**: consume datos
                  del conjunto, y un fallo suyo no puede tumbar `/admin` entera.
                */}
                {informeMensual && (
                  <WidgetErrorBoundary label="informe-mensual">
                    <div className="mt-4">
                      <InformeMensualCard />
                    </div>
                  </WidgetErrorBoundary>
                )}
                <WidgetErrorBoundary label="resumen-financiero-por-cuenta">
                {report.financial.incomeByCategory.length > 0 ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="overflow-hidden rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)]">
                      <div className="border-b border-[var(--slate-100)] px-4 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Ingresos por cuenta</p>
                      </div>
                      <div className="divide-y divide-[var(--slate-100)]">
                        {report.financial.incomeByCategory.map((c) => (
                          <div key={c.category} className="flex items-center justify-between px-4 py-2 text-sm">
                            <span className="text-[var(--slate-700)]">{c.label}</span>
                            <span className="font-semibold text-[var(--slate-900)]">{formatCurrency(c.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Composición de ingresos</p>
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={report.financial.incomeByCategory} dataKey="amount" nameKey="label" cx="50%" cy="50%" outerRadius={56}>
                              {report.financial.incomeByCategory.map((_, i) => (
                                <Cell key={i} fill={INCOME_COLORS[i % INCOME_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(value, name) => [formatCurrency(Number(value)), name]} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                ) : null}
                {report.financial.expenseByCategory.length > 0 ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="overflow-hidden rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)]">
                      <div className="border-b border-[var(--slate-100)] px-4 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Egresos por cuenta</p>
                      </div>
                      <div className="divide-y divide-[var(--slate-100)]">
                        {report.financial.expenseByCategory.map((c) => (
                          <div key={c.category} className="flex items-center justify-between px-4 py-2 text-sm">
                            <span className="text-[var(--slate-700)]">{c.label}</span>
                            <span className="font-semibold text-[var(--slate-900)]">{formatCurrency(c.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Composición de egresos</p>
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={report.financial.expenseByCategory} dataKey="amount" nameKey="label" cx="50%" cy="50%" outerRadius={56}>
                              {report.financial.expenseByCategory.map((_, i) => (
                                <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(value, name) => [formatCurrency(Number(value)), name]} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                ) : null}
                </WidgetErrorBoundary>
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

                {carteraStateData.length > 0 ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Distribución por estado (período)</p>
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={carteraStateData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={56}>
                              {carteraStateData.map((_, i) => (
                                <Cell key={i} fill={CARTERA_COLORS[i % CARTERA_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                ) : null}

                {report.billing.overdueUnits.length > 0 ? (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Antigüedad de la mora</p>
                    <div className="grid grid-cols-3 gap-3">
                      {aging.map((bk) => {
                        const chronic = bk.key === "4+" && bk.units > 0;
                        return (
                          <div key={bk.key} className={`rounded-xl border p-3 ${chronic ? "border-[var(--danger-300)] bg-[var(--danger-50)]" : "border-[var(--slate-200)] bg-[var(--surface-strong)]"}`}>
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
                  <div className="mt-4 overflow-hidden rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)]">
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
                              {u.periods >= 4 ? <span className="ml-1 rounded-sm bg-[var(--danger-100)] px-1 text-[10px] font-medium text-[var(--danger-700)]">crónico</span> : null}
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
                  <p className="mt-3 text-sm text-[var(--success-700)]">✓ Sin unidades con saldo vencido en este período.</p>
                )}
              </section>

              {/* ── Tendencias (últimos 12 meses) ── */}
              {report.trends.byMonth.length > 0 ? (
                <section>
                  <SectionTitle>📈 Tendencias (últimos 12 meses)</SectionTitle>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Recaudo: facturado vs recaudado</p>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={report.trends.byMonth}>
                            <CartesianGrid stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="period" tickFormatter={monthShort} tick={{ fontSize: 11, fill: "var(--mapa-azul-acento-2)" }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={(v) => formatAmountCompact(Number(v))} tick={{ fontSize: 11, fill: "var(--mapa-azul-acento-2)" }} axisLine={false} tickLine={false} width={44} />
                            <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "var(--mapa-azul-acento-2)" }} axisLine={false} tickLine={false} width={36} />
                            {/* **El tooltip expone LO LIQUIDADO** (R16). Las barras
                                pintan facturado y recaudado, pero la línea del
                                porcentaje mide lo que dejó de deberse: un mes
                                saldado con anticipos deja la barra verde corta y la
                                línea al 100 %, y sin este dato no hay forma de
                                reconciliarlos. Mismo remedio que el gráfico de
                                Cartera, que ya lo hacía. */}
                            <Tooltip content={<RecaudoTooltip formatCurrency={formatCurrency} />} />
                            <Bar dataKey="facturado" name="Facturado" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="recaudado" name="Recaudado" fill="#10b981" radius={[3, 3, 0, 0]} />
                            <Line yAxisId="rate" dataKey="collectionRate" name="% recaudo" stroke="#6366f1" dot={false} strokeWidth={2} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Ingresos vs egresos por mes</p>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={report.trends.byMonth}>
                            <CartesianGrid stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="period" tickFormatter={monthShort} tick={{ fontSize: 11, fill: "var(--mapa-azul-acento-2)" }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={(v) => formatAmountCompact(Number(v))} tick={{ fontSize: 11, fill: "var(--mapa-azul-acento-2)" }} axisLine={false} tickLine={false} width={44} />
                            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(value, name) => [formatCurrency(Number(value)), name]} labelFormatter={(label) => monthShort(String(label))} />
                            <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="egresos" name="Egresos" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}
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
                  <div className="mt-4 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Ingresos por semana</p>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={report.visitors.byWeek} barSize={24}>
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--mapa-azul-acento-2)" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: "var(--mapa-azul-acento-2)" }} axisLine={false} tickLine={false} width={28} />
                          <Tooltip
                            contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                            cursor={{ fill: "var(--mapa-neutro-acento-2)" }}
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
                    <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4">
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
                    <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4">
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
                  <div className="mt-4 overflow-hidden rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)]">
                    <div className="border-b border-[var(--slate-100)] px-4 py-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Por amenidad</p>
                    </div>
                    <div className="divide-y divide-[var(--slate-100)]">
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
                    <div className="mt-4 overflow-hidden rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)]">
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
                              <td className={`px-4 py-2 text-right font-medium ${a.pending > 0 ? "text-[var(--danger-700)]" : "text-[var(--success-700)]"}`}>
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

/**
 * Durante la prueba este módulo es VISTA PREVIA: se explora con datos de
 * ejemplo pero no se opera (ver src/lib/config/trial-modules.ts). Para un
 * cliente activo, el gate es transparente.
 */
export default function AdminReportsPage() {
  return (
    <ModulePreviewGate module="reports">
      <AdminReportsPageContent />
    </ModulePreviewGate>
  );
}
