"use client";

import { Component, type ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  MessageSquareText,
  PackageCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer } from "@/components/features/admin/dashboard/chart-container";
import { CompactDataTable } from "@/components/features/admin/dashboard/compact-data-table";
import { ExecutiveKpiCard } from "@/components/features/admin/dashboard/executive-kpi-card";
import { OperationalAlertsDrawer } from "@/components/features/admin/dashboard/operational-alerts-drawer";
import { StatusPill } from "@/components/features/admin/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { buildBillingTrend, getBillingPeriods } from "@/features/billing/billing-trend";
import { useBillingStatements } from "@/features/billing/use-billing-statements";
import { useCommunications } from "@/features/communications/use-communications";
import { usePackages } from "@/features/packages/use-packages";
import { useTickets } from "@/features/pqrs/use-tickets";
import { useReservations } from "@/features/reservations/use-reservations";
import { useVisitorPasses } from "@/features/visitors/use-visitor-passes";
import { formatUnitInline } from "@/lib/utils/unit";

function asText(value: unknown, fallback = "Sin dato") {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object") {
    const candidate = value as { toDate?: unknown; seconds?: unknown };
    if (typeof candidate.toDate === "function") {
      try {
        const parsed = candidate.toDate();
        return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
      } catch {
        return null;
      }
    }
    if (typeof candidate.seconds === "number") {
      const parsed = new Date(candidate.seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  return null;
}

function asDateLabel(value: unknown) {
  const parsed = toDate(value);
  if (parsed) {
    return parsed.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    return value;
  }
  return "Fecha no disponible";
}

function getQueryErrorLabel(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("permission-denied") || normalized.includes("insufficient permissions")) {
    return "No tienes permisos para leer este bloque del dashboard.";
  }
  if (normalized.includes("index") && normalized.includes("create")) {
    return "Falta un indice de Firestore para esta consulta.";
  }
  return "No pudimos cargar este bloque del dashboard.";
}

function formatPeriodLabel(period: string) {
  const date = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat("es-CO", { month: "short", year: "2-digit" }).format(date);
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function percentageDelta(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

function getTrendInsight(current: number, previous: number, suffix = "vs mes anterior") {
  const delta = percentageDelta(current, previous);
  if (delta === 0) return `Sin variacion ${suffix}`;
  const signal = delta > 0 ? "+" : "";
  return `${signal}${delta.toFixed(1)}% ${suffix}`;
}

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const copCompactFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCop(value: number) {
  return copFormatter.format(value);
}

function formatCopCompact(value: number) {
  return copCompactFormatter.format(value);
}

function BillingTrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const charged = payload.find((item) => item.name === "Cobrado")?.value ?? 0;
  const collected = payload.find((item) => item.name === "Recaudado")?.value ?? 0;
  const rate = payload.find((item) => item.name === "% recaudo")?.value ?? (charged > 0 ? (collected / charged) * 100 : 0);
  const gap = Math.max(charged - collected, 0);

  return (
    <div className="rounded-2xl border border-[var(--slate-200)] bg-white px-3 py-3 shadow-[0_14px_28px_rgba(13,38,59,0.16)]">
      <p className="text-xs font-semibold text-[var(--slate-800)]">{label ? formatPeriodLabel(label) : "Periodo"}</p>
      <div className="mt-2 space-y-1 text-xs text-[var(--slate-700)]">
        <p className="flex items-center justify-between gap-3">
          <span>Cobrado</span>
          <span className="font-semibold text-[#2c648d]">{formatCop(charged)}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span>Recaudado</span>
          <span className="font-semibold text-[#2f775f]">{formatCop(collected)}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span>Brecha</span>
          <span className="font-semibold text-[#936b24]">{formatCop(gap)}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span>% recaudo</span>
          <span className="font-semibold text-[#355f87]">{rate.toFixed(1)}%</span>
        </p>
      </div>
    </div>
  );
}

class DashboardSectionBoundary extends Component<
  {
    section: string;
    fallback: ReactNode;
    children: ReactNode;
  },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[admin-dashboard-section-error]", {
      section: this.props.section,
      message: error.message,
      stack: error.stack,
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

type DrawerSection = "alerts" | "visitors" | "packages" | "pqrs" | "communications" | null;

type DrawerRow = {
  id: string;
  primary: string;
  secondary: string;
  status: string;
  dateLabel: string;
};

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [fromPeriod, setFromPeriod] = useState("");
  const [toPeriod, setToPeriod] = useState("");
  const [drawerSection, setDrawerSection] = useState<DrawerSection>(null);

  const { items: billing, loading: loadingBilling, error: billingError } = useBillingStatements(tenantId);
  const { items: reservations, loading: loadingReservations, error: reservationsError } = useReservations(tenantId);
  const { items: tickets, loading: loadingTickets, error: ticketsError } = useTickets(tenantId);
  const { items: packages, loading: loadingPackages, error: packagesError } = usePackages(tenantId);
  const { items: visitorPasses, loading: loadingVisitors, error: visitorsError } = useVisitorPasses(tenantId);
  const {
    items: communications,
    loading: loadingCommunications,
    error: communicationsError,
  } = useCommunications(tenantId);

  const loading =
    loadingBilling || loadingReservations || loadingTickets || loadingPackages || loadingVisitors || loadingCommunications;

  const todayDate = new Date();
  const todayIso = todayDate.toISOString().slice(0, 10);
  const todayMonth = monthKey(todayDate);
  const previousMonthDate = new Date(todayDate);
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
  const previousMonth = monthKey(previousMonthDate);

  const availableUnits = useMemo(() => {
    const unique = new Set<string>();
    billing.forEach((item) => {
      if (typeof item.unitLabel === "string" && item.unitLabel.trim()) {
        unique.add(item.unitLabel.trim());
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [billing]);

  const availablePeriods = useMemo(() => getBillingPeriods(billing, unitFilter), [billing, unitFilter]);

  useEffect(() => {
    if (availablePeriods.length === 0) {
      if (fromPeriod !== "") setFromPeriod("");
      if (toPeriod !== "") setToPeriod("");
      return;
    }

    const latest = availablePeriods[availablePeriods.length - 1];
    const defaultFrom = availablePeriods[Math.max(availablePeriods.length - 11, 0)];
    let nextFrom = fromPeriod;
    let nextTo = toPeriod;

    if (!nextFrom || !availablePeriods.includes(nextFrom)) {
      nextFrom = defaultFrom;
    }

    if (!nextTo || !availablePeriods.includes(nextTo)) {
      nextTo = latest;
    }

    if (nextFrom > nextTo) {
      nextFrom = defaultFrom;
      nextTo = latest;
    }

    if (nextFrom !== fromPeriod) setFromPeriod(nextFrom);
    if (nextTo !== toPeriod) setToPeriod(nextTo);
  }, [availablePeriods, fromPeriod, toPeriod]);

  const fullBillingTrend = useMemo(() => buildBillingTrend(billing, unitFilter, "", ""), [billing, unitFilter]);
  const monthlyBilling = useMemo(
    () => buildBillingTrend(billing, unitFilter, fromPeriod, toPeriod),
    [billing, unitFilter, fromPeriod, toPeriod],
  );

  const previousWindowSummary = useMemo(() => {
    if (!fromPeriod || !toPeriod || availablePeriods.length === 0) {
      return { charged: 0, collected: 0, gap: 0, rate: 0 };
    }

    const fromIndex = availablePeriods.indexOf(fromPeriod);
    const toIndex = availablePeriods.indexOf(toPeriod);
    if (fromIndex < 0 || toIndex < 0 || toIndex < fromIndex) {
      return { charged: 0, collected: 0, gap: 0, rate: 0 };
    }

    const windowSize = toIndex - fromIndex + 1;
    const prevEndIndex = fromIndex - 1;
    const prevStartIndex = Math.max(0, prevEndIndex - windowSize + 1);
    if (prevEndIndex < 0) {
      return { charged: 0, collected: 0, gap: 0, rate: 0 };
    }

    const previousPeriods = new Set(availablePeriods.slice(prevStartIndex, prevEndIndex + 1));
    const previousWindow = fullBillingTrend.filter((item) => previousPeriods.has(item.period));
    const charged = previousWindow.reduce((acc, item) => acc + item.totalCharged, 0);
    const collected = previousWindow.reduce((acc, item) => acc + item.totalCollected, 0);
    const gap = Math.max(charged - collected, 0);
    const rate = charged > 0 ? (collected / charged) * 100 : 0;
    return { charged, collected, gap, rate };
  }, [availablePeriods, fromPeriod, toPeriod, fullBillingTrend]);

  const financialSummary = useMemo(() => {
    const totalCharged = monthlyBilling.reduce((acc, item) => acc + item.totalCharged, 0);
    const totalCollected = monthlyBilling.reduce((acc, item) => acc + item.totalCollected, 0);
    const collectionRate = totalCharged > 0 ? (totalCollected / totalCharged) * 100 : 0;
    const gap = Math.max(totalCharged - totalCollected, 0);
    return { totalCharged, totalCollected, collectionRate, gap };
  }, [monthlyBilling]);

  const chartData = useMemo(
    () =>
      monthlyBilling.map((item) => ({
        ...item,
        gap: Math.max(item.totalCharged - item.totalCollected, 0),
        collectionRate: item.totalCharged > 0 ? (item.totalCollected / item.totalCharged) * 100 : 0,
      })),
    [monthlyBilling],
  );

  const totalPortfolio = billing.reduce((acc, statement) => acc + Math.max(asNumber(statement.balance), 0), 0);
  const overdueBilling = billing.filter((statement) => statement.status === "overdue").length;

  const visitorsToday = visitorPasses.filter((visitor) => asDateLabel(visitor.date ?? visitor.visitDate) === todayIso);
  const pendingPackages = packages.filter((entry) => entry.status === "pending");
  const deliveredPackagesRecent = packages.filter((entry) => entry.status === "delivered").slice(0, 5);
  const openTickets = tickets.filter((ticket) => !["resolved", "closed"].includes(asText(ticket.status, "open")));
  const reservationsToday = reservations.filter((reservation) => asDateLabel(reservation.date) === todayIso);

  const visitorMonthCurrent = visitorPasses.filter(
    (item) => monthKey(toDate(item.date ?? item.visitDate) ?? new Date(0)) === todayMonth,
  ).length;
  const visitorMonthPrevious = visitorPasses.filter(
    (item) => monthKey(toDate(item.date ?? item.visitDate) ?? new Date(0)) === previousMonth,
  ).length;

  const packageMonthCurrent = packages.filter((item) => monthKey(toDate(item.arrivedAt) ?? new Date(0)) === todayMonth).length;
  const packageMonthPrevious = packages.filter((item) => monthKey(toDate(item.arrivedAt) ?? new Date(0)) === previousMonth).length;

  const ticketMonthCurrent = tickets.filter(
    (item) => monthKey(toDate(item.radicationDate ?? item.createdAt ?? item.updatedAt) ?? new Date(0)) === todayMonth,
  ).length;
  const ticketMonthPrevious = tickets.filter(
    (item) => monthKey(toDate(item.radicationDate ?? item.createdAt ?? item.updatedAt) ?? new Date(0)) === previousMonth,
  ).length;

  const reservationMonthCurrent = reservations.filter((item) => monthKey(toDate(item.date) ?? new Date(0)) === todayMonth).length;
  const reservationMonthPrevious = reservations.filter(
    (item) => monthKey(toDate(item.date) ?? new Date(0)) === previousMonth,
  ).length;

  const ticketsWithUrgency = useMemo(() => {
    return openTickets
      .map((ticket) => {
        const startDate = toDate(ticket.radicationDate ?? ticket.createdAt ?? ticket.updatedAt);
        const ageDays = startDate ? Math.floor((todayDate.getTime() - startDate.getTime()) / 86400000) : 0;
        return {
          ...ticket,
          ageDays,
          urgent: ageDays > 15,
        };
      })
      .sort((a, b) => b.ageDays - a.ageDays);
  }, [openTickets, todayDate]);

  const urgentTickets = ticketsWithUrgency.filter((ticket) => ticket.urgent).length;
  const alertCount = overdueBilling + urgentTickets + pendingPackages.length;

  const metricsError = reservationsError || ticketsError || packagesError || visitorsError;

  const kpis = [
    {
      label: "Cartera total",
      value: formatCop(totalPortfolio),
      insight: getTrendInsight(totalPortfolio, previousWindowSummary.gap, "vs ventana anterior"),
      tone: "neutral" as const,
      href: "/admin/billing",
    },
    {
      label: "% recaudo",
      value: `${financialSummary.collectionRate.toFixed(1)}%`,
      insight: getTrendInsight(financialSummary.collectionRate, previousWindowSummary.rate, "vs ventana anterior"),
      tone: "success" as const,
      href: "/admin/billing",
    },
    {
      label: "Visitantes hoy",
      value: String(visitorsToday.length),
      insight: getTrendInsight(visitorMonthCurrent, visitorMonthPrevious),
      tone: "neutral" as const,
      href: "/admin/visitors",
    },
    {
      label: "Paquetes pendientes",
      value: String(pendingPackages.length),
      insight: getTrendInsight(packageMonthCurrent, packageMonthPrevious),
      tone: "pending" as const,
      href: "/admin/packages",
    },
    {
      label: "PQRS abiertas",
      value: String(openTickets.length),
      insight: getTrendInsight(ticketMonthCurrent, ticketMonthPrevious),
      tone: urgentTickets > 0 ? ("alert" as const) : ("neutral" as const),
      href: "/admin/pqrs",
    },
    {
      label: "Reservas del dia",
      value: String(reservationsToday.length),
      insight: getTrendInsight(reservationMonthCurrent, reservationMonthPrevious),
      tone: "success" as const,
      href: "/admin/reservations",
    },
  ];

  const headerDate = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(todayDate);

  const visitorsTodayRows = visitorsToday
    .slice(0, 5)
    .map((item, index) => ({
      id: asText(item.id, `visitor-${index}`),
      primary: asText(item.visitorName, "Visitante"),
      secondary: `${formatUnitInline(typeof item.unitLabel === "string" ? item.unitLabel : "", "Unidad")} - ${asText(item.hostResidentName, "Residente")}`,
      status: asText(item.status, "scheduled"),
      dateLabel: asDateLabel(item.date ?? item.visitDate),
    }));

  const packagesRows = pendingPackages.slice(0, 5).map((item, index) => ({
    id: asText(item.id, `package-${index}`),
    primary: asText(item.description || item.reference, "Paquete"),
    secondary: `${formatUnitInline(typeof item.unitLabel === "string" ? item.unitLabel : "", "Unidad")} - ${asText(item.residentName || item.recipientName, "Residente")}`,
    status: asText(item.status, "pending"),
    dateLabel: asDateLabel(item.arrivedAt),
  }));

  const pqrsRows = ticketsWithUrgency.slice(0, 5).map((item, index) => ({
    id: asText(item.id, `ticket-${index}`),
    primary: asText(item.subject, "PQRS"),
    secondary: `${formatUnitInline(typeof item.unitLabel === "string" ? item.unitLabel : "", "Unidad")} - ${item.ageDays} dias`,
    status: item.urgent ? "urgente" : asText(item.status, "open"),
    dateLabel: asDateLabel(item.radicationDate ?? item.createdAt ?? item.updatedAt),
  }));

  const communicationRows = communications.slice(0, 5).map((item, index) => ({
    id: asText(item.id, `comm-${index}`),
    primary: asText(item.title, "Comunicado"),
    secondary: asText(item.body, "Sin descripcion").slice(0, 92),
    status: "vigente",
    dateLabel: asDateLabel(item.publishedAt),
  }));

  const drawerMeta = useMemo(() => {
    if (!drawerSection) {
      return { title: "", rows: [] as DrawerRow[], emptyText: "" };
    }

    if (drawerSection === "visitors") {
      return {
        title: "Visitantes hoy",
        rows: visitorsToday.map((item, index) => ({
          id: asText(item.id, `visitor-full-${index}`),
          primary: asText(item.visitorName, "Visitante"),
          secondary: `${formatUnitInline(typeof item.unitLabel === "string" ? item.unitLabel : "", "Unidad")} - ${asText(item.hostResidentName, "Residente")}`,
          status: asText(item.status, "scheduled"),
          dateLabel: asDateLabel(item.date ?? item.visitDate),
        })),
        emptyText: "No hay visitantes para hoy.",
      };
    }

    if (drawerSection === "alerts") {
      const rows: DrawerRow[] = [];

      if (urgentTickets > 0) {
        rows.push({
          id: "alert-pqrs",
          primary: "PQRS con riesgo de vencimiento",
          secondary: `Tipo: PQRS · Prioridad: Alta · ${urgentTickets} caso(s)`,
          status: "critical",
          dateLabel: todayIso,
        });
      }

      if (overdueBilling > 0) {
        rows.push({
          id: "alert-billing",
          primary: "Cartera en mora",
          secondary: `Tipo: Cartera · Prioridad: Media · ${overdueBilling} cuenta(s)`,
          status: "overdue",
          dateLabel: todayIso,
        });
      }

      if (pendingPackages.length > 0) {
        rows.push({
          id: "alert-packages",
          primary: "Paquetes pendientes de entrega",
          secondary: `Tipo: Paquetes · Prioridad: Media · ${pendingPackages.length} paquete(s)`,
          status: "pending",
          dateLabel: todayIso,
        });
      }

      if (reservationsToday.length > 0) {
        rows.push({
          id: "alert-reservations",
          primary: "Reservas del día por monitorear",
          secondary: `Tipo: Reservas · Prioridad: Baja · ${reservationsToday.length} reserva(s)`,
          status: "scheduled",
          dateLabel: todayIso,
        });
      }

      return {
        title: "Alertas operativas",
        rows,
        emptyText: "No hay alertas operativas activas.",
      };
    }

    if (drawerSection === "packages") {
      return {
        title: "Paquetes pendientes y recientes",
        rows: [...pendingPackages, ...deliveredPackagesRecent].map((item, index) => ({
          id: asText(item.id, `package-full-${index}`),
          primary: asText(item.description || item.reference, "Paquete"),
          secondary: `${formatUnitInline(typeof item.unitLabel === "string" ? item.unitLabel : "", "Unidad")} - ${asText(item.residentName || item.recipientName, "Residente")}`,
          status: asText(item.status, "pending"),
          dateLabel: asDateLabel(item.deliveredAt ?? item.arrivedAt),
        })),
        emptyText: "No hay paquetes en este momento.",
      };
    }

    if (drawerSection === "pqrs") {
      return {
        title: "PQRS activas",
        rows: ticketsWithUrgency.map((item, index) => ({
          id: asText(item.id, `pqrs-full-${index}`),
          primary: asText(item.subject, "PQRS"),
          secondary: `${formatUnitInline(typeof item.unitLabel === "string" ? item.unitLabel : "", "Unidad")} - ${item.ageDays} dias`,
          status: item.urgent ? "urgente" : asText(item.status, "open"),
          dateLabel: asDateLabel(item.radicationDate ?? item.createdAt ?? item.updatedAt),
        })),
        emptyText: "No hay PQRS abiertas.",
      };
    }

    return {
      title: "Comunicaciones vigentes",
      rows: communications.map((item, index) => ({
        id: asText(item.id, `comm-full-${index}`),
        primary: asText(item.title, "Comunicado"),
        secondary: asText(item.body, "Sin descripcion").slice(0, 140),
        status: "vigente",
        dateLabel: asDateLabel(item.publishedAt),
      })),
      emptyText: "No hay comunicaciones vigentes.",
    };
  }, [communications, deliveredPackagesRecent, drawerSection, pendingPackages, ticketsWithUrgency, visitorsToday]);

  return (
    <section className="space-y-5 pb-2">
      <DashboardSectionBoundary
        section="header"
        fallback={
          <Card>
            <CardTitle>Panel ejecutivo</CardTitle>
            <CardDescription className="mt-1">No pudimos cargar el encabezado inteligente.</CardDescription>
          </Card>
        }
      >
        <Card className="soft-panel border-[#d8e3ef] bg-[linear-gradient(120deg,#f8fbff_0%,#edf4fb_45%,#f7fbff_100%)] p-5">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-label text-[var(--slate-500)]">Centro de control</p>
              <h1 className="text-display mt-1 text-[var(--slate-900)]">{asText(user?.tenantName, "Conjunto principal")}</h1>
              <p className="mt-1 text-sm text-[var(--slate-600)]">{headerDate}</p>
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--slate-300)] bg-white/80 px-3 py-1"
                onClick={() => setDrawerSection("alerts")}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${alertCount > 0 ? "bg-[#c26735]" : "bg-[#3c8b71]"}`}
                  aria-hidden
                />
                <span className="text-xs font-semibold text-[var(--slate-700)]">
                  {alertCount > 0 ? `${alertCount} alertas operativas` : "Operación estable"}
                </span>
              </button>
            </div>
          </div>
        </Card>
      </DashboardSectionBoundary>

      <DashboardSectionBoundary
        section="kpis"
        fallback={
          <Card>
            <CardTitle>KPIs ejecutivos</CardTitle>
            <CardDescription className="mt-1">No pudimos calcular las metricas clave.</CardDescription>
          </Card>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {kpis.map((kpi) => (
            <ExecutiveKpiCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              insight={kpi.insight}
              tone={kpi.tone}
              href={kpi.href}
            />
          ))}
        </div>
        {metricsError ? <p className="text-xs text-[var(--danger-700)]">{getQueryErrorLabel(metricsError)}</p> : null}
      </DashboardSectionBoundary>

      <DashboardSectionBoundary
        section="financial"
        fallback={
          <Card>
            <CardTitle>Comportamiento histórico de cartera</CardTitle>
            <CardDescription className="mt-1">No fue posible construir la visualización financiera.</CardDescription>
          </Card>
        }
      >
        <ChartContainer
          title="Comportamiento histórico de cartera"
          description="Comparativo de cobrado y recaudado por periodo con lectura inmediata de porcentaje de recaudo."
          controls={
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-xs text-[var(--slate-700)]">
                Desde
                <input
                  type="month"
                  value={fromPeriod}
                  onChange={(event) => setFromPeriod(event.target.value)}
                  min={availablePeriods[0]}
                  max={toPeriod || availablePeriods[availablePeriods.length - 1]}
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                />
              </label>
              <label className="text-xs text-[var(--slate-700)]">
                Hasta
                <input
                  type="month"
                  value={toPeriod}
                  onChange={(event) => setToPeriod(event.target.value)}
                  min={fromPeriod || availablePeriods[0]}
                  max={availablePeriods[availablePeriods.length - 1]}
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                />
              </label>
              <label className="text-xs text-[var(--slate-700)]">
                Unidad
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                  value={unitFilter}
                  onChange={(event) => setUnitFilter(event.target.value)}
                >
                  <option value="all">Todas las unidades</option>
                  {availableUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
        >
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-[#d2e1f0] bg-[#f5faff] p-3 md:p-4">
              <p className="text-xs text-[var(--slate-500)]">Total cobrado</p>
              <p className="kpi-value-fluid kpi-value-fluid-compact mt-1 font-semibold text-[#2d5f86]">{formatCop(financialSummary.totalCharged)}</p>
            </Card>
            <Card className="border-[#cde6da] bg-[#f1fbf6] p-3 md:p-4">
              <p className="text-xs text-[var(--slate-500)]">Total recaudado</p>
              <p className="kpi-value-fluid kpi-value-fluid-compact mt-1 font-semibold text-[#2d725a]">{formatCop(financialSummary.totalCollected)}</p>
            </Card>
            <Card className="border-[#e9d7a8] bg-[#fff9e9] p-3 md:p-4">
              <p className="text-xs text-[var(--slate-500)]">Brecha</p>
              <p className="kpi-value-fluid kpi-value-fluid-compact mt-1 font-semibold text-[#8b6622]">{formatCop(financialSummary.gap)}</p>
            </Card>
            <Card className="border-[#ccddf0] bg-[#f1f7fd] p-3 md:p-4">
              <p className="text-xs text-[var(--slate-500)]">% recaudo</p>
              <p className="kpi-value-fluid kpi-value-fluid-compact mt-1 font-semibold text-[#345f88]">{financialSummary.collectionRate.toFixed(1)}%</p>
            </Card>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--slate-200)] bg-white p-3">
            {chartData.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--slate-300)] bg-[var(--surface-soft)] p-5 text-sm text-[var(--slate-600)]">
                No hay datos suficientes para construir la grafica con el filtro actual.
              </p>
            ) : (
              <div className="h-[360px] min-w-[700px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 16, right: 18, left: 6, bottom: 8 }}>
                    <defs>
                      <linearGradient id="chargedBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f89b3" />
                        <stop offset="100%" stopColor="#3a6f97" />
                      </linearGradient>
                      <linearGradient id="collectedBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#58aa87" />
                        <stop offset="100%" stopColor="#3b896a" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(71,85,105,0.16)" vertical={false} />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 12, fill: "#475569" }}
                      tickFormatter={formatPeriodLabel}
                      axisLine={{ stroke: "rgba(71,85,105,0.28)" }}
                      tickLine={false}
                      minTickGap={18}
                    />
                    <YAxis
                      yAxisId="money"
                      tick={{ fontSize: 12, fill: "#475569" }}
                      tickFormatter={formatCopCompact}
                      axisLine={{ stroke: "rgba(71,85,105,0.28)" }}
                      tickLine={false}
                      width={92}
                    />
                    <YAxis
                      yAxisId="rate"
                      orientation="right"
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                      tick={{ fontSize: 11, fill: "#4b6075" }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip content={<BillingTrendTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#334155" }} />
                    <Bar
                      yAxisId="money"
                      dataKey="totalCharged"
                      name="Cobrado"
                      fill="url(#chargedBar)"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      yAxisId="money"
                      dataKey="totalCollected"
                      name="Recaudado"
                      fill="url(#collectedBar)"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={24}
                    />
                    <Line
                      yAxisId="rate"
                      type="monotone"
                      dataKey="collectionRate"
                      name="% recaudo"
                      stroke="#335f88"
                      strokeWidth={2.2}
                      dot={{ r: 3, fill: "#335f88" }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          {billingError ? <p className="mt-3 text-xs text-[var(--danger-700)]">{getQueryErrorLabel(billingError)}</p> : null}
        </ChartContainer>
      </DashboardSectionBoundary>

      <DashboardSectionBoundary
        section="operations"
        fallback={
          <Card>
            <CardTitle>Operación en tiempo real</CardTitle>
            <CardDescription className="mt-1">No pudimos cargar los modulos operativos.</CardDescription>
          </Card>
        }
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="premium-card-hover border-[#d4e0ec] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-label text-[var(--slate-500)]">Operación</p>
                <CardTitle className="mt-1 flex items-center gap-2 text-lg">
                  <Users className="h-4 w-4 text-[#416f95]" /> Visitantes hoy
                </CardTitle>
              </div>
              <Button type="button" size="xs" variant="outline" onClick={() => setDrawerSection("visitors")}>Ver todo</Button>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {visitorsTodayRows.map((item) => (
                <li key={item.id} className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--slate-900)]">{item.primary}</p>
                    <StatusPill
                      label={item.status}
                      tone={
                        item.status === "inside"
                          ? "success"
                          : item.status === "completed"
                            ? "neutral"
                            : "pending"
                      }
                    />
                  </div>
                  <p className="mt-1 text-xs text-[var(--slate-600)]">{item.secondary}</p>
                </li>
              ))}
              {!loadingVisitors && visitorsTodayRows.length === 0 ? (
                <li className="rounded-xl border border-dashed border-[var(--slate-300)] p-3 text-xs text-[var(--slate-600)]">
                  Sin visitantes programados para hoy.
                </li>
              ) : null}
            </ul>
            <div className="mt-3">
              <Link href="/admin/visitors" className="text-sm font-medium text-[var(--brand-700)] hover:underline">Gestiónar visitantes</Link>
            </div>
          </Card>

          <Card className="premium-card-hover border-[#e7dbb6] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-label text-[var(--slate-500)]">Logística</p>
                <CardTitle className="mt-1 flex items-center gap-2 text-lg">
                  <PackageCheck className="h-4 w-4 text-[#8a6524]" /> Paquetes
                </CardTitle>
              </div>
              <Button type="button" size="xs" variant="outline" onClick={() => setDrawerSection("packages")}>Ver todo</Button>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {packagesRows.map((item) => (
                <li key={item.id} className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--slate-900)]">{item.primary}</p>
                    <StatusPill label={item.status} tone={item.status === "pending" ? "pending" : "success"} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--slate-600)]">{item.secondary}</p>
                </li>
              ))}
              {!loadingPackages && packagesRows.length === 0 ? (
                <li className="rounded-xl border border-dashed border-[var(--slate-300)] p-3 text-xs text-[var(--slate-600)]">
                  No hay paquetes pendientes.
                </li>
              ) : null}
            </ul>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-[var(--slate-500)]">{deliveredPackagesRecent.length} entregados recientes</p>
              <Link href="/admin/packages" className="text-sm font-medium text-[var(--brand-700)] hover:underline">Acción rápida</Link>
            </div>
          </Card>

          <Card className="premium-card-hover border-[#edd2cb] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-label text-[var(--slate-500)]">Atención</p>
                <CardTitle className="mt-1 flex items-center gap-2 text-lg">
                  <ClipboardList className="h-4 w-4 text-[#a34d3f]" /> PQRS
                </CardTitle>
              </div>
              <Button type="button" size="xs" variant="outline" onClick={() => setDrawerSection("pqrs")}>Ver todo</Button>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {pqrsRows.map((item) => (
                <li key={item.id} className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--slate-900)]">{item.primary}</p>
                    <StatusPill label={item.status} tone={item.status === "urgente" ? "alert" : "neutral"} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--slate-600)]">{item.secondary}</p>
                </li>
              ))}
              {!loadingTickets && pqrsRows.length === 0 ? (
                <li className="rounded-xl border border-dashed border-[var(--slate-300)] p-3 text-xs text-[var(--slate-600)]">
                  No hay PQRS activas.
                </li>
              ) : null}
            </ul>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-[var(--slate-500)]">{urgentTickets} con alerta mayor a 15 dias</p>
              <Link href="/admin/pqrs" className="text-sm font-medium text-[var(--brand-700)] hover:underline">Gestiónar PQRS</Link>
            </div>
          </Card>

          <Card className="premium-card-hover border-[#d4deeb] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-label text-[var(--slate-500)]">Comunicación</p>
                <CardTitle className="mt-1 flex items-center gap-2 text-lg">
                  <MessageSquareText className="h-4 w-4 text-[#476987]" /> Comunicaciones vigentes
                </CardTitle>
              </div>
              <Button type="button" size="xs" variant="outline" onClick={() => setDrawerSection("communications")}>Ver todo</Button>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {communicationRows.map((item) => (
                <li key={item.id} className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--slate-900)]">{item.primary}</p>
                    <StatusPill label="vigente" tone="finance" />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--slate-600)]">{item.secondary}</p>
                </li>
              ))}
              {!loadingCommunications && communicationRows.length === 0 ? (
                <li className="rounded-xl border border-dashed border-[var(--slate-300)] p-3 text-xs text-[var(--slate-600)]">
                  No hay comunicaciones vigentes.
                </li>
              ) : null}
            </ul>
            <div className="mt-3">
              <Link href="/admin/communications" className="text-sm font-medium text-[var(--brand-700)] hover:underline">Ver comunicaciones</Link>
            </div>
          </Card>
        </div>

        {loading ? (
          <p className="text-xs text-[var(--slate-500)]">Actualizando modulos en tiempo real...</p>
        ) : null}
        {communicationsError ? <p className="text-xs text-[var(--danger-700)]">{getQueryErrorLabel(communicationsError)}</p> : null}
        {visitorsError ? <p className="text-xs text-[var(--danger-700)]">{getQueryErrorLabel(visitorsError)}</p> : null}
        {packagesError ? <p className="text-xs text-[var(--danger-700)]">{getQueryErrorLabel(packagesError)}</p> : null}
        {ticketsError ? <p className="text-xs text-[var(--danger-700)]">{getQueryErrorLabel(ticketsError)}</p> : null}
      </DashboardSectionBoundary>

      <OperationalAlertsDrawer
        open={drawerSection !== null}
        title={drawerMeta.title}
        onClose={() => setDrawerSection(null)}
      >
        <CompactDataTable
          columns={[
            {
              key: "primary",
              header: "Detalle",
              render: (row: DrawerRow) => (
                <div>
                  <p className="font-medium text-[var(--slate-900)]">{row.primary}</p>
                  <p className="text-xs text-[var(--slate-600)]">{row.secondary}</p>
                </div>
              ),
            },
            {
              key: "status",
              header: "Estado",
              headerClassName: "w-28",
              render: (row: DrawerRow) => (
                <StatusPill
                  label={row.status}
                  tone={
                      row.status === "urgente" || row.status === "critical"
                      ? "alert"
                      : row.status === "pending" || row.status === "scheduled"
                        ? "pending"
                        : row.status === "overdue"
                          ? "alert"
                        : row.status === "inside" || row.status === "delivered" || row.status === "vigente"
                          ? "success"
                          : "neutral"
                  }
                />
              ),
            },
            {
              key: "date",
              header: "Fecha",
              headerClassName: "w-32",
              render: (row: DrawerRow) => <span className="text-xs text-[var(--slate-600)]">{row.dateLabel}</span>,
            },
          ]}
          rows={drawerMeta.rows}
          getRowKey={(row) => row.id}
          loading={loading}
          emptyText={drawerMeta.emptyText}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href="/admin/visitors">
            <Button type="button" variant="outline" size="xs">
              <Users className="mr-1 h-3.5 w-3.5" /> Visitantes
            </Button>
          </Link>
          <Link href="/admin/packages">
            <Button type="button" variant="outline" size="xs">
              <PackageCheck className="mr-1 h-3.5 w-3.5" /> Paquetes
            </Button>
          </Link>
          <Link href="/admin/pqrs">
            <Button type="button" variant="outline" size="xs">
              <AlertTriangle className="mr-1 h-3.5 w-3.5" /> PQRS
            </Button>
          </Link>
          <Link href="/admin/communications">
            <Button type="button" variant="outline" size="xs">
              <MessageSquareText className="mr-1 h-3.5 w-3.5" /> Comunicaciones
            </Button>
          </Link>
          <Link href="/admin/reservations">
            <Button type="button" variant="outline" size="xs">
              <CalendarDays className="mr-1 h-3.5 w-3.5" /> Reservas
            </Button>
          </Link>
          <Link href="/admin/billing">
            <Button type="button" variant="outline" size="xs">
              <TrendingUp className="mr-1 h-3.5 w-3.5" /> Cartera
            </Button>
          </Link>
        </div>
      </OperationalAlertsDrawer>
    </section>
  );
}
