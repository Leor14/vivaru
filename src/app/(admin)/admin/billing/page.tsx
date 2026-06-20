"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useEffect } from "react";
import { AlertCircle, Banknote, CheckCircle2, Clock3, Download, FileSpreadsheet, PenSquare, Printer, SendHorizontal, Upload } from "lucide-react";
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
import * as XLSX from "xlsx";

import { ChartContainer } from "@/components/features/admin/dashboard/chart-container";
import { BillingBulkMessageDrawer, type BillingUnitOption } from "@/components/features/billing/BillingBulkMessageDrawer";
import { EmptyState } from "@/components/shared/empty-state";
import { HelpTip } from "@/components/shared/help-tip";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { SectionIntro } from "@/components/shared/section-intro";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { IconBadge } from "@/components/ui/icon-badge";
import { Input } from "@/components/ui/input";
import { RangePicker, type RangePickerValue } from "@/components/ui/range-picker";
import { UI_TEXT } from "@/constants/uiText";
import { useAuth } from "@/features/auth/auth-context";
import { buildBillingTrend, getBillingPeriods } from "@/features/billing/billing-trend";
import { createBillingStatement, updateBillingStatement, useBillingStatements } from "@/features/billing/use-billing-statements";
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
import { PaymentReceiptsReviewPanel } from "@/components/features/billing/PaymentReceiptsReviewPanel";
import { createCommunication } from "@/features/admin/services";
import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { chartAxis, chartBar, chartColors, chartGrid, chartLine, chartMargin } from "@/features/finanzas/chart-theme";
import type { BillingStatement } from "@/types/domain";

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
  payload?: Array<{ value: number; name: string }>;
  label?: string;
  formatAmount: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const charged = payload.find((item) => item.name === "Cobrado")?.value ?? 0;
  const collected = payload.find((item) => item.name === "Recaudado")?.value ?? 0;
  const rate = payload.find((item) => item.name === "% recaudo")?.value ?? (charged > 0 ? (collected / charged) * 100 : 0);
  const gap = Math.max(charged - collected, 0);

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
        <p className="flex items-center justify-between gap-3">
          <span>Brecha</span>
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

export default function AdminBillingPage() {
  const { user } = useAuth();
  const { formatAmount, formatAmountCompact } = useTenantCurrency();
  const { items, loading, error } = useBillingStatements(user?.tenantId);
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
  const [chartUnitFilter, setChartUnitFilter] = useState("all");
  const [periodMonths, setPeriodMonths] = useState(3);

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
    const gap = Math.max(totalCharged - totalCollected, 0);
    const collectionRate = totalCharged > 0 ? (totalCollected / totalCharged) * 100 : 0;

    return { totalCharged, totalCollected, gap, collectionRate };
  }, [chartTrend]);

  const chartData = useMemo(
    () =>
      chartTrend.map((item) => ({
        ...item,
        collectionRate: item.totalCharged > 0 ? (item.totalCollected / item.totalCharged) * 100 : 0,
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
      return byStatus && byUnit;
    });
  }, [normalizedRows, statusFilter, unitFilter]);

  const overdueRows = useMemo(() => normalizedRows.filter((item) => item.status === "overdue"), [normalizedRows]);

  const units = useMemo(() => Array.from(new Set(normalizedRows.map((item) => item.unitLabel))).sort((a, b) => a.localeCompare(b)), [normalizedRows]);

  const allUnitLabels = useMemo(() => {
    const fromCatalog = catalogUnits.map((unit) => unit.label);
    return Array.from(new Set([...units, ...fromCatalog])).sort((a, b) => a.localeCompare(b, "es"));
  }, [catalogUnits, units]);

  const chartUnitOptions = useMemo(() => {
    const labels = Array.from(new Set(catalogUnits.map((unit) => unit.label))).sort((a, b) => a.localeCompare(b, "es"));
    return ["all", ...labels];
  }, [catalogUnits]);

  async function handleCreate() {
    if (!user?.tenantId || !selectedUnitId.trim() || !unitLabel.trim() || !date.trim() || !amount.trim()) return;
    const rawAmount = parseCurrency(amount);
    const rawPayment = parseCurrency(paymentAmount);
    const balance = Math.max(rawAmount - rawPayment, 0);
    try {
      await createBillingStatement({
        tenantId: user.tenantId,
        userId: user.uid,
        unitId: selectedUnitId,
        unitLabel: unitLabel.trim(),
        period: date.slice(0, 7),
        amount: rawAmount,
        paymentAmount: rawPayment,
        balance,
        dueDate: dueDate || undefined,
      });
      toast.success("Estado de cuenta registrado.");
      setPaymentAmount("0");
      setAmount("0");
    } catch (error) {
      toastFirebaseError(error);
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
          });
          successCount += 1;
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
        title="Cartera"
        purpose="Controlar lo que cada unidad debe y lo que ha pagado (cuotas o alícuotas de administración)."
        how="Generas los cobros del período por unidad, registras los pagos recibidos y emites el comprobante a cada residente. Los pagos alimentan el Libro y fondos."
      />
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
          <StatTile tone="amber" label="Brecha" value={formatAmount(trendSummary.gap)} />
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

      <PaymentReceiptsReviewPanel
        tenantId={user?.tenantId}
        reviewerId={user?.uid}
        reviewerName={user?.fullName}
      />

      <Card className="soft-panel">
        <div className="flex items-center gap-2">
          <CardTitle>Crear nuevo cobro</CardTitle>
          <HelpTip text="Registra aquí la cuota mensual de una unidad. Si el residente ya realizó un pago parcial, anótalo en el campo Abono desde el inicio. La Fecha de recaudo es la fecha límite de pago, no la fecha en que llegó el dinero. El estado se asigna automáticamente: saldo en cero queda Al día, saldo pendiente antes de la fecha límite queda Pendiente, y saldo pendiente con fecha vencida pasa a En mora. Si no registras una fecha límite, se usa el mes del cobro: un mes ya pasado con saldo pendiente queda En mora. Ten presente que el sistema permite registrar más de un cobro para la misma unidad y mes." />
        </div>
        <CardDescription className="mt-1">
          Registra cartera mensual por unidad con estructura financiera clara y trazable.
        </CardDescription>
        <p className="mt-3 text-sm font-semibold text-[var(--slate-800)]">{billingFormTitle}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
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
          <Input label="Fecha" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Input
            label="Valor administración"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(formatCurrencyInput(event.target.value))}
          />
          <Input
            label="Abono"
            inputMode="numeric"
            value={paymentAmount}
            onChange={(event) => setPaymentAmount(formatCurrencyInput(event.target.value))}
          />
          <Input label="Fecha de recaudo" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-[var(--slate-700)]">Unidad seleccionada: <strong>{unitLabel || "-"}</strong></div>
          <Button className="w-full sm:w-auto" onClick={() => void handleCreate()} disabled={!selectedUnitId || !date || !amount}>
            Registrar
          </Button>
        </div>

        {catalogUnitsLoading ? <p className="mt-3 text-xs text-[var(--slate-600)]">Estamos cargando el listado de unidades del conjunto.</p> : null}
        {catalogUnitsError ? <p className="mt-3 text-xs text-[var(--danger-700)]">{catalogUnitsError}</p> : null}
      </Card>

      <Card className="soft-panel">
        <div className="flex items-center gap-2">
          <CardTitle>Herramientas de gestión</CardTitle>
          <HelpTip text="Todo lo que necesitas para gestionar la cartera en volumen. Descarga la plantilla, complétala con los cobros del mes e impórtala de una vez. Al exportar, el archivo incluye solo lo que ves en la tabla según los filtros activos. El botón Imprimir genera un reporte con los registros en mora únicamente. Y cuando necesites avisar sobre saldos pendientes, usa Enviar mensaje masivo: el aviso llega al feed de comunicaciones de los residentes dentro de la app." />
        </div>
        <CardDescription className="mt-1">
          Acciones operativas para carga, salida de información y comunicación masiva.
        </CardDescription>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Button type="button" variant="outline" onClick={handleDownloadTemplate}>
            <IconBadge tone="sky" className="mr-2">
              <Download className="h-4 w-4" />
            </IconBadge>
            Descargar plantilla
          </Button>
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            <IconBadge tone="mint" className="mr-2">
              <Upload className="h-4 w-4" />
            </IconBadge>
            {isImporting ? "Importando..." : "Importar Excel"}
          </Button>
          <Button type="button" variant="outline" onClick={handleExportCsv}>
            <IconBadge tone="sky" className="mr-2">
              <FileSpreadsheet className="h-4 w-4" />
            </IconBadge>
            Exportar Excel
          </Button>
          <Button type="button" variant="outline" onClick={handlePrintOverdueNotice}>
            <IconBadge tone="sand" className="mr-2">
              <Printer className="h-4 w-4" />
            </IconBadge>
            Imprimir PDF
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] px-3 py-3">
          <p className="text-sm text-[var(--slate-700)]">En mora: <strong>{overdueRows.length}</strong></p>
          <Button type="button" variant="outline" onClick={() => setIsBulkDrawerOpen(true)}>
            <IconBadge tone="mint" className="mr-2">
              <SendHorizontal className="h-4 w-4" />
            </IconBadge>
            Enviar mensaje masivo
          </Button>
        </div>

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
      </Card>

      <Card>
        <MobileFiltersPanel
          title="Filtros de cartera"
          helpText="Encuentra rápido lo que buscas en la tabla. Filtra por estado — Al día, Pendiente o En mora — y por unidad, o combina ambos para afinar aún más. El resultado es instantáneo. Ten en cuenta que estos filtros no tocan el gráfico de arriba, que maneja sus propios controles. Cuando exportes a Excel, el archivo reflejará exactamente lo que estás viendo en ese momento."
          footer={
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => {
              setStatusFilter("all");
              setUnitFilter("all");
            }}>
              Limpiar filtros
            </Button>
          }
        >
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
        </MobileFiltersPanel>

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-xs text-[var(--slate-500)]">
            {loading ? "Cargando registros..." : (
              statusFilter === "all" && unitFilter === "all"
                ? `${filteredRows.length} registro${filteredRows.length !== 1 ? "s" : ""}`
                : `${filteredRows.length} de ${normalizedRows.length} registro${normalizedRows.length !== 1 ? "s" : ""}`
            )}
          </p>
        </div>

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
                  <td className="px-3 py-2.5"><Skeleton className="h-7 w-16 rounded-xl" /></td>
                </tr>
              ))
            ) : null}
            {!loading && filteredRows.length === 0 ? (
              <tr>
                <td className="px-3 py-2" colSpan={8}>
                  <EmptyState
                    title="Sin estados de cuenta"
                    description="No hay facturación registrada para este conjunto con los filtros actuales."
                  />
                </td>
              </tr>
            ) : null}
            {filteredRows.map((item) => {
              const status = computeStatementStatus(item.balance, { dueDate: item.dueDate, period: item.period });
              const isPaid = status === "paid";
              return (
              <tr key={item.id} className="border-b border-[var(--slate-100)]">
                <td className="px-3 py-2">{item.unitLabel}</td>
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
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </Card>

      <RecordPaymentModal
        open={Boolean(paymentTarget)}
        statement={paymentTarget}
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
    </section>
  );
}
