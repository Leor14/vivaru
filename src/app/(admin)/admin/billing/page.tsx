"use client";

import { ModulePreviewGate } from "@/components/shared/module-preview-gate";
import { useCallback, useMemo, useRef, useState } from "react";
import { useEffect } from "react";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  PenSquare,
  Printer,
  SendHorizontal,
  Upload,
  Wallet,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import { CoefficientCampaignDialog } from "@/components/features/billing/CoefficientCampaignDialog";
import { statementChargedAmount, statementSettledAmount } from "@/features/billing/collection";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
import { useTenantVocabulary } from "@/features/tenant/use-tenant-vocabulary";
import * as XLSX from "xlsx";

import { ChartContainer } from "@/components/features/admin/dashboard/chart-container";
import { BillingBulkMessageDrawer, type BillingUnitOption } from "@/components/features/billing/BillingBulkMessageDrawer";
import { EmptyState } from "@/components/shared/empty-state";
import { HelpTip } from "@/components/shared/help-tip";
import { Modal } from "@/components/shared/modal";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { SectionIntro } from "@/components/shared/section-intro";
import { TablePager } from "@/components/shared/table-pager";
import { usePagination } from "@/components/shared/use-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { IconBadge } from "@/components/ui/icon-badge";
import { Input } from "@/components/ui/input";
import { RangePicker, type RangePickerValue } from "@/components/ui/range-picker";
import { UI_TEXT } from "@/constants/uiText";
import { useAuth } from "@/features/auth/auth-context";
import { useGuidedAction } from "@/features/onboarding/guided-action";
import { useModuleVariant } from "@/lib/config/use-module-variant";
import { WidgetErrorBoundary } from "@/components/shared/widget-error-boundary";
import { buildBillingTrend, getBillingPeriods, type BillingTrendPoint } from "@/features/billing/billing-trend";
import { BILLING_CONCEPTS, billingConceptLabel, cancelBillingSchedule, cancelReminderJob, createBillingCampaign, createBillingSchedule, createBillingStatement, createReminderJob, incrementReminderCount, setCampaignStatus, setStatementsArchived, updateBillingStatement, useBillingCampaigns, useBillingSchedules, useBillingStatements, useReminderJobs } from "@/features/billing/use-billing-statements";
import { backfillApprovedReceipts, usePaymentReceipts } from "@/features/billing/use-payment-receipts";
import { ensureSystemFolderCallable, notifyBillingBatchCallable, sendBillingReminderCallable } from "@/lib/firebase/callables";
import { computeStatementStatus } from "@/features/billing/statement-status";
import { BillingEditDrawer, type BillingEditRecord } from "@/components/features/billing/BillingEditDrawer";
import { RecordPaymentModal } from "@/components/features/finanzas/RecordPaymentModal";
import { CuentasPorPagarTablero } from "@/components/features/finanzas/cuentas-por-pagar-tablero";
import { FlujoCajaTablero } from "@/components/features/finanzas/flujo-caja-tablero";
import { LiquidezTablero } from "@/components/features/finanzas/liquidez-tablero";
import { PeriodFilter } from "@/components/features/finanzas/period-filter";
import { StatTile } from "@/components/features/finanzas/stat-tile";
import { TableroCarousel } from "@/components/features/finanzas/tablero-carousel";
import { Dialog } from "@/components/ui/dialog";
import { AdvancesPanel } from "@/components/features/billing/AdvancesPanel";
import { PaymentReceiptsReviewPanel } from "@/components/features/billing/PaymentReceiptsReviewPanel";
import { createCommunication, createDocumentRecord } from "@/features/admin/services";
import { storage } from "@/lib/firebase/client";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { chartAxis, chartBar, chartColors, chartGrid, chartLine, chartMargin } from "@/features/finanzas/chart-theme";
import type { BillingConcept, BillingStatement } from "@/types/domain";

type UnitCollectionItem = {
  id: string;
  unitId?: string;
  displayName?: string;
  unitLabel?: string;
};

type BillingStatusFilter = "all" | "paid" | "pending" | "overdue";

function parseCurrency(value: string) {
  const cleaned = value.replace(/[^0-9-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrencyInput(value: string) {
  const parsed = parseCurrency(value);
  return parsed.toLocaleString("es-CO");
}

function buildCsvRows(rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    const values = headers.map((header) => {
      const raw = String(row[header] ?? "");
      return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
    });
    lines.push(values.join(","));
  });
  return lines.join("\n");
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((item) => item.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? "").trim().replace(/^"|"$/g, "");
    });
    return row;
  });
}

function formatPeriodLabel(period: string) {
  const date = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat("es-CO", { month: "short", year: "2-digit" }).format(date);
}

// `sentAt` viene como Firestore Timestamp (el helper realtime no lo serializa).
function formatSentAt(value: unknown): string {
  if (!value) return "—";
  if (typeof value === "object" && value !== null && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  }
  return "—";
}

function formatTableDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month) return dateStr;
  const date = new Date(year, month - 1, day ?? 1);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("es-CO", { day: day ? "numeric" : undefined, month: "short", year: "numeric" });
}

function BillingTrendTooltip({
  active,
  payload,
  label,
  formatAmount,
}: {
  active?: boolean;
  payload?: Array<{ payload: BillingTrendPoint }>;
  label?: string;
  formatAmount: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  // Del DATO, no del nombre de la serie. Casar por nombre solo alcanzaba lo que
  // estuviera pintado, así que lo liquidado —que no es una barra— no tenía por
  // dónde llegar, y el `?? collected / charged` de reserva era justo la fórmula
  // que R16 vino a quitar: habría enseñado un porcentaje distinto del de la
  // línea, y solo a veces.
  const { totalCharged: charged, totalCollected: collected, totalSettled: settled } = payload[0].payload;
  const rate = charged > 0 ? (settled / charged) * 100 : 0;
  // Lo que SIGUE DEBIÉNDOSE, que es `charged - settled` y no `charged - collected`.
  // Con la resta vieja, una cuota saldada con un anticipo aparecía como brecha
  // al mismo tiempo que la línea marcaba el 100 %.
  const gap = Math.max(charged - settled, 0);

  return (
    <div className="rounded-2xl border border-[var(--slate-200)] bg-white px-3 py-3 shadow-[0_14px_28px_rgba(13,38,59,0.16)]">
      <p className="text-xs font-semibold text-[var(--slate-800)]">{label ? formatPeriodLabel(label) : "Período"}</p>
      <div className="mt-2 space-y-1 text-xs text-[var(--slate-700)]">
        <p className="flex items-center justify-between gap-3">
          <span>Cobrado</span>
          <span className="font-semibold text-[#2c648d]">{formatAmount(charged)}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span>Recaudado</span>
          <span className="font-semibold text-[#2f775f]">{formatAmount(collected)}</span>
        </p>
        {settled !== collected ? (
          // Solo aparece cuando los dos números se separan, que es cuando hay
          // anticipos cruzados. Enseñar siempre dos cifras iguales invita a
          // buscarles la diferencia.
          <p className="flex items-center justify-between gap-3">
            <span>Saldado con anticipos</span>
            <span className="font-semibold text-[#2f775f]">{formatAmount(Math.max(settled - collected, 0))}</span>
          </p>
        ) : null}
        <p className="flex items-center justify-between gap-3">
          <span>Pendiente</span>
          <span className="font-semibold text-[#936b24]">{formatAmount(gap)}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span>% recaudo</span>
          <span className="font-semibold text-[#355f87]">{rate.toFixed(1)}%</span>
        </p>
      </div>
    </div>
  );
}

function AdminBillingPageContent() {
  const { user } = useAuth();
  // Finanzas solo_consulta: oculta la gestión de cobros; deja la cartera y comprobantes en consulta.
  const soloConsulta = useModuleVariant(user?.tenantId, "finance") === "solo_consulta";
  const { formatAmount, formatAmountCompact } = useTenantCurrency();
  const { items, loading, error } = useBillingStatements(user?.tenantId);
  const { receiptByStatementId } = usePaymentReceipts(user?.tenantId);
  const { items: scheduledCharges } = useBillingSchedules(user?.tenantId);
  const { items: campaigns } = useBillingCampaigns(user?.tenantId);
  const { items: reminderJobs } = useReminderJobs(user?.tenantId);
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);
  const [reminderTarget, setReminderTarget] = useState<{ campaignId: string; label: string; unitIds: string[]; statementIds: string[] } | null>(null);
  const [reminderDate, setReminderDate] = useState("");
  const [listView, setListView] = useState<"campaigns" | "individuals" | "byUnit" | "overdue" | "morosos">("campaigns");
  const [conceptFilter, setConceptFilter] = useState<BillingConcept | "all">("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [pendingClosePeriod, setPendingClosePeriod] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [catalogUnits, setCatalogUnits] = useState<BillingUnitOption[]>([]);
  const [catalogUnitsLoading, setCatalogUnitsLoading] = useState(false);
  const [catalogUnitsError, setCatalogUnitsError] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("1.120.000");
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [concept, setConcept] = useState<BillingConcept>("administracion");
  const [chargeMode, setChargeMode] = useState<"individual" | "batch">("individual");
  const [coefficientDialogOpen, setCoefficientDialogOpen] = useState(false);
  const cobroPorCoeficiente = useFeatureFlag("producto-cobro-por-coeficiente");
  const vocab = useTenantVocabulary();
  const [scheduledFor, setScheduledFor] = useState("");
  const [excludedUnits, setExcludedUnits] = useState<Set<string>>(new Set());
  const [createResult, setCreateResult] = useState<string | null>(null);
  /** Confirmación previa a registrar/programar un cobro (emite notificación al residente). */
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [creatingCharge, setCreatingCharge] = useState(false);
  const [chartUnitFilter, setChartUnitFilter] = useState("all");
  const [periodMonths, setPeriodMonths] = useState(3);

  // F5: archiva en la carpeta de sistema los comprobantes aprobados aún no registrados.
  useEffect(() => {
    const tid = user?.tenantId;
    const uid = user?.uid;
    if (!tid || !uid) return;
    let cancelled = false;
    void (async () => {
      try {
        const { folderId } = await ensureSystemFolderCallable({ tenantId: tid, systemKey: "payment_receipts" });
        if (!cancelled) await backfillApprovedReceipts({ tenantId: tid, folderId, userId: uid, userName: user?.fullName });
      } catch {
        // best-effort.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.tenantId, user?.uid, user?.fullName]);

  // Persiste el período de análisis de los tableros entre visitas.
  useEffect(() => {
    const stored = Number(window.localStorage.getItem("vivaru:cartera:period-months"));
    if (Number.isInteger(stored) && stored >= 1 && stored <= 24) setPeriodMonths(stored);
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem("vivaru:cartera:period-months", String(periodMonths));
    } catch {
      // localStorage no disponible: no persiste, sin romper.
    }
  }, [periodMonths]);
  const [fromPeriod, setFromPeriod] = useState("");
  const [toPeriod, setToPeriod] = useState("");
  const [statusFilter, setStatusFilter] = useState<BillingStatusFilter>("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [isBulkDrawerOpen, setIsBulkDrawerOpen] = useState(false);

  /**
   * Enganche del recorrido guiado. El cobro se crea en una tarjeta de esta
   * misma página, no en un modal, así que la acción lleva la vista hasta ella:
   * en una pantalla con cartera, campañas y tableros, "está en Cartera" no
   * basta como indicación. Ver `src/lib/onboarding/steps.ts`.
   */
  useGuidedAction("primer-cobro", () => {
    requestAnimationFrame(() => {
      document.getElementById("guia-crear-cobro")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedBulkUnitIds, setSelectedBulkUnitIds] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState("Recordatorio: tienes cartera en mora. Por favor realiza tu abono para evitar recargos.");
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<BillingEditRecord | null>(null);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isEditDrawerDirty, setIsEditDrawerDirty] = useState(false);
  const [pendingSwitchRecord, setPendingSwitchRecord] = useState<BillingEditRecord | null>(null);
  const [isSwitchConfirmOpen, setIsSwitchConfirmOpen] = useState(false);
  const requestDrawerSubmitRef = useRef<(() => Promise<boolean>) | null>(null);
  const [switchingAfterSave, setSwitchingAfterSave] = useState(false);
  const inFlightUpdateIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.tenantId) {
      setCatalogUnits([]);
      setCatalogUnitsLoading(false);
      setCatalogUnitsError(null);
      return;
    }

    setCatalogUnitsLoading(true);
    setCatalogUnitsError(null);

    const unsubscribe = subscribeTenantCollection<UnitCollectionItem>(
      "units",
      user.tenantId,
      (rows) => {
        const options = rows
          .map((row) => {
            // Always use the Firestore doc ID as the stable unit identifier.
            // row.id is the doc ID that tenantUsers.unitId stores (new-schema units).
            // Using row.unitId (a slug field) was causing billing statements to never
            // match what residents see, because tenantUsers.unitId holds the doc ID.
            const stableId = row.id;
            const label =
              (typeof row.displayName === "string" && row.displayName.trim().length > 0 ? row.displayName.trim() : "") ||
              (typeof row.unitLabel === "string" && row.unitLabel.trim().length > 0 ? row.unitLabel.trim() : "") ||
              stableId;
            return { id: stableId, label };
          })
          .sort((a, b) => a.label.localeCompare(b.label, "es"));

        setCatalogUnits(options);
        setCatalogUnitsLoading(false);
        setCatalogUnitsError(null);
      },
      (message) => {
        setCatalogUnitsLoading(false);
        setCatalogUnitsError(message);
      },
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.tenantId]);

  useEffect(() => {
    if (catalogUnits.length === 0) {
      setSelectedUnitId("");
      setUnitLabel("");
      return;
    }

    if (!catalogUnits.some((unit) => unit.id === selectedUnitId)) {
      setSelectedUnitId(catalogUnits[0].id);
      setUnitLabel(catalogUnits[0].label);
    }
  }, [catalogUnits, selectedUnitId]);

  useEffect(() => {
    if (catalogUnits.length === 0) {
      setSelectedBulkUnitIds([]);
      return;
    }

    setSelectedBulkUnitIds((current) => current.filter((id) => catalogUnits.some((unit) => unit.id === id)));
  }, [catalogUnits]);

  const billingFormTitle = useMemo(() => {
    const parsedAmount = parseCurrency(amount);
    const parsedPayment = parseCurrency(paymentAmount);

    if (parsedAmount > 0 && parsedPayment === 0) return UI_TEXT.billing.createCharge;
    if (parsedAmount === 0 && parsedPayment > 0) return UI_TEXT.billing.registerPayment;
    if (parsedAmount > 0 && parsedPayment > 0) return UI_TEXT.billing.adjustPortfolio;
    return UI_TEXT.billing.defaultTitle;
  }, [amount, paymentAmount]);

  const logDebug = useCallback((event: string, payload?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "production") return;
    if (payload) {
      console.info(event, payload);
      return;
    }
    console.info(event);
  }, []);

  const normalizedRows = useMemo(() => {
    return items.map((item) => {
      const rowAmount = typeof item.amount === "number" ? item.amount : (item.balance || 0) + (item.paymentAmount || 0);
      const rowPayment = item.paymentAmount || 0;
      const rowDueDate = item.dueDate || "";
      const status = computeStatementStatus(item.balance || 0, { dueDate: rowDueDate, period: item.period });
      return {
        ...item,
        amount: rowAmount,
        paymentAmount: rowPayment,
        dueDate: rowDueDate,
        status,
      };
    });
  }, [items]);

  const availableChartPeriods = useMemo(() => getBillingPeriods(normalizedRows, chartUnitFilter), [normalizedRows, chartUnitFilter]);

  useEffect(() => {
    if (availableChartPeriods.length === 0) {
      if (fromPeriod !== "") setFromPeriod("");
      if (toPeriod !== "") setToPeriod("");
      return;
    }

    const latest = availableChartPeriods[availableChartPeriods.length - 1];
    const defaultFrom = availableChartPeriods[Math.max(availableChartPeriods.length - 11, 0)];
    let nextFrom = fromPeriod;
    let nextTo = toPeriod;

    if (!nextFrom || !availableChartPeriods.includes(nextFrom)) {
      nextFrom = defaultFrom;
    }

    if (!nextTo || !availableChartPeriods.includes(nextTo)) {
      nextTo = latest;
    }

    if (nextFrom > nextTo) {
      nextFrom = defaultFrom;
      nextTo = latest;
    }

    if (nextFrom !== fromPeriod) setFromPeriod(nextFrom);
    if (nextTo !== toPeriod) setToPeriod(nextTo);
  }, [availableChartPeriods, fromPeriod, toPeriod]);

  const chartTrend = useMemo(
    () => buildBillingTrend(normalizedRows, chartUnitFilter, fromPeriod, toPeriod),
    [normalizedRows, chartUnitFilter, fromPeriod, toPeriod],
  );

  const rangeValue = useMemo<RangePickerValue | null>(() => {
    if (!fromPeriod || !toPeriod) return null;
    const [fy, fm] = fromPeriod.split("-").map((n) => Number.parseInt(n, 10));
    const [ty, tm] = toPeriod.split("-").map((n) => Number.parseInt(n, 10));
    if (!Number.isFinite(fy) || !Number.isFinite(fm) || !Number.isFinite(ty) || !Number.isFinite(tm)) {
      return null;
    }
    const from = new Date(fy, fm - 1, 1);
    const to = new Date(ty, tm, 0); // last day of target month
    return { from, to };
  }, [fromPeriod, toPeriod]);

  const handleRangeChange = useCallback((next: RangePickerValue) => {
    const fromKey = `${next.from.getFullYear()}-${String(next.from.getMonth() + 1).padStart(2, "0")}`;
    const toKey = `${next.to.getFullYear()}-${String(next.to.getMonth() + 1).padStart(2, "0")}`;
    setFromPeriod(fromKey <= toKey ? fromKey : toKey);
    setToPeriod(fromKey <= toKey ? toKey : fromKey);
  }, []);

  const trendSummary = useMemo(() => {
    const totalCharged = chartTrend.reduce((sum, item) => sum + item.totalCharged, 0);
    const totalCollected = chartTrend.reduce((sum, item) => sum + item.totalCollected, 0);
    const totalSettled = chartTrend.reduce((sum, item) => sum + item.totalSettled, 0);
    // R16. La brecha es lo que sigue debiéndose —facturado menos liquidado—, y
    // el porcentaje mide liquidación. Con la resta vieja, una cuota saldada con
    // un anticipo contaba como brecha y como recaudo bajo a la vez.
    const gap = Math.max(totalCharged - totalSettled, 0);
    const collectionRate = totalCharged > 0 ? (totalSettled / totalCharged) * 100 : 0;

    return { totalCharged, totalCollected, totalSettled, gap, collectionRate };
  }, [chartTrend]);

  const chartData = useMemo(
    () =>
      chartTrend.map((item) => ({
        ...item,
        collectionRate: item.totalCharged > 0 ? (item.totalSettled / item.totalCharged) * 100 : 0,
      })),
    [chartTrend],
  );

  const cuotaIncome = useMemo(
    () => items.reduce((sum, item) => sum + (item.paymentAmount ?? 0), 0),
    [items],
  );

  const filteredRows = useMemo(() => {
    return normalizedRows.filter((item) => {
      const byStatus = statusFilter === "all" ? true : item.status === statusFilter;
      const byUnit = unitFilter === "all" ? true : item.unitLabel === unitFilter;
      const byConcept = conceptFilter === "all" ? true : (item.concept ?? "administracion") === conceptFilter;
      const byPeriod = periodFilter === "all" ? true : item.period === periodFilter;
      const byCampaign = campaignFilter ? item.campaignId === campaignFilter : true;
      const base = byStatus && byUnit && byConcept && byPeriod && byCampaign;
      // "Cartera vencida": todos los cobros con saldo, incluso de períodos cerrados.
      if (listView === "overdue") {
        return (item.balance ?? 0) > 0 && base;
      }
      // "Cobros individuales" = sin campaña; "Por unidad" = todos. Oculta archivados.
      const byView = listView === "individuals" ? item.campaignId == null : true;
      return !item.archived && base && byView;
    });
  }, [normalizedRows, statusFilter, unitFilter, conceptFilter, periodFilter, campaignFilter, listView]);

  const overdueRows = useMemo(() => normalizedRows.filter((item) => item.status === "overdue"), [normalizedRows]);

  const billingPager = usePagination(filteredRows);

  const units = useMemo(() => Array.from(new Set(normalizedRows.map((item) => item.unitLabel))).sort((a, b) => a.localeCompare(b)), [normalizedRows]);

  const allUnitLabels = useMemo(() => {
    const fromCatalog = catalogUnits.map((unit) => unit.label);
    return Array.from(new Set([...units, ...fromCatalog])).sort((a, b) => a.localeCompare(b, "es"));
  }, [catalogUnits, units]);

  const chartUnitOptions = useMemo(() => {
    const labels = Array.from(new Set(catalogUnits.map((unit) => unit.label))).sort((a, b) => a.localeCompare(b, "es"));
    return ["all", ...labels];
  }, [catalogUnits]);

  // Unidades destino del lote: todas las del catálogo menos las destildadas.
  const batchTargets = useMemo(
    () => catalogUnits.filter((u) => !excludedUnits.has(u.id)).map((u) => ({ unitId: u.id, unitLabel: u.label })),
    [catalogUnits, excludedUnits],
  );

  // Filas de campañas con totales derivados de sus statements. Mantenimiento primero.
  const campaignRows = useMemo(() => {
    const rows = campaigns.map((c) => {
      const stmts = items.filter((s) => s.campaignId === c.id);
      const emitido = stmts.reduce((acc, s) => acc + statementChargedAmount(s), 0);
      const recaudado = stmts.reduce((acc, s) => acc + Math.max(s.paymentAmount ?? 0, 0), 0);
      // **R16, y por la fórmula única.** El «% recaudo» de esta tabla se
      // calculaba `recaudado / emitido` mientras el StatTile de la MISMA pantalla,
      // con el mismo rótulo, mide liquidación: dos porcentajes distintos con el
      // mismo nombre a un palmo el uno del otro. Aquí manda la liquidación, que
      // es lo que responde «cuánto de esta campaña ha dejado de deberse».
      const liquidado = stmts.reduce((acc, s) => acc + statementSettledAmount(s), 0);
      const pendiente = stmts.reduce((acc, s) => acc + (s.balance ?? 0), 0);
      const pendientes = stmts.filter((s) => (s.balance ?? 0) > 0);
      const pendientesUnitIds = pendientes.map((s) => s.unitId);
      const pendientesStatementIds = pendientes.map((s) => s.id);
      const unitCount = stmts.length || c.unitCount || 0;
      const paidCount = stmts.filter((s) => (s.balance ?? 0) <= 0).length;
      const reminders = stmts.reduce((acc, s) => acc + (s.reminderCount ?? 0), 0);
      const pct = emitido > 0 ? Math.round((liquidado / emitido) * 100) : 0;
      return { c, emitido, recaudado, liquidado, pendiente, pendientesUnitIds, pendientesStatementIds, unitCount, paidCount, reminders, pct };
    });
    // Mantenimiento (administración) primero; dentro, el orden por sentAt desc del hook.
    return rows.sort((a, b) => (a.c.concept === "administracion" ? 0 : 1) - (b.c.concept === "administracion" ? 0 : 1));
  }, [campaigns, items]);

  // Agregado por período para el cierre/archivado (C4a). Usa el set completo.
  const periodAgg = useMemo(() => {
    const map = new Map<string, { period: string; total: number; pendiente: number; activos: number; archivados: number }>();
    for (const s of items) {
      const e = map.get(s.period) ?? { period: s.period, total: 0, pendiente: 0, activos: 0, archivados: 0 };
      e.total += s.amount ?? 0;
      e.pendiente += s.balance ?? 0;
      if (s.archived) e.archivados += 1;
      else e.activos += 1;
      map.set(s.period, e);
    }
    return Array.from(map.values()).sort((a, b) => (a.period < b.period ? 1 : -1));
  }, [items]);
  const openPeriods = useMemo(() => periodAgg.filter((p) => p.activos > 0), [periodAgg]);
  const closedPeriods = useMemo(() => periodAgg.filter((p) => p.activos === 0 && p.archivados > 0), [periodAgg]);
  const currentPeriod = new Date().toISOString().slice(0, 7);

  // Tablero de morosos: agrega por unidad todos los cobros con saldo (incluye cerrados).
  const morosos = useMemo(() => {
    const map = new Map<string, { unitId: string; unitLabel: string; deuda: number; periodos: string[]; statementIds: string[]; lastPaymentAt?: string }>();
    for (const s of items) {
      if ((s.balance ?? 0) <= 0) continue;
      const e = map.get(s.unitId) ?? { unitId: s.unitId, unitLabel: s.unitLabel, deuda: 0, periodos: [], statementIds: [], lastPaymentAt: undefined };
      e.deuda += s.balance ?? 0;
      e.statementIds.push(s.id);
      if (!e.periodos.includes(s.period)) e.periodos.push(s.period);
      if (s.lastPaymentAt && (!e.lastPaymentAt || s.lastPaymentAt > e.lastPaymentAt)) e.lastPaymentAt = s.lastPaymentAt;
      map.set(s.unitId, e);
    }
    return Array.from(map.values())
      .map((m) => ({ ...m, periodos: m.periodos.sort() }))
      .sort((a, b) => b.deuda - a.deuda);
  }, [items]);
  const morososTotal = useMemo(() => morosos.reduce((acc, m) => acc + m.deuda, 0), [morosos]);
  const periodOptions = useMemo(() => periodAgg.map((p) => p.period), [periodAgg]);
  const carteraActiveFilters = [statusFilter !== "all", unitFilter !== "all", conceptFilter !== "all", periodFilter !== "all"].filter(Boolean).length;
  const [closingPeriod, setClosingPeriod] = useState<string | null>(null);

  // Etiquetas de unidad repetidas (docs duplicados con el mismo nombre) → se señalan.
  const duplicateLabels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of catalogUnits) counts.set(u.label, (counts.get(u.label) ?? 0) + 1);
    return new Set(Array.from(counts.entries()).filter(([, n]) => n > 1).map(([label]) => label));
  }, [catalogUnits]);

  async function handleCreate() {
    if (!user?.tenantId || !date.trim() || !amount.trim()) return;
    const tid = user.tenantId;
    const uid = user.uid;
    const rawAmount = parseCurrency(amount);
    const period = date.slice(0, 7);
    try {
      if (chargeMode === "individual") {
        if (!selectedUnitId.trim() || !unitLabel.trim()) {
          toast.error("Selecciona la unidad.");
          return;
        }
        if (scheduledFor) {
          await createBillingSchedule({
            tenantId: tid, userId: uid, concept, amount: rawAmount, period,
            dueDate: dueDate || undefined, scheduledFor, isBatch: false,
            targets: [{ unitId: selectedUnitId, unitLabel: unitLabel.trim() }],
          });
          toast.success("Cobro programado.");
          setCreateResult(`Cobro programado para ${unitLabel.trim()} el ${scheduledFor}. Puedes revisarlo o cancelarlo en “Cobros programados”.`);
        } else {
          const rawPayment = parseCurrency(paymentAmount);
          const balance = Math.max(rawAmount - rawPayment, 0);
          await createBillingStatement({
            tenantId: tid, userId: uid, unitId: selectedUnitId, unitLabel: unitLabel.trim(),
            period, concept, amount: rawAmount, paymentAmount: rawPayment, balance,
            dueDate: dueDate || undefined,
          });
          toast.success("Estado de cuenta registrado.");
          setCreateResult(`Cobro registrado para ${unitLabel.trim()} (${period}). Aparece en la tabla de abajo.`);
        }
      } else {
        if (batchTargets.length === 0) {
          toast.error("Selecciona al menos una unidad para el lote.");
          return;
        }
        if (scheduledFor) {
          await createBillingSchedule({
            tenantId: tid, userId: uid, concept, amount: rawAmount, period,
            dueDate: dueDate || undefined, scheduledFor, isBatch: true, targets: batchTargets,
          });
          toast.success("Lote programado.");
          setCreateResult(`Lote programado para el ${scheduledFor} (${batchTargets.length} unidades). Revísalo o cancélalo en “Cobros programados”.`);
        } else {
          const campaignId = await createBillingCampaign({
            tenantId: tid, userId: uid, concept, period, unitAmount: rawAmount,
            dueDate: dueDate || undefined, unitCount: batchTargets.length, source: "immediate",
          });
          const unitIds: string[] = [];
          for (const t of batchTargets) {
            await createBillingStatement({
              tenantId: tid, userId: uid, unitId: t.unitId, unitLabel: t.unitLabel,
              period, concept, campaignId, amount: rawAmount, paymentAmount: 0, balance: rawAmount,
              dueDate: dueDate || undefined, source: "import",
            });
            unitIds.push(t.unitId);
          }
          if (unitIds.length > 0 && rawAmount > 0) {
            try {
              await notifyBillingBatchCallable({ tenantId: tid, period, unitIds });
            } catch (notifyErr) {
              console.error("[billing batch] notify error", notifyErr);
            }
          }
          toast.success(`Campaña creada (${unitIds.length} cobros).`);
          setCreateResult(`Se creó la campaña de ${billingConceptLabel(concept)} de ${period} (${unitIds.length} unidades). Los residentes fueron notificados. Revísala en “Campañas de cobro”.`);
        }
      }
      // Reset a estado limpio: vuelve a "Una unidad" y limpia la selección del lote.
      setPaymentAmount("0");
      setAmount("0");
      setScheduledFor("");
      setChargeMode("individual");
      setExcludedUnits(new Set());
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  async function handleCancelSchedule(id: string) {
    try {
      await cancelBillingSchedule(id);
      toast.success("Cobro programado cancelado.");
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  async function handleClosePeriod(period: string) {
    const tid = user?.tenantId;
    const uid = user?.uid;
    if (!tid || !uid) return;
    const periodRows = normalizedRows.filter((r) => r.period === period && !r.archived);
    if (periodRows.length === 0) return;
    const pending = periodRows.filter((r) => (r.balance ?? 0) > 0).length;
    if (!storage) {
      toast.error("Almacenamiento no disponible.");
      return;
    }
    setClosingPeriod(period);
    try {
      // Reporte de cierre (Excel) → Storage.
      const ws = XLSX.utils.json_to_sheet(
        periodRows.map((r) => ({
          Apartamento: r.unitLabel,
          Concepto: billingConceptLabel(r.concept),
          Monto: r.amount ?? 0,
          Abono: r.paymentAmount ?? 0,
          Saldo: r.balance ?? 0,
          Estado: r.status,
        })),
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, period);
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const fileName = `Cierre-cartera-${period}.xlsx`;
      const path = `tenants/${tid}/billing-closures/${period}-${Date.now()}.xlsx`;
      const sref = storageRef(storage, path);
      await uploadBytes(sref, blob);
      const fileUrl = await getDownloadURL(sref);

      const { folderId } = await ensureSystemFolderCallable({ tenantId: tid, systemKey: "billing_closures" });
      await createDocumentRecord({
        tenantId: tid,
        userId: uid,
        userName: user?.fullName,
        fileName,
        fileUrl,
        storagePath: path,
        fileSize: blob.size,
        contentType: blob.type,
        category: "financiero",
        description: `Cierre de cartera ${period}`,
        source: "billing_closure",
        sourceId: period,
        folderId,
      });

      await setStatementsArchived(periodRows.map((r) => r.id), true, uid);
      await setCampaignStatus(campaigns.filter((c) => c.period === period).map((c) => c.id), "cerrada");
      toast.success(
        pending > 0
          ? `Período ${period} cerrado. Reporte en Documentos. Los ${pending} morosos quedan en “Cartera vencida”.`
          : `Período ${period} cerrado. El reporte quedó en Documentos → “Cierres de cartera”.`,
      );
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setClosingPeriod(null);
    }
  }

  async function handleReopenPeriod(period: string) {
    const uid = user?.uid;
    const ids = items.filter((s) => s.period === period && s.archived).map((s) => s.id);
    if (ids.length === 0) return;
    setClosingPeriod(period);
    try {
      await setStatementsArchived(ids, false, uid);
      await setCampaignStatus(campaigns.filter((c) => c.period === period).map((c) => c.id), "vigente");
      toast.success(`Período ${period} reabierto.`);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setClosingPeriod(null);
    }
  }

  const [savingHistory, setSavingHistory] = useState(false);
  async function handleSaveCarteraHistory() {
    const tid = user?.tenantId;
    const uid = user?.uid;
    if (!tid || !uid || !storage) return;
    setSavingHistory(true);
    try {
      // Recaudo por período (esperado vs cobrado vs liquidado).
      //
      // **R16, y por la fórmula única.** Hasta el 24 de agosto de 2026 este
      // export calculaba el porcentaje como `Σ paymentAmount / Σ amount` —la
      // fórmula que R16 sustituyó— así que **contradecía al «% recaudo» de su
      // propia pantalla**, que ya mide liquidación. Y su gemelo, el archivo
      // automático mensual de `monthlyFinancialArchive`, producía un fichero con
      // el mismo nombre y las mismas columnas con el otro número dentro.
      //
      // Se exponen los DOS: «recaudado» es el dinero que entró y «liquidado» es
      // lo que dejó de deberse. En cuanto hay anticipos cruzados no son lo mismo.
      const byPeriod = new Map<string, { facturado: number; recaudado: number; liquidado: number; pendiente: number }>();
      for (const s of items) {
        const e = byPeriod.get(s.period) ?? { facturado: 0, recaudado: 0, liquidado: 0, pendiente: 0 };
        e.facturado += statementChargedAmount(s);
        e.recaudado += Math.max(s.paymentAmount ?? 0, 0);
        e.liquidado += statementSettledAmount(s);
        e.pendiente += s.balance ?? 0;
        byPeriod.set(s.period, e);
      }
      const periodRows = Array.from(byPeriod.entries())
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([period, v]) => [period, v.facturado, v.recaudado, v.liquidado, v.facturado > 0 ? `${Math.round((v.liquidado / v.facturado) * 100)}%` : "0%", v.pendiente]);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([["Período", "Facturado (esperado)", "Recaudado", "Liquidado", "% recaudo", "Pendiente"], ...periodRows]),
        "Recaudo por período",
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([["Unidad", "Deuda total", "# períodos", "Más antiguo"], ...morosos.map((m) => [m.unitLabel, m.deuda, m.periodos.length, m.periodos[0] ?? ""])]),
        "Morosos",
      );
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = `Historico-cartera-${stamp}.xlsx`;
      const path = `tenants/${tid}/cartera-history/${stamp}-${Date.now()}.xlsx`;
      const sref = storageRef(storage, path);
      await uploadBytes(sref, blob);
      const fileUrl = await getDownloadURL(sref);
      const { folderId } = await ensureSystemFolderCallable({ tenantId: tid, systemKey: "cartera_history" });
      await createDocumentRecord({
        tenantId: tid, userId: uid, userName: user?.fullName,
        fileName, fileUrl, storagePath: path, fileSize: blob.size, contentType: blob.type,
        category: "financiero", description: `Histórico de cartera al ${stamp}`,
        source: "cartera_history", sourceId: stamp, folderId,
      });
      toast.success("Histórico guardado en Documentos → “Histórico de cartera”.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingHistory(false);
    }
  }

  async function handleScheduleReminder() {
    const tid = user?.tenantId;
    const uid = user?.uid;
    if (!tid || !uid || !reminderTarget || !reminderDate) return;
    try {
      await createReminderJob({ tenantId: tid, userId: uid, campaignId: reminderTarget.campaignId, scheduledFor: reminderDate });
      toast.success(`Recordatorio programado para el ${reminderDate}. Se enviará a quienes sigan pendientes ese día.`);
      setReminderTarget(null);
      setReminderDate("");
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  const [remindingUnitId, setRemindingUnitId] = useState<string | null>(null);

  async function handleSendReminder(unitIds: string[], busyKey: string, successMsg: string, statementIds: string[] = []) {
    if (!user?.tenantId) return;
    const unique = Array.from(new Set(unitIds.filter(Boolean)));
    if (unique.length === 0) {
      toast.error("No hay unidades para recordar.");
      return;
    }
    setRemindingUnitId(busyKey);
    try {
      const res = await sendBillingReminderCallable({ tenantId: user.tenantId, unitIds: unique });
      // Trazabilidad: suma 1 al contador de recordatorios de esos cobros.
      await incrementReminderCount(Array.from(new Set(statementIds.filter(Boolean))));
      const sinCuenta = res.unitsWithoutRecipient ?? 0;
      toast.success(
        `${successMsg}: ${res.notified} residente(s)` +
          (sinCuenta > 0 ? ` · ${sinCuenta} unidad(es) sin residente con cuenta activa` : ""),
      );
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setRemindingUnitId(null);
    }
  }

  const [paymentTarget, setPaymentTarget] = useState<BillingStatement | null>(null);

  async function handleRowUpdate(input: {
    id: string;
    unitId: string;
    unitLabel: string;
    period: string;
    amount: number;
    paymentAmount: number;
    balance: number;
    dueDate?: string;
  }) {
    if (!user?.uid) return;
    if (inFlightUpdateIdRef.current === input.id) {
      logDebug("billing:edit:submit", { id: input.id, ignored: "already-in-flight" });
      return;
    }

    logDebug("billing:edit:submit", { id: input.id, unitLabel: input.unitLabel, period: input.period });
    inFlightUpdateIdRef.current = input.id;
    setSavingRowId(input.id);
    try {
      await updateBillingStatement(input.id, {
        unitId: input.unitId,
        unitLabel: input.unitLabel,
        period: input.period,
        amount: input.amount,
        paymentAmount: input.paymentAmount,
        balance: input.balance,
        dueDate: input.dueDate,
        userId: user.uid,
      });

      logDebug("billing:edit:success", { id: input.id });
      logDebug("billing:query:invalidate", { mode: "realtime-subscription" });
      logDebug("billing:toast:show", { type: "success", message: "Registro actualizado." });
      toast.success("Registro actualizado.");
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "No fue posible actualizar el registro.";
      logDebug("billing:toast:show", { type: "error", message });
      toast.error(message);
      throw new Error(message);
    } finally {
      inFlightUpdateIdRef.current = null;
      setSavingRowId(null);
    }
  }

  const handleDrawerRequestSubmit = useCallback((submit: (() => Promise<boolean>) | null) => {
    requestDrawerSubmitRef.current = submit;
  }, []);

  function handleOpenEditDrawer(item: BillingEditRecord) {
    logDebug("billing:drawer:open", { id: item.id, unitLabel: item.unitLabel });
    const switchingRecord = editingRecord && editingRecord.id !== item.id;
    if (isEditDrawerOpen && switchingRecord && isEditDrawerDirty) {
      setPendingSwitchRecord(item);
      setIsSwitchConfirmOpen(true);
      return;
    }

    setEditingRecord(item);
    setIsEditDrawerOpen(true);
  }

  function handleCloseEditDrawer() {
    logDebug("billing:drawer:close", {
      id: editingRecord?.id,
      dirty: isEditDrawerDirty,
    });
    setIsEditDrawerOpen(false);
    setIsEditDrawerDirty(false);
    setPendingSwitchRecord(null);
    setIsSwitchConfirmOpen(false);
  }

  function closeSwitchConfirm() {
    setIsSwitchConfirmOpen(false);
    setPendingSwitchRecord(null);
  }

  function handleDiscardAndSwitch() {
    if (!pendingSwitchRecord) return;
    setEditingRecord(pendingSwitchRecord);
    setIsEditDrawerOpen(true);
    setIsEditDrawerDirty(false);
    closeSwitchConfirm();
  }

  async function handleSaveAndSwitch() {
    if (!pendingSwitchRecord || !requestDrawerSubmitRef.current) return;
    setSwitchingAfterSave(true);
    try {
      const saved = await requestDrawerSubmitRef.current();
      if (!saved) return;

      setEditingRecord(pendingSwitchRecord);
      setIsEditDrawerOpen(true);
      setIsEditDrawerDirty(false);
      closeSwitchConfirm();
    } finally {
      setSwitchingAfterSave(false);
    }
  }

  function handleExportCsv() {
    const csv = buildCsvRows(
      filteredRows.map((item) => ({
        apartamento: item.unitLabel,
        fecha: item.period,
        monto: item.amount,
        abono: item.paymentAmount,
        saldo: item.balance,
        fecha_limite: item.dueDate,
        estado: item.status,
      })),
    );

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cartera-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadTemplate() {
    const csv = buildCsvRows([
      {
        unitLabel: "T1-101",
        period: "2026-03",
        amount: 1200000,
        paymentAmount: 0,
        dueDate: "2026-03-28",
      },
    ]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla-cartera.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  // Plantilla de carga inicial: la cartera con la que llega un conjunto nuevo.
  // Una fila por unidad; period = mes de arranque; amount = saldo pendiente; sin pago.
  function handleDownloadOpeningBalances() {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const csv = buildCsvRows([
      { unitLabel: "T1-101", period, amount: 450000, paymentAmount: 0, dueDate: "" },
      { unitLabel: "T1-102", period, amount: 0, paymentAmount: 0, dueDate: "" },
      { unitLabel: "T2-201", period, amount: 1200000, paymentAmount: 0, dueDate: "" },
    ]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla-saldos-iniciales.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportCsv(file: File) {
    if (!user?.tenantId) return;

    setIsImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });

      if (rows.length === 0) {
        toast.error("El archivo está vacío o no tiene datos.");
        return;
      }

      const requiredHeaders = ["unitLabel", "period", "amount"];
      const missingHeaders = requiredHeaders.filter((h) => !(h in rows[0]));
      if (missingHeaders.length > 0) {
        toast.error(`Columnas faltantes: ${missingHeaders.join(", ")}`);
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      // Unidades importadas con saldo, agrupadas por período (para el aviso agrupado).
      const importedByPeriod = new Map<string, Set<string>>();

      for (const row of rows) {
        const unitLabelRaw = String(row["unitLabel"] ?? "").trim();
        const period = String(row["period"] ?? "").trim();
        const amount = parseFloat(String(row["amount"] ?? "0").replace(/[^0-9.-]/g, ""));
        const paymentAmount = parseFloat(String(row["paymentAmount"] ?? "0").replace(/[^0-9.-]/g, ""));
        const dueDate = String(row["dueDate"] ?? "").trim() || undefined;

        if (!unitLabelRaw || !period || Number.isNaN(amount)) {
          errorCount += 1;
          errors.push(`Fila inválida: unitLabel="${unitLabelRaw}", period="${period}", amount="${String(row["amount"] ?? "")}"`);
          continue;
        }

        const matchedUnit = catalogUnits.find(
          (unit) => unit.label.trim().toLowerCase() === unitLabelRaw.toLowerCase(),
        );
        if (!matchedUnit) {
          errorCount += 1;
          errors.push(`Unidad no encontrada: "${unitLabelRaw}"`);
          continue;
        }

        const safePayment = Number.isNaN(paymentAmount) ? 0 : paymentAmount;
        const balance = Math.max(amount - safePayment, 0);
        try {
          await createBillingStatement({
            tenantId: user.tenantId,
            userId: user.uid,
            unitId: matchedUnit.id,
            unitLabel: matchedUnit.label,
            period,
            amount,
            paymentAmount: safePayment,
            balance,
            dueDate,
            source: "import",
          });
          successCount += 1;
          if (balance > 0) {
            const set = importedByPeriod.get(period) ?? new Set<string>();
            set.add(matchedUnit.id);
            importedByPeriod.set(period, set);
          }
        } catch (rowErr) {
          errorCount += 1;
          errors.push(`Error al guardar "${unitLabelRaw}" ${period}`);
          console.error("[billing import] row error", rowErr);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} registro(s) importado(s) correctamente.`);
      }
      if (errorCount > 0) {
        console.warn("[billing import] errores:", errors);
        toast.error(`${errorCount} fila(s) con error. Revisa la consola para detalles.`);
      }

      // Aviso agrupado a los residentes (1 por unidad con saldo, por período).
      for (const [period, unitIds] of importedByPeriod) {
        try {
          await notifyBillingBatchCallable({ tenantId: user.tenantId, period, unitIds: Array.from(unitIds) });
        } catch (notifyErr) {
          console.error("[billing import] notify error", notifyErr);
        }
      }
    } catch (err) {
      console.error("[billing import] parse error", err);
      toast.error("No se pudo leer el archivo. Verifica que sea un Excel o CSV válido.");
    } finally {
      setIsImporting(false);
    }
  }

  function handlePrintOverdueNotice() {
    const printable = overdueRows
      .map((item) => `${item.unitLabel} | saldo ${formatAmount(item.balance)} | vence ${item.dueDate || "-"}`)
      .join("\n");
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return;
    popup.document.write(`<pre style=\"font-family:Arial;padding:24px;white-space:pre-wrap\">Notificación de cartera en mora\n\n${bulkMessage}\n\n${printable}</pre>`);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  function handleToggleBulkUnit(unitId: string) {
    setSelectedBulkUnitIds((current) =>
      current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId],
    );
  }

  function handleToggleAllBulkUnits() {
    setSelectedBulkUnitIds((current) => {
      if (current.length === catalogUnits.length) return [];
      return catalogUnits.map((unit) => unit.id);
    });
  }

  async function handleSendOverdueBulkMessage() {
    if (selectedBulkUnitIds.length === 0) {
      toast.error("Selecciona al menos una unidad para enviar el mensaje.");
      return;
    }

    if (bulkMessage.trim().length === 0) {
      toast.error("Escribe el mensaje antes de enviarlo.");
      return;
    }

    if (!user?.tenantId) return;

    setIsBulkSending(true);
    try {
      await createCommunication(user.tenantId, user.uid, {
        title: "Aviso de cartera — Saldo pendiente",
        message: bulkMessage.trim(),
        status: "published",
      });
      toast.success(`Comunicado enviado a los residentes (${selectedBulkUnitIds.length} unidad(es) en mora).`);
      setIsBulkDrawerOpen(false);
      setSelectedBulkUnitIds([]);
      setBulkMessage("Recordatorio: tienes cartera en mora. Por favor realiza tu abono para evitar recargos.");
    } catch (err) {
      console.error("[billing] bulk message error", err);
      toast.error("No se pudo enviar el comunicado. Intenta de nuevo.");
    } finally {
      setIsBulkSending(false);
    }
  }

  return (
    <section className="space-y-4">
      <SectionIntro
        storageKey="cartera"
            icon={Wallet}
            tone="lavender"
        title="Cartera"
        purpose="Controlar lo que cada unidad debe y lo que ha pagado (cuotas o alícuotas de administración)."
        how="Generas los cobros del período por unidad, registras los pagos recibidos y emites el comprobante a cada residente. Los pagos alimentan el Libro y fondos."
      />
      {soloConsulta ? (
        <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] px-4 py-3 text-sm text-[var(--slate-600)]">
          <span className="font-medium text-[var(--slate-800)]">Modo consulta.</span> La cartera de este conjunto se administra fuera de Vivaru. Aquí solo se consulta el estado de cuenta y los comprobantes; la creación y programación de cobros, el cierre de períodos y los avisos masivos están desactivados.
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsBulkDrawerOpen(true)}>
            <SendHorizontal className="mr-2 h-4 w-4" />
            Enviar aviso a residentes
          </Button>
        </div>
      )}
      <WidgetErrorBoundary label="el gráfico de cartera">
      <ChartContainer
        title="Comportamiento histórico de cartera"
        description="Comparativo de cobrado y recaudado por período con lectura inmediata de brecha y porcentaje de recaudo."
        helpText="Aquí puedes ver de un vistazo cómo evoluciona tu recaudo mes a mes. Las barras azules son lo que cobras; las verdes, lo que efectivamente ingresa. Cuanto más se acerquen ambas barras, mejor está tu cartera. La línea muestra el porcentaje de recaudo. Los filtros de unidad y fecha de este gráfico son independientes de los filtros de la tabla que están más abajo."
        controls={
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-sm text-[var(--slate-700)]">
              Unidad
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                value={chartUnitFilter}
                onChange={(event) => setChartUnitFilter(event.target.value)}
              >
                <option value="all">Todas</option>
                {chartUnitOptions
                  .filter((value) => value !== "all")
                  .map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm text-[var(--slate-700)] sm:col-span-2 lg:col-span-2">
              Rango
              <div className="mt-1">
                <RangePicker
                  className="block w-full"
                  triggerClassName="w-full"
                  value={rangeValue}
                  onChange={handleRangeChange}
                  placeholder="Seleccionar rango"
                />
              </div>
            </label>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile tone="blue" label="Cobrado" value={formatAmount(trendSummary.totalCharged)} />
          <StatTile tone="green" label="Recaudado" value={formatAmount(trendSummary.totalCollected)} />
          {/* «Pendiente», no «Brecha»: el tooltip del gráfico de al lado ya
              llamaba así a este MISMO número, y dos nombres para una cifra
              invitan a buscarles la diferencia. */}
          <StatTile tone="amber" label="Pendiente" value={formatAmount(trendSummary.gap)} />
          <StatTile tone="blue" label="% recaudo" value={`${trendSummary.collectionRate.toFixed(1)}%`} />
        </div>

        {chartData.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--slate-300)] bg-[var(--slate-50)] px-4 py-8 text-center text-sm text-[var(--slate-600)]">
            No hay datos suficientes para construir la tendencia de cartera con los filtros actuales.
          </div>
        ) : (
          <div className="mt-4 h-[320px] rounded-2xl border border-[var(--slate-200)] bg-white px-2 py-2 sm:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={chartMargin}>
                <CartesianGrid {...chartGrid} />
                <XAxis dataKey="period" tickFormatter={formatPeriodLabel} {...chartAxis} />
                <YAxis
                  yAxisId="money"
                  tickFormatter={(value) => formatAmountCompact(Number(value))}
                  {...chartAxis}
                />
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                  {...chartAxis}
                />
                <Tooltip content={<BillingTrendTooltip formatAmount={formatAmount} />} />
                <Bar yAxisId="money" dataKey="totalCharged" name="Cobrado" fill={chartColors.barBlue} {...chartBar} />
                <Bar yAxisId="money" dataKey="totalCollected" name="Recaudado" fill={chartColors.barGreen} {...chartBar} />
                <Line yAxisId="rate" dataKey="collectionRate" name="% recaudo" {...chartLine} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartContainer>
      </WidgetErrorBoundary>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--slate-900)]">Tableros financieros</h2>
          <PeriodFilter value={periodMonths} onChange={setPeriodMonths} />
        </div>

        <TableroCarousel ariaLabel="Tableros financieros de cartera">
          <LiquidezTablero
            tenantId={user?.tenantId}
            cuotaIncome={cuotaIncome}
            months={periodMonths}
            formatAmount={formatAmount}
            formatAmountCompact={formatAmountCompact}
          />
          <CuentasPorPagarTablero
            tenantId={user?.tenantId}
            periodMonths={periodMonths}
            formatAmount={formatAmount}
            formatAmountCompact={formatAmountCompact}
          />
          <FlujoCajaTablero
            tenantId={user?.tenantId}
            statements={items}
            periodMonths={periodMonths}
            formatAmount={formatAmount}
            formatAmountCompact={formatAmountCompact}
          />
        </TableroCarousel>
      </div>

      {/* Envuelto como todo lo que consume datos del conjunto: sin el, un fallo
          leyendo anticipos tumba la ruta /admin entera y el administrador ve
          «No pudimos cargar el workspace» en vez de perder una seccion.
          Quien decide si se pinta es el panel, no la bandera: apagarla no puede
          esconder dinero que ya existe. */}
      <WidgetErrorBoundary label="los anticipos">
        <AdvancesPanel tenantId={user?.tenantId} statements={items} formatAmount={formatAmount} />
      </WidgetErrorBoundary>

      <WidgetErrorBoundary label="la revisión de comprobantes">
        <PaymentReceiptsReviewPanel
          tenantId={user?.tenantId}
          reviewerId={user?.uid}
          reviewerName={user?.fullName}
          statements={items}
        />
      </WidgetErrorBoundary>

      {!soloConsulta && (
      <Card id="guia-crear-cobro" className="soft-panel scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle>Crear nuevo cobro</CardTitle>
            <HelpTip text="Registra aquí la cuota mensual de una unidad. Si el residente ya realizó un pago parcial, anótalo en el campo Abono desde el inicio. La Fecha de recaudo es la fecha límite de pago, no la fecha en que llegó el dinero. El estado se asigna automáticamente: saldo en cero queda Al día, saldo pendiente antes de la fecha límite queda Pendiente, y saldo pendiente con fecha vencida pasa a En mora. Si no registras una fecha límite, se usa el mes del cobro: un mes ya pasado con saldo pendiente queda En mora. Ten presente que el sistema permite registrar más de un cobro para la misma unidad y mes." />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setImportModalOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar cobros (Excel)
          </Button>
        </div>
        <CardDescription className="mt-1">
          Elige a quién cobrar (una unidad o un lote), el concepto y el valor. Si quieres, programa la fecha en que el cobro se publica y se notifica a los residentes.
        </CardDescription>
        <p className="mt-3 text-sm font-semibold text-[var(--slate-800)]">{billingFormTitle}</p>

        {createResult ? (
          <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <p className="text-sm text-emerald-800">{createResult}</p>
            <button
              type="button"
              onClick={() => setCreateResult(null)}
              className="shrink-0 rounded-lg px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              aria-label="Cerrar aviso"
            >
              Entendido
            </button>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div className="text-sm text-[var(--slate-700)]">
            <span className="block">Destinatario</span>
            <div className="mt-1 inline-flex rounded-xl border border-[var(--slate-300)] p-0.5">
              <button
                type="button"
                onClick={() => setChargeMode("individual")}
                className={`rounded-lg px-3 py-1.5 text-sm ${chargeMode === "individual" ? "bg-[var(--slate-900)] text-white" : "text-[var(--slate-600)]"}`}
              >
                Una unidad
              </button>
              <button
                type="button"
                onClick={() => setChargeMode("batch")}
                className={`rounded-lg px-3 py-1.5 text-sm ${chargeMode === "batch" ? "bg-[var(--slate-900)] text-white" : "text-[var(--slate-600)]"}`}
              >
                Lote (varias)
              </button>
            </div>
          </div>
          {cobroPorCoeficiente ? (
            <Button type="button" variant="outline" onClick={() => setCoefficientDialogOpen(true)}>
              Generar por {vocab.coeficienteCorto}
            </Button>
          ) : null}
          <label className="text-sm text-[var(--slate-700)]">
            Programar para (opcional)
            <input
              type="date"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
              className="mt-1 block h-11 rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)]"
            />
          </label>
          {scheduledFor ? (
            <p className="text-xs text-[var(--slate-500)]">Se publicará automáticamente esa fecha; el residente no lo verá antes.</p>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-[var(--slate-500)]">
          {chargeMode === "batch"
            ? "Lote: crea el mismo cobro para todas las unidades que dejes marcadas abajo."
            : "Una unidad: registra un cobro individual (puedes anotar un abono inicial)."}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-6">
          <label className="text-sm text-[var(--slate-700)]">
            Concepto
            <select
              className="mt-1 h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)]"
              value={concept}
              onChange={(event) => setConcept(event.target.value as BillingConcept)}
            >
              {BILLING_CONCEPTS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {chargeMode === "individual" ? (
          <label className="text-sm text-[var(--slate-700)]">
            Unidad
            <select
              className="mt-1 h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)]"
              value={selectedUnitId}
              disabled={catalogUnitsLoading || catalogUnits.length === 0}
              onChange={(event) => {
                const nextId = event.target.value;
                const selected = catalogUnits.find((unit) => unit.id === nextId);
                setSelectedUnitId(nextId);
                setUnitLabel(selected?.label ?? "");
              }}
            >
              {catalogUnitsLoading ? <option value="">Cargando unidades...</option> : null}
              {!catalogUnitsLoading && catalogUnits.length === 0 ? <option value="">Sin unidades disponibles</option> : null}
              {catalogUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </select>
          </label>
          ) : null}
          <Input label="Fecha" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Input
            label={concept === "administracion" ? "Valor administración" : "Valor"}
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(formatCurrencyInput(event.target.value))}
          />
          {chargeMode === "individual" && !scheduledFor ? (
            <Input
              label="Abono"
              inputMode="numeric"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(formatCurrencyInput(event.target.value))}
            />
          ) : null}
          <Input label="Fecha de recaudo" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </div>
        {chargeMode === "batch" ? (
          <div className="mt-3 rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--slate-800)]">
                Unidades del lote: {batchTargets.length} de {catalogUnits.length}
              </p>
              <div className="flex gap-3 text-xs">
                <button type="button" className="text-[var(--slate-700)] underline" onClick={() => setExcludedUnits(new Set())}>
                  Todas
                </button>
                <button type="button" className="text-[var(--slate-600)] underline" onClick={() => setExcludedUnits(new Set(catalogUnits.map((u) => u.id)))}>
                  Ninguna
                </button>
              </div>
            </div>
            {duplicateLabels.size > 0 ? (
              <p className="mt-1 text-[11px] text-amber-700">
                Hay unidades con el mismo nombre; revisa antes de cobrar al lote para no duplicar el cobro a una misma unidad.
              </p>
            ) : null}
            <div className="mt-2 grid max-h-44 grid-cols-2 gap-x-4 gap-y-1 overflow-auto sm:grid-cols-3 lg:grid-cols-4">
              {catalogUnits.map((u) => (
                <label key={u.id} className="flex items-center gap-1.5 text-xs text-[var(--slate-700)]">
                  <input
                    type="checkbox"
                    checked={!excludedUnits.has(u.id)}
                    onChange={(event) =>
                      setExcludedUnits((prev) => {
                        const next = new Set(prev);
                        if (event.target.checked) next.delete(u.id);
                        else next.add(u.id);
                        return next;
                      })
                    }
                  />
                  <span className="truncate">{u.label}</span>
                  {duplicateLabels.has(u.label) ? (
                    <span className="shrink-0 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700">repetida</span>
                  ) : null}
                </label>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-[var(--slate-700)]">
            {chargeMode === "batch"
              ? <>Lote: <strong>{batchTargets.length} unidad(es)</strong></>
              : <>Unidad seleccionada: <strong>{unitLabel || "-"}</strong></>}
          </div>
          <Button
            className="w-full sm:w-auto"
            onClick={() => setConfirmCreateOpen(true)}
            disabled={!date || !amount || (chargeMode === "individual" && !selectedUnitId) || (chargeMode === "batch" && batchTargets.length === 0)}
          >
            {scheduledFor ? "Programar" : chargeMode === "batch" ? "Crear lote" : "Registrar"}
          </Button>
        </div>

        {/* Confirmación con preview: un cobro emite notificación al residente y no
            siempre puede anularse — nunca registrar con un solo clic (VIV-1104). */}
        <Modal
          open={confirmCreateOpen}
          title={scheduledFor ? "Confirmar programación del cobro" : "Confirmar registro del cobro"}
          onClose={() => (creatingCharge ? undefined : setConfirmCreateOpen(false))}
        >
          <div className="space-y-3 text-sm text-[var(--slate-700)]">
            <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5">
              <dt className="font-medium text-[var(--slate-500)]">Destinatario</dt>
              <dd className="text-[var(--slate-900)]">
                {chargeMode === "batch" ? `${batchTargets.length} unidad(es)` : unitLabel || "—"}
              </dd>
              <dt className="font-medium text-[var(--slate-500)]">Concepto</dt>
              <dd className="text-[var(--slate-900)]">{billingConceptLabel(concept)}</dd>
              <dt className="font-medium text-[var(--slate-500)]">Monto por unidad</dt>
              <dd className="font-semibold text-[var(--slate-900)]">{formatAmount(parseCurrency(amount))}</dd>
              <dt className="font-medium text-[var(--slate-500)]">Período</dt>
              <dd className="text-[var(--slate-900)]">{date ? date.slice(0, 7) : "—"}</dd>
              <dt className="font-medium text-[var(--slate-500)]">Vencimiento</dt>
              <dd className="text-[var(--slate-900)]">{dueDate || "Sin fecha"}</dd>
            </dl>
            <p className="rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--slate-600)]">
              {scheduledFor
                ? `El cobro se ejecutará automáticamente el ${scheduledFor}; podrás cancelarlo antes en “Cobros programados”.`
                : "Al confirmar, el cobro queda registrado y el residente recibirá la notificación en su portal."}
            </p>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setConfirmCreateOpen(false)} disabled={creatingCharge}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setCreatingCharge(true);
                  void handleCreate().finally(() => {
                    setCreatingCharge(false);
                    setConfirmCreateOpen(false);
                  });
                }}
                disabled={creatingCharge}
              >
                {creatingCharge ? "Registrando…" : scheduledFor ? "Confirmar y programar" : "Confirmar y registrar"}
              </Button>
            </div>
          </div>
        </Modal>

        {catalogUnitsLoading ? <p className="mt-3 text-xs text-[var(--slate-600)]">Estamos cargando el listado de unidades del conjunto.</p> : null}
        {catalogUnitsError ? <p className="mt-3 text-xs text-[var(--danger-700)]">{catalogUnitsError}</p> : null}
      </Card>
      )}

      {!soloConsulta && scheduledCharges.length > 0 ? (
        <Card className="soft-panel">
          <CardTitle>Cobros programados</CardTitle>
          <CardDescription className="mt-1">
            Se publican automáticamente en su fecha. Puedes cancelarlos antes de que se publiquen.
          </CardDescription>
          <ul className="mt-4 space-y-2">
            {scheduledCharges.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--slate-200)] bg-white px-3 py-2">
                <div className="text-sm text-[var(--slate-800)]">
                  <span className="font-medium">{billingConceptLabel(s.concept)}</span> · {formatAmount(s.amount)} · {s.period}
                  <span className="block text-xs text-[var(--slate-500)]">
                    {s.isBatch ? `Lote · ${s.targets?.length ?? 0} unidad(es)` : `Unidad ${s.targets?.[0]?.unitLabel ?? "-"}`} · publica {s.scheduledFor}
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => void handleCancelSchedule(s.id)}>
                  Cancelar
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".csv,.xlsx"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleImportCsv(file);
            event.target.value = "";
          }
        }}
      />

      <Modal open={importModalOpen} title="Importar cobros desde Excel" onClose={() => setImportModalOpen(false)}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--slate-600)]">
            Carga muchos cobros de una vez en lugar de uno por uno. Las unidades deben existir
            antes (módulo de residentes).
          </p>
          <ol className="flex flex-col gap-3">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-700)] text-[10px] font-bold text-white">1</span>
              <div>
                <p className="text-sm font-medium text-[var(--slate-800)]">Descarga la plantilla y complétala</p>
                <p className="text-xs text-[var(--slate-500)]">Una fila por cobro: unidad, período, valor y abono.</p>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={handleDownloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar plantilla de ejemplo
                </Button>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-700)] text-[10px] font-bold text-white">2</span>
              <div>
                <p className="text-sm font-medium text-[var(--slate-800)]">Sube el archivo completado</p>
                <p className="text-xs text-[var(--slate-500)]">Aceptamos .xlsx y .csv.</p>
                <Button type="button" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                  <Upload className="mr-2 h-4 w-4" />
                  {isImporting ? "Importando..." : "Subir e importar"}
                </Button>
              </div>
            </li>
          </ol>
          <details className="group rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] px-3 py-2">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-[var(--slate-600)]">
              <span className="transition-transform group-open:rotate-90">▸</span>
              Carga inicial del conjunto — solo al abrir
            </summary>
            <p className="mt-2 text-xs text-[var(--slate-500)]">
              Para arrancar un conjunto nuevo con la cartera que ya trae: una fila por unidad con su
              saldo pendiente (período = mes de arranque, valor = deuda, abono = 0). Descarga esta
              plantilla, complétala y súbela con el paso 2.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={handleDownloadOpeningBalances}>
              <Download className="mr-2 h-4 w-4" />
              Plantilla de saldos iniciales
            </Button>
          </details>
        </div>
      </Modal>

      <div className="inline-flex flex-wrap rounded-xl border border-[var(--slate-300)] bg-white p-0.5">
        {([
          { key: "campaigns", label: "Campañas" },
          { key: "individuals", label: "Cobros individuales" },
          { key: "byUnit", label: "Por unidad" },
          { key: "overdue", label: "Cartera vencida" },
          { key: "morosos", label: "Morosos" },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setListView(t.key);
              if (t.key !== "byUnit") setCampaignFilter(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${listView === t.key ? "bg-[var(--slate-900)] text-white" : "text-[var(--slate-600)]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {listView === "campaigns" ? (
        <Card className="soft-panel">
          <CardTitle>Campañas de cobro</CardTitle>
          <CardDescription className="mt-1">
            Cada lote enviado, con su recaudo. Mantenimiento y Administración primero. Abre una campaña para ver su detalle por unidad.
          </CardDescription>
          {campaignRows.length === 0 ? (
            <div className="mt-3"><EmptyState title="Sin campañas" description="Crea un cobro en lote para ver aquí su campaña y su recaudo." /></div>
          ) : (
          <div className="responsive-table-wrap mt-3 rounded-xl border border-[var(--slate-200)]">
            <table className="responsive-table min-w-[820px] text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[var(--slate-200)] bg-[var(--slate-100)] text-[var(--slate-700)]">
                  <th className="px-3 py-2 font-medium text-left">Concepto</th>
                  <th className="px-3 py-2 font-medium text-left">Período</th>
                  <th className="px-3 py-2 font-medium text-left">Enviado</th>
                  <th className="px-3 py-2 font-medium text-left"># unidades</th>
                  <th className="px-3 py-2 font-medium text-left">Valor</th>
                  <th className="px-3 py-2 font-medium text-left">Recaudado / Pendiente</th>
                  <th className="px-3 py-2 font-medium text-left">% recaudo</th>
                  <th className="px-3 py-2 font-medium text-left">Estado</th>
                  <th className="px-3 py-2 font-medium text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {campaignRows.map(({ c, recaudado, pendiente, pendientesUnitIds, pendientesStatementIds, unitCount, pct }) => (
                  <tr key={c.id} className={`border-b border-[var(--slate-100)] ${campaignFilter === c.id ? "bg-[var(--slate-50)]" : ""}`}>
                    <td className="px-3 py-2 font-medium text-[var(--slate-800)]">{billingConceptLabel(c.concept)}</td>
                    <td className="px-3 py-2">{formatTableDate(c.period)}</td>
                    <td className="px-3 py-2">{formatSentAt(c.sentAt)}</td>
                    <td className="px-3 py-2">{unitCount}</td>
                    <td className="px-3 py-2">{formatAmount(c.unitAmount)}</td>
                    <td className="px-3 py-2">{formatAmount(recaudado)} / {formatAmount(pendiente)}</td>
                    <td className="px-3 py-2">{pct}%</td>
                    <td className="px-3 py-2">{c.status === "cerrada" ? "Cerrada" : "Vigente"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setCampaignFilter(c.id); setListView("byUnit"); }}>
                          Ver detalle
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendientesUnitIds.length === 0 || remindingUnitId === `camp-${c.id}`}
                          onClick={() => {
                            setReminderTarget({
                              campaignId: c.id,
                              label: `${billingConceptLabel(c.concept)} · ${formatTableDate(c.period)}`,
                              unitIds: pendientesUnitIds,
                              statementIds: pendientesStatementIds,
                            });
                            setReminderDate("");
                          }}
                        >
                          <IconBadge tone="sand" className="mr-2">
                            <SendHorizontal className="h-4 w-4" />
                          </IconBadge>
                          {remindingUnitId === `camp-${c.id}` ? "Enviando..." : "Recordar a pendientes"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </Card>
      ) : null}

      {listView !== "campaigns" && listView !== "morosos" ? (
      <Card>
        <MobileFiltersPanel
          title="Filtros de cartera"
          collapsibleOnDesktop
          defaultOpen={false}
          openLabel="Filtros de cartera"
          closeLabel="Ocultar filtros"
          activeFiltersCount={carteraActiveFilters}
          helpText="Filtra por estado, unidad, concepto o período, o combínalos para afinar. El resultado es instantáneo. Estos filtros no tocan el gráfico de arriba. Al exportar, el archivo refleja lo que estás viendo."
          footer={
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => {
              setStatusFilter("all");
              setUnitFilter("all");
              setConceptFilter("all");
              setPeriodFilter("all");
            }}>
              Limpiar filtros
            </Button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Estado
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as BillingStatusFilter)}>
                <option value="all">Todos</option>
                <option value="paid">Al día</option>
                <option value="pending">Pendiente</option>
                <option value="overdue">En mora</option>
              </select>
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Unidad
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}>
                <option value="all">Todas</option>
                {allUnitLabels.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Concepto
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" value={conceptFilter} onChange={(event) => setConceptFilter(event.target.value as BillingConcept | "all")}>
                <option value="all">Todos</option>
                {BILLING_CONCEPTS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Período
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}>
                <option value="all">Todos</option>
                {periodOptions.map((p) => (
                  <option key={p} value={p}>{formatTableDate(p)}</option>
                ))}
              </select>
            </label>
          </div>
        </MobileFiltersPanel>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[var(--slate-500)]">
            {loading ? "Cargando registros..." : (
              carteraActiveFilters === 0 && !campaignFilter
                ? `${filteredRows.length} registro${filteredRows.length !== 1 ? "s" : ""}`
                : `${filteredRows.length} de ${normalizedRows.length} registro${normalizedRows.length !== 1 ? "s" : ""}`
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {campaignFilter ? (
              <button
                type="button"
                onClick={() => setCampaignFilter(null)}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--slate-300)] bg-white px-3 py-1 text-xs font-medium text-[var(--slate-700)] hover:bg-[var(--slate-100)]"
              >
                Viendo una campaña · quitar filtro ✕
              </button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Descargar a Excel
            </Button>
          </div>
        </div>

        {listView === "overdue" ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-amber-700">
              Todos los cobros con saldo, incluida la mora de meses ya cerrados. Recuérdales o registra su pago desde aquí.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={handlePrintOverdueNotice}>
                <IconBadge tone="sand" className="mr-2">
                  <Printer className="h-4 w-4" />
                </IconBadge>
                Imprimir aviso de mora
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={overdueRows.length === 0 || remindingUnitId === "__overdue__"}
                onClick={() => void handleSendReminder(overdueRows.map((r) => r.unitId), "__overdue__", "Recordatorio enviado a cartera vencida", overdueRows.map((r) => r.id))}
              >
                <IconBadge tone="sand" className="mr-2">
                  <SendHorizontal className="h-4 w-4" />
                </IconBadge>
                {remindingUnitId === "__overdue__" ? "Enviando..." : "Recordar a todos"}
              </Button>
            </div>
          </div>
        ) : null}

        {campaignFilter ? (() => {
          const sel = campaignRows.find((r) => r.c.id === campaignFilter);
          if (!sel) return null;
          const scheduled = reminderJobs.filter((j) => j.campaignId === sel.c.id).length;
          return (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] px-3 py-2 text-xs">
                <span className="font-semibold text-[var(--slate-800)]">{billingConceptLabel(sel.c.concept)} · {formatTableDate(sel.c.period)}</span>
                <span className="text-[var(--slate-600)]">Emitidos <strong>{sel.unitCount}</strong></span>
                <span className="text-[var(--slate-400)]">→</span>
                <span className="text-[var(--slate-600)]">Notificados <strong>{sel.unitCount}</strong></span>
                <span className="text-[var(--slate-400)]">→</span>
                <span className="text-emerald-700">Pagados <strong>{sel.paidCount}</strong></span>
                <span className="rounded-full bg-white px-2 py-0.5 font-medium text-[var(--slate-700)]">{sel.pct}% recaudo</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--slate-200)] bg-white px-3 py-2 text-xs">
                <span className="text-[var(--slate-600)]">Notificación enviada: <strong>{formatSentAt(sel.c.sentAt)}</strong></span>
                <span className="text-[var(--slate-400)]">·</span>
                <span className="text-[var(--slate-600)]">Recordatorios enviados: <strong>{sel.reminders}</strong></span>
                {scheduled > 0 ? (
                  <>
                    <span className="text-[var(--slate-400)]">·</span>
                    <span className="text-amber-700">Programados:</span>
                    {reminderJobs
                      .filter((j) => j.campaignId === sel.c.id)
                      .map((j) => (
                        <button
                          key={j.id}
                          type="button"
                          onClick={() => void cancelReminderJob(j.id)}
                          title="Cancelar recordatorio programado"
                          className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700 hover:bg-amber-100"
                        >
                          {j.scheduledFor} ✕
                        </button>
                      ))}
                  </>
                ) : null}
              </div>
            </>
          );
        })() : null}

        <div className="responsive-table-wrap mt-2 rounded-xl border border-[var(--slate-200)]">
          <table className="responsive-table min-w-[860px] text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-[var(--slate-200)] bg-[var(--slate-100)] text-[var(--slate-700)]">
              <th className="px-3 py-2 font-medium text-left">Apartamento</th>
              <th className="px-3 py-2 font-medium text-left">Fecha</th>
              <th className="px-3 py-2 font-medium text-left">Monto</th>
              <th className="px-3 py-2 font-medium text-left">Abono</th>
              <th className="px-3 py-2 font-medium text-left">Saldo</th>
              <th className="px-3 py-2 font-medium text-left">Fecha límite</th>
              <th className="px-3 py-2 font-medium text-left">Estado</th>
              <th className="px-3 py-2 font-medium text-left">Comprobante</th>
              <th className="px-3 py-2 font-medium text-left">Recordatorios</th>
              <th className="px-3 py-2 font-medium text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`} className="border-b border-[var(--slate-100)]">
                  <td className="px-3 py-2.5"><Skeleton className="h-3.5 w-20 rounded" /></td>
                  <td className="px-3 py-2.5"><Skeleton className="h-3.5 w-16 rounded" /></td>
                  <td className="px-3 py-2.5"><Skeleton className="h-3.5 w-24 rounded" /></td>
                  <td className="px-3 py-2.5"><Skeleton className="h-3.5 w-20 rounded" /></td>
                  <td className="px-3 py-2.5"><Skeleton className="h-3.5 w-20 rounded" /></td>
                  <td className="px-3 py-2.5"><Skeleton className="h-3.5 w-20 rounded" /></td>
                  <td className="px-3 py-2.5"><Skeleton className="h-5 w-16 rounded-full" /></td>
                  <td className="px-3 py-2.5"><Skeleton className="h-3.5 w-20 rounded" /></td>
                  <td className="px-3 py-2.5"><Skeleton className="h-3.5 w-8 rounded" /></td>
                  <td className="px-3 py-2.5"><Skeleton className="h-7 w-16 rounded-xl" /></td>
                </tr>
              ))
            ) : null}
            {!loading && filteredRows.length === 0 ? (
              <tr>
                <td className="px-3 py-2" colSpan={10}>
                  <EmptyState
                    title="Sin estados de cuenta"
                    description="No hay facturación registrada para este conjunto con los filtros actuales."
                  />
                </td>
              </tr>
            ) : null}
            {billingPager.pageItems.map((item) => {
              const status = computeStatementStatus(item.balance, { dueDate: item.dueDate, period: item.period });
              const isPaid = status === "paid";
              return (
              <tr key={item.id} className="border-b border-[var(--slate-100)]">
                <td className="px-3 py-2">
                  <div>{item.unitLabel}</div>
                  {item.concept && item.concept !== "administracion" ? (
                    <div className="text-[11px] text-[var(--slate-500)]">{billingConceptLabel(item.concept)}</div>
                  ) : null}
                </td>
                <td className="px-3 py-2">{formatTableDate(item.period)}</td>
                <td className="px-3 py-2">{formatAmount(item.amount)}</td>
                <td className="px-3 py-2">{formatAmount(item.paymentAmount)}</td>
                <td className="px-3 py-2">{formatAmount(item.balance)}</td>
                <td className="px-3 py-2">{formatTableDate(item.dueDate)}</td>
                <td className="px-3 py-2">
                  {isPaid ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <IconBadge tone="mint">
                        <CheckCircle2 className="h-4 w-4" />
                      </IconBadge>
                      Al día
                    </span>
                  ) : status === "overdue" ? (
                    <span className="inline-flex items-center gap-1 text-red-700">
                      <IconBadge tone="peach">
                        <AlertCircle className="h-4 w-4" />
                      </IconBadge>
                      En mora
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <IconBadge tone="sand">
                        <Clock3 className="h-4 w-4" />
                      </IconBadge>
                      Pendiente
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {(() => {
                    const rcpt = receiptByStatementId.get(item.id);
                    if (!rcpt) return <span className="text-[var(--slate-400)]">—</span>;
                    return (
                      <a
                        href={rcpt.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-xl border border-[var(--slate-300)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--slate-700)] hover:bg-[var(--slate-100)]"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        Ver
                      </a>
                    );
                  })()}
                </td>
                <td className="px-3 py-2">
                  {item.reminderCount ? (
                    <span className="font-medium text-[var(--slate-700)]">{item.reminderCount}</span>
                  ) : (
                    <span className="text-[var(--slate-400)]">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={savingRowId === item.id}
                    onClick={() => {
                      handleOpenEditDrawer({
                        id: item.id,
                        unitId: item.unitId,
                        unitLabel: item.unitLabel,
                        period: item.period,
                        amount: item.amount,
                        paymentAmount: item.paymentAmount,
                        balance: item.balance,
                        dueDate: item.dueDate,
                      });
                    }}
                  >
                    <IconBadge tone="sky" className="mr-2">
                      <PenSquare className="h-4 w-4" />
                    </IconBadge>
                    {savingRowId === item.id ? "Guardando..." : "Editar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPaymentTarget({
                        id: item.id,
                        tenantId: user?.tenantId ?? "",
                        unitId: item.unitId,
                        unitLabel: item.unitLabel,
                        period: item.period,
                        amount: item.amount,
                        paymentAmount: item.paymentAmount,
                        balance: item.balance,
                        dueDate: item.dueDate,
                        status,
                      })
                    }
                  >
                    <IconBadge tone="mint" className="mr-2">
                      <Banknote className="h-4 w-4" />
                    </IconBadge>
                    Registrar cobro
                  </Button>
                  {!isPaid ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={remindingUnitId === item.id}
                      onClick={() => void handleSendReminder([item.unitId], item.id, "Recordatorio enviado", [item.id])}
                    >
                      <IconBadge tone="sand" className="mr-2">
                        <SendHorizontal className="h-4 w-4" />
                      </IconBadge>
                      {remindingUnitId === item.id ? "Enviando..." : "Recordar"}
                    </Button>
                  ) : null}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {billingPager.hasPagination ? (
        <TablePager
          page={billingPager.page}
          totalPages={billingPager.totalPages}
          total={billingPager.total}
          start={billingPager.start}
          pageSize={billingPager.pageSize}
          onPrev={billingPager.prev}
          onNext={billingPager.next}
          onPageSizeChange={billingPager.setPageSize}
        />
      ) : null}
      </Card>
      ) : null}

      {listView === "morosos" ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Morosos</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-[var(--slate-700)]">{morosos.length} unidad(es) · deuda total <strong>{formatAmount(morososTotal)}</strong></p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={morosos.length === 0 || remindingUnitId === "__morosos__"}
                onClick={() => void handleSendReminder(morosos.map((m) => m.unitId), "__morosos__", "Recordatorio enviado a morosos", morosos.flatMap((m) => m.statementIds))}
              >
                <IconBadge tone="sand" className="mr-2">
                  <SendHorizontal className="h-4 w-4" />
                </IconBadge>
                {remindingUnitId === "__morosos__" ? "Enviando..." : "Recordar a todos"}
              </Button>
            </div>
          </div>
          <CardDescription className="mt-1">
            Unidades con saldo pendiente (incluye la mora de períodos cerrados), ordenadas por deuda.
          </CardDescription>
          {morosos.length === 0 ? (
            <div className="mt-3"><EmptyState title="Sin morosos" description="Ninguna unidad tiene saldo pendiente." /></div>
          ) : (
            <div className="responsive-table-wrap mt-3 rounded-xl border border-[var(--slate-200)]">
              <table className="responsive-table min-w-[760px] text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[var(--slate-200)] bg-[var(--slate-100)] text-[var(--slate-700)]">
                    <th className="px-3 py-2 font-medium text-left">Unidad</th>
                    <th className="px-3 py-2 font-medium text-left">Deuda total</th>
                    <th className="px-3 py-2 font-medium text-left"># períodos</th>
                    <th className="px-3 py-2 font-medium text-left">Más antiguo</th>
                    <th className="px-3 py-2 font-medium text-left">Último pago</th>
                    <th className="px-3 py-2 font-medium text-left">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {morosos.map((m) => (
                    <tr key={m.unitId} className="border-b border-[var(--slate-100)]">
                      <td className="px-3 py-2 font-medium text-[var(--slate-800)]">{m.unitLabel}</td>
                      <td className="px-3 py-2 font-semibold text-red-700">{formatAmount(m.deuda)}</td>
                      <td className="px-3 py-2">{m.periodos.length}</td>
                      <td className="px-3 py-2">{formatTableDate(m.periodos[0])}</td>
                      <td className="px-3 py-2">{m.lastPaymentAt ? formatTableDate(m.lastPaymentAt) : "—"}</td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={remindingUnitId === `mor-${m.unitId}`}
                          onClick={() => void handleSendReminder([m.unitId], `mor-${m.unitId}`, "Recordatorio enviado", m.statementIds)}
                        >
                          <IconBadge tone="sand" className="mr-2">
                            <SendHorizontal className="h-4 w-4" />
                          </IconBadge>
                          {remindingUnitId === `mor-${m.unitId}` ? "Enviando..." : "Recordar"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {!soloConsulta && (
      <Card className="soft-panel">
        <CardTitle>Cierre de períodos</CardTitle>
        <CardDescription className="mt-1">
          Cierra los meses pasados: se guarda un reporte en Documentos → “Cierres de cartera” y el mes deja de aparecer en las tablas. Si quedan morosos, su deuda no se pierde: pasa a la pestaña “Cartera vencida”, donde puedes seguir cobrando. El mes vigente no se cierra y puedes reabrir un período cuando quieras.
        </CardDescription>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] px-3 py-2">
          <Button type="button" variant="outline" size="sm" disabled={savingHistory} onClick={() => void handleSaveCarteraHistory()}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {savingHistory ? "Guardando..." : "Guardar corte en Documentos"}
          </Button>
          <span className="text-xs text-[var(--slate-500)]">
            El corte (recaudo y morosos) se archiva automáticamente el día 1 de cada mes; usa esto solo si quieres guardarlo ahora.
          </span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-[var(--slate-500)]">Abiertos</p>
            {openPeriods.length === 0 ? (
              <p className="mt-1 text-xs text-[var(--slate-500)]">—</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {openPeriods.map((p) => {
                  const isCurrent = p.period >= currentPeriod;
                  return (
                  <li key={p.period} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--slate-200)] bg-white px-3 py-1.5 text-xs">
                    <span className="text-[var(--slate-700)]">{formatTableDate(p.period)} · saldo {formatAmount(p.pendiente)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={closingPeriod === p.period || isCurrent}
                      onClick={() => setPendingClosePeriod(p.period)}
                    >
                      {closingPeriod === p.period ? "Cerrando..." : isCurrent ? "Mes vigente" : "Cerrar y archivar"}
                    </Button>
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--slate-500)]">Cerrados</p>
            {closedPeriods.length === 0 ? (
              <p className="mt-1 text-xs text-[var(--slate-500)]">—</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {closedPeriods.map((p) => (
                  <li key={p.period} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--slate-200)] bg-[var(--slate-50)] px-3 py-1.5 text-xs">
                    <span className="text-[var(--slate-700)]">{formatTableDate(p.period)} · {p.archivados} cobro(s)</span>
                    <Button size="sm" variant="ghost" disabled={closingPeriod === p.period} onClick={() => void handleReopenPeriod(p.period)}>
                      {closingPeriod === p.period ? "..." : "Reabrir"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>
      )}

      {reminderTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-[var(--slate-900)]">Recordar a pendientes</h3>
            <p className="mt-1 text-sm text-[var(--slate-600)]">
              {reminderTarget.label} · {reminderTarget.unitIds.length} unidad(es) pendiente(s).
            </p>
            <div className="mt-4 space-y-3">
              <Button
                className="w-full"
                disabled={remindingUnitId === `camp-${reminderTarget.campaignId}`}
                onClick={() => {
                  const t = reminderTarget;
                  setReminderTarget(null);
                  void handleSendReminder(t.unitIds, `camp-${t.campaignId}`, "Recordatorio enviado a pendientes", t.statementIds);
                }}
              >
                Enviar ahora
              </Button>
              <div className="rounded-xl border border-[var(--slate-200)] p-3">
                <label className="block text-xs font-medium text-[var(--slate-700)]">
                  Programar para
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="mt-1 block h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)]"
                  />
                </label>
                <p className="mt-1 text-[11px] text-[var(--slate-500)]">Se enviará ese día a quienes sigan pendientes en ese momento.</p>
                <Button variant="outline" className="mt-2 w-full" disabled={!reminderDate} onClick={() => void handleScheduleReminder()}>
                  Programar
                </Button>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={() => { setReminderTarget(null); setReminderDate(""); }}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <RecordPaymentModal
        open={Boolean(paymentTarget)}
        statement={paymentTarget}
        statements={items}
        onClose={() => setPaymentTarget(null)}
      />

      <BillingEditDrawer
        open={isEditDrawerOpen}
        record={editingRecord}
        saving={savingRowId === editingRecord?.id}
        onDirtyChange={setIsEditDrawerDirty}
        onRequestSubmit={handleDrawerRequestSubmit}
        onClose={handleCloseEditDrawer}
        onSave={handleRowUpdate}
      />

      <Dialog open={Boolean(pendingClosePeriod)} onClose={() => setPendingClosePeriod(null)} className="max-w-md p-6">
        <h3 className="text-base font-semibold text-[var(--slate-900)]">Cerrar y archivar período</h3>
        <p className="mt-2 text-sm text-[var(--slate-700)]">
          Vas a cerrar <strong>{pendingClosePeriod ? formatTableDate(pendingClosePeriod) : ""}</strong>. Al aceptar:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--slate-600)]">
          <li>Se genera un reporte Excel en Documentos → “Cierres de cartera”.</li>
          <li>Sus cobros dejan de aparecer en las tablas vivas (no se borran).</li>
          {(() => {
            const agg = periodAgg.find((p) => p.period === pendingClosePeriod);
            return agg && agg.pendiente > 0 ? (
              <li>La mora de <strong>{formatAmount(agg.pendiente)}</strong> se conserva en “Cartera vencida” y “Morosos”.</li>
            ) : null;
          })()}
          <li>Puedes reabrir el período cuando quieras.</li>
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPendingClosePeriod(null)} disabled={closingPeriod === pendingClosePeriod}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              const p = pendingClosePeriod;
              setPendingClosePeriod(null);
              if (p) void handleClosePeriod(p);
            }}
            disabled={closingPeriod === pendingClosePeriod}
          >
            Cerrar y archivar
          </Button>
        </div>
      </Dialog>

      <Dialog open={isSwitchConfirmOpen} onClose={closeSwitchConfirm} className="max-w-md p-6">
        <h3 className="text-base font-semibold text-[var(--slate-900)]">Cambiar de registro</h3>
        <p className="mt-2 text-sm text-[var(--slate-700)]">
          Tienes cambios sin guardar en el registro actual. Elige cómo continuar.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={closeSwitchConfirm} disabled={switchingAfterSave}>
            Cancelar
          </Button>
          <Button type="button" variant="outline" onClick={handleDiscardAndSwitch} disabled={switchingAfterSave}>
            Descartar y cambiar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSaveAndSwitch()}
            disabled={switchingAfterSave || !isEditDrawerOpen || !editingRecord || savingRowId === editingRecord?.id}
          >
            {switchingAfterSave ? "Guardando..." : "Guardar y cambiar"}
          </Button>
        </div>
      </Dialog>

      <BillingBulkMessageDrawer
        open={isBulkDrawerOpen}
        units={catalogUnits}
        selectedUnitIds={selectedBulkUnitIds}
        message={bulkMessage}
        onClose={() => setIsBulkDrawerOpen(false)}
        onToggleUnit={handleToggleBulkUnit}
        onToggleAll={handleToggleAllBulkUnits}
        onChangeMessage={setBulkMessage}
        onSend={() => void handleSendOverdueBulkMessage()}
        isSending={isBulkSending}
      />
      {user?.tenantId ? (
        <CoefficientCampaignDialog
          open={coefficientDialogOpen}
          tenantId={user.tenantId}
          onClose={() => setCoefficientDialogOpen(false)}
          onCreated={() => setCreateResult(`Corrida por ${vocab.coeficienteCorto} generada. Revisa las cuotas en la tabla y la campaña en “Campañas de cobro”.`)}
        />
      ) : null}
    </section>
  );
}

/**
 * Durante la prueba este módulo es VISTA PREVIA: se explora con datos de
 * ejemplo pero no se opera (ver src/lib/config/trial-modules.ts). Para un
 * cliente activo, el gate es transparente.
 */
export default function AdminBillingPage() {
  return (
    <ModulePreviewGate module="billing">
      <AdminBillingPageContent />
    </ModulePreviewGate>
  );
}
