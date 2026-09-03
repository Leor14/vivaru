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
import { OverdueUnitsWidget } from "@/components/features/admin/dashboard/overdue-units-widget";
import { PackagesBodegaWidget } from "@/components/features/admin/dashboard/packages-bodega-widget";
import { PqrsAgingWidget } from "@/components/features/admin/dashboard/pqrs-aging-widget";
import { RegulationComplianceWidget } from "@/components/features/admin/dashboard/regulation-compliance-widget";
import { StatusPill } from "@/components/features/admin/dashboard/status-pill";
import { VisitorFlowWidget } from "@/components/features/admin/dashboard/visitor-flow-widget";
import { OnboardingChecklist } from "@/components/shared/onboarding-checklist";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { buildBillingTrend, getBillingPeriods, type BillingTrendPoint } from "@/features/billing/billing-trend";
import { computeCollectionSummary } from "@/features/billing/collection";
import { useBillingStatements } from "@/features/billing/use-billing-statements";
import { computeStatementStatus } from "@/features/billing/statement-status";
import { useCommunications } from "@/features/communications/use-communications";
import { usePackages } from "@/features/packages/use-packages";
import { isTicketPending } from "@/features/pqrs/ticket-status";
import { useTickets } from "@/features/pqrs/use-tickets";
import { useReservations } from "@/features/reservations/use-reservations";
import { useVisitorPasses } from "@/features/visitors/use-visitor-passes";
import { useAgreementsComplianceSummary } from "@/features/committee-agreements/use-agreements-compliance-summary";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { formatUnitInline } from "@/lib/utils/unit";
import { lecturaDePorcentaje } from "@/lib/dashboard/indicadores";

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

/** Clave de fecha YYYY-MM-DD en hora LOCAL (no UTC). Evita off-by-one en "hoy". */
function dateKeyLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function asDateLabel(value: unknown) {
  // Si ya es un string YYYY-MM-DD (como guardan los módulos), respetarlo tal cual
  // (es fecha local). Solo convertir a clave local cuando viene como Date/Timestamp.
  if (typeof value === "string") {
    return value;
  }
  const parsed = toDate(value);
  if (parsed) {
    return dateKeyLocal(parsed);
  }
  return "Fecha no disponible";
}

function getQueryErrorLabel(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("permission-denied") || normalized.includes("insufficient permissions")) {
    return "No tienes permisos para leer este bloque del dashboard.";
  }
  if (normalized.includes("index") && normalized.includes("create")) {
    return "Falta un índice de Firestore para esta consulta.";
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

function countOnDay<T>(items: T[], getDate: (item: T) => unknown, dayIso: string): number {
  return items.filter((item) => asDateLabel(getDate(item)) === dayIso).length;
}

function countInMonth<T>(items: T[], getDate: (item: T) => unknown, month: string): number {
  return items.filter((item) => monthKey(toDate(getDate(item)) ?? new Date(0)) === month).length;
}

function percentageDelta(current: number, previous: number): number | null {
  // Sin base previa no hay porcentaje real: devolver null en vez de inventar ±100%.
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function getTrendInsight(current: number, previous: number, suffix = "vs mes anterior") {
  const delta = percentageDelta(current, previous);
  if (delta === null) return current > 0 ? `Sin base previa (${suffix})` : "Sin actividad";
  if (delta === 0) return `Sin variación ${suffix}`;
  const signal = delta > 0 ? "+" : "";
  return `${signal}${delta.toFixed(1)}% ${suffix}`;
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
    <div className="rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)] px-3 py-3 shadow-[0_14px_28px_rgba(13,38,59,0.16)]">
      <p className="text-xs font-semibold text-[var(--slate-800)]">{label ? formatPeriodLabel(label) : "Período"}</p>
      <div className="mt-2 space-y-1 text-xs text-[var(--slate-700)]">
        <p className="flex items-center justify-between gap-3">
          <span>Cobrado</span>
          <span className="font-semibold text-[var(--tinte-azul-texto-1)]">{formatAmount(charged)}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span>Recaudado</span>
          <span className="font-semibold text-[var(--tinte-verde-texto-1)]">{formatAmount(collected)}</span>
        </p>
        {settled !== collected ? (
          // Solo aparece cuando los dos números se separan, que es cuando hay
          // anticipos cruzados. Enseñar siempre dos cifras iguales invita a
          // buscarles la diferencia.
          <p className="flex items-center justify-between gap-3">
            <span>Saldado con anticipos</span>
            <span className="font-semibold text-[var(--tinte-verde-texto-1)]">{formatAmount(Math.max(settled - collected, 0))}</span>
          </p>
        ) : null}
        <p className="flex items-center justify-between gap-3">
          <span>Pendiente</span>
          <span className="font-semibold text-[var(--tinte-ambar-texto-1)]">{formatAmount(gap)}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span>% recaudo</span>
          <span className="font-semibold text-[var(--tinte-azul-texto-3)]">{rate.toFixed(1)}%</span>
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
  const { formatAmount, formatAmountCompact } = useTenantCurrency();
  const tenantId = user?.tenantId;
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [fromPeriod, setFromPeriod] = useState("");
  const [toPeriod, setToPeriod] = useState("");
  const [drawerSection, setDrawerSection] = useState<DrawerSection>(null);
  const [dashboardPeriod, setDashboardPeriod] = useState<"today" | "current" | "previous">("today");

  const { items: billing, loading: loadingBilling, error: billingError } = useBillingStatements(tenantId);
  const { items: reservations, loading: loadingReservations, error: reservationsError } = useReservations(tenantId);
  const { items: tickets, loading: loadingTickets, error: ticketsError } = useTickets(tenantId);
  const { items: packages, loading: loadingPackages, error: packagesError } = usePackages(tenantId);
  const { items: visitorPasses, loading: loadingVisitors, error: visitorsError } = useVisitorPasses(tenantId);
  const { pendingAgreements, pendingSignatures } = useAgreementsComplianceSummary(tenantId);
  const {
    items: communications,
    loading: loadingCommunications,
    error: communicationsError,
  } = useCommunications(tenantId);

  const loading =
    loadingBilling || loadingReservations || loadingTickets || loadingPackages || loadingVisitors || loadingCommunications;

  const todayDate = new Date();
  const todayIso = dateKeyLocal(todayDate);
  const todayMonth = monthKey(todayDate);
  const previousMonthDate = new Date(todayDate);
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
  const previousMonth = monthKey(previousMonthDate);
  const previousPreviousMonthDate = new Date(todayDate);
  previousPreviousMonthDate.setMonth(previousPreviousMonthDate.getMonth() - 2);
  const previousPreviousMonth = monthKey(previousPreviousMonthDate);
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayIso = yesterdayDate.toISOString().slice(0, 10);

  // Grupo "Actividad", gobernado por el filtro Hoy / Este mes / Mes pasado.
  const isToday = dashboardPeriod === "today";
  const periodSuffix = isToday ? "vs ayer" : "vs mes anterior";
  const periodLabel = isToday ? "hoy" : dashboardPeriod === "previous" ? "mes pasado" : "este mes";
  const activityMonth = dashboardPeriod === "previous" ? previousMonth : todayMonth;
  const activityComparisonMonth = dashboardPeriod === "previous" ? previousPreviousMonth : previousMonth;
  // Recaudo es mensual: "hoy"/"este mes" usan el mes en curso; "mes pasado", el anterior.
  const recaudoLabel = dashboardPeriod === "previous" ? "mes pasado" : "mes en curso";
  // **La ventana que se PINTA bajo cada rótulo.** Con el filtro en «Hoy», el recaudo sigue
  // midiendo el mes: decirlo es justo lo que evita que dos cifras del mismo nombre se contradigan.
  const ventanaRecaudo = dashboardPeriod === "previous" ? "Mes pasado" : "Mes en curso";
  const ventanaActividad = isToday ? "Hoy" : dashboardPeriod === "previous" ? "Mes pasado" : "Mes en curso";

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

  const monthlyBilling = useMemo(
    () => buildBillingTrend(billing, unitFilter, fromPeriod, toPeriod),
    [billing, unitFilter, fromPeriod, toPeriod],
  );

  const chartData = useMemo(
    () =>
      monthlyBilling.map((item) => ({
        ...item,
        gap: Math.max(item.totalCharged - item.totalSettled, 0),
        // R16: liquidado sobre facturado, no recaudado sobre facturado.
        collectionRate: item.totalCharged > 0 ? (item.totalSettled / item.totalCharged) * 100 : 0,
      })),
    [monthlyBilling],
  );

  const totalPortfolio = billing.reduce((acc, statement) => acc + Math.max(asNumber(statement.balance), 0), 0);
  // Usa la misma regla que Cartera (computeStatementStatus): sin fecha de recaudo,
  // un mes pasado con saldo cuenta como mora. El status guardado puede estar viejo.
  const overdueStatements = billing.filter(
    (statement) => computeStatementStatus(asNumber(statement.balance), { dueDate: statement.dueDate, period: statement.period }) === "overdue",
  );
  const overdueStatementsCount = overdueStatements.length;
  const overdueUnitsCount = new Set(overdueStatements.map((statement) => statement.unitId)).size;

  const visitorsToday = visitorPasses.filter((visitor) => asDateLabel(visitor.date ?? visitor.visitDate) === todayIso);
  const pendingPackages = packages.filter((entry) => entry.status === "pending");
  const deliveredPackagesRecent = packages.filter((entry) => entry.status === "delivered").slice(0, 5);
  // Pendiente de acción = open + in_progress (responded ya fue atendida) — VIV-1003.
  const openTickets = tickets.filter((ticket) => isTicketPending(ticket.status));
  const reservationsToday = reservations.filter((reservation) => asDateLabel(reservation.date) === todayIso);

  // Visitantes y reservas: por día (hoy vs ayer) o por mes (vs mes anterior).
  const visitorDate = (item: { date?: string; visitDate?: string }) => item.date ?? item.visitDate;
  const reservationDate = (item: { date?: string }) => item.date;
  const visitorsPeriod = isToday
    ? countOnDay(visitorPasses, visitorDate, todayIso)
    : countInMonth(visitorPasses, visitorDate, activityMonth);
  const visitorsComparison = isToday
    ? countOnDay(visitorPasses, visitorDate, yesterdayIso)
    : countInMonth(visitorPasses, visitorDate, activityComparisonMonth);
  const reservationsPeriod = isToday
    ? countOnDay(reservations, reservationDate, todayIso)
    : countInMonth(reservations, reservationDate, activityMonth);
  const reservationsComparison = isToday
    ? countOnDay(reservations, reservationDate, yesterdayIso)
    : countInMonth(reservations, reservationDate, activityComparisonMonth);

  // % recaudo del mes: misma fórmula que Cartera y Reporte de Comité (VIV-1103).
  // **Se guarda el resumen entero y no solo `.rate`**: sin `charged` la pantalla no puede
  // distinguir «nadie pagó» de «no había nada que cobrar», y las dos salían en rojo.
  const monthSummary = (month: string) => computeCollectionSummary(billing.filter((b) => b.period === month));
  const recaudoPeriod = monthSummary(activityMonth);
  const recaudoComparison = monthSummary(activityComparisonMonth);
  const recaudoLectura = lecturaDePorcentaje(recaudoPeriod.rate, recaudoPeriod.charged, ventanaRecaudo);

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

  /**
   * **Las alertas se construyen UNA vez, y la píldora cuenta esta lista.**
   *
   * Antes había dos cálculos: la píldora sumaba `overdueStatementsCount + urgentTickets +
   * paquetes + acuerdos` y el cajón armaba sus filas por separado. **Derivaron, como derivan
   * siempre dos sitios que calculan lo mismo**, y la pantalla acabó dando TRES cifras del mismo
   * concepto: la píldora decía 90, las tarjetas sumaban 33 y el cajón listaba 4 filas — con el
   * agravante de que la píldora ES el botón que abre el cajón. Encima ni cubrían las mismas
   * categorías: el cajón incluye las reservas del día y la suma no.
   *
   * Con una sola fuente, «90 alertas» y lo que se ve al pulsarla no pueden volver a discrepar.
   */
  const alertRows = useMemo<DrawerRow[]>(() => {
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

    if (overdueStatementsCount > 0) {
      rows.push({
        id: "alert-billing",
        primary: "Cartera en mora",
        // **Las dos magnitudes, y en este orden.** La tarjeta de Cartera enseña UNIDADES; el
        // cajón enseñaba CUENTAS. Dar solo una de las dos obliga a quien lee a adivinar por qué
        // no cuadran, cuando la relación —varias cuentas por unidad— es justo el dato útil.
        secondary: `Tipo: Cartera · Prioridad: Media · ${overdueUnitsCount} unidad(es) · ${overdueStatementsCount} cuenta(s)`,
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

    if (pendingAgreements > 0) {
      rows.push({
        id: "alert-agreements",
        primary: "Acuerdos de comité sin firma",
        secondary: `Tipo: Reglamento · Prioridad: Media · ${pendingAgreements} acuerdo(s)`,
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

    return rows;
  }, [
    urgentTickets,
    overdueStatementsCount,
    overdueUnitsCount,
    pendingPackages.length,
    pendingAgreements,
    reservationsToday.length,
    todayIso,
  ]);

  const alertCount = alertRows.length;

  const metricsError = reservationsError || ticketsError || packagesError || visitorsError;

  // Estado actual: snapshots en vivo (sin período); el subtítulo es descriptivo, no un delta.
  const estadoActual = [
    {
      label: "Cartera total",
      value: formatAmount(totalPortfolio),
      // **Es un ACUMULADO y hay que decirlo.** Suma el saldo de todos los períodos, así que no
      // se puede comparar con nada del mes: sin la ventana escrita, quien la lea al lado del
      // «% recaudo» del mes supondrá que las dos hablan del mismo tiempo.
      scope: "Acumulado · todos los períodos",
      insight: overdueUnitsCount > 0 ? `${overdueUnitsCount} unidad${overdueUnitsCount !== 1 ? "es" : ""} en mora` : "Sin unidades en mora",
      tone: "neutral" as const,
      href: "/admin/billing",
      help: "Suma de saldos pendientes de todas las unidades, al día de hoy. Es un estado actual, no de un período.",
    },
    {
      label: "Paquetes pendientes",
      value: String(pendingPackages.length),
      scope: "Al día de hoy",
      insight: pendingPackages.length > 0 ? "En bodega, sin recoger" : "Bodega al día",
      // El texto ya se ramificaba con el valor y el tono no lo seguía: con cero paquetes pintaba
      // ámbar sobre un «Bodega al día». Misma corrección que en las otras dos tarjetas.
      tone: pendingPackages.length > 0 ? ("pending" as const) : ("neutral" as const),
      href: "/admin/packages",
      help: "Paquetes recibidos en portería que aún no han sido recogidos. Estado actual.",
    },
    {
      label: "PQRS abiertas",
      value: String(openTickets.length),
      scope: "Al día de hoy",
      insight: urgentTickets > 0 ? `${urgentTickets} urgente${urgentTickets !== 1 ? "s" : ""} (>15 días)` : "Ninguna urgente",
      tone: urgentTickets > 0 ? ("alert" as const) : ("neutral" as const),
      href: "/admin/pqrs",
      help: "Solicitudes sin estado resuelto o cerrado, al día de hoy. Los casos mayores a 15 días se marcan como urgentes.",
    },
    {
      label: "Acuerdos sin firma",
      value: String(pendingAgreements),
      scope: "Al día de hoy",
      insight:
        pendingSignatures > 0
          ? `${pendingSignatures} firma${pendingSignatures !== 1 ? "s" : ""} pendiente${pendingSignatures !== 1 ? "s" : ""}`
          : "Todo firmado",
      tone: pendingAgreements > 0 ? ("alert" as const) : ("neutral" as const),
      href: "/admin/regulations",
      help: "Acuerdos de comité enviados a firma que aún tienen unidades sin firmar.",
    },
  ];

  // Actividad del período: gobernada por el filtro Hoy / Este mes / Mes pasado.
  const actividadPeriodo = [
    {
      label: "% recaudo",
      value: recaudoLectura.valor,
      // **La ventana, escrita.** Cartera enseña este mismo rótulo sobre hasta doce períodos: el
      // 30 de agosto de 2026 los SIETE conjuntos de producción daban cifras distintas en las dos
      // pantallas, a un clic de distancia y sin que ninguna dijera qué medía.
      scope: recaudoLectura.ventana,
      // **Y sin nada facturado no hay tendencia que contar**, porque no hay de qué.
      insight: recaudoLectura.sinDatos
        ? "Sin cobros emitidos en la ventana"
        : getTrendInsight(recaudoPeriod.rate, recaudoComparison.rate, "vs mes anterior"),
      // **El tono sale del valor, no es constante.** Estaba fijo en `success`, así que un recaudo
      // del 0,0% se pintaba en verde — el color decía «bien» sobre el peor número posible.
      // La escala es la MISMA que usan las barras de cumplimiento por torre (70 / 40): una sola
      // regla de color en la pantalla, para que dos verdes signifiquen lo mismo.
      // **Y un mes sin cobros emitidos ya NO se pinta de rojo**: era el caso de cuatro de los
      // siete conjuntos, afirmando el peor número posible sobre una cartera que nadie había emitido.
      tone: recaudoLectura.tono,
      href: "/admin/billing",
      // R16: mide lo SALDADO, no lo cobrado. Una cuota cubierta con un
      // anticipo cuenta aquí al 100 % aunque su dinero entrara otro mes.
      help: `Porcentaje de la cartera del ${recaudoLabel} que ya está saldada, con pagos o con anticipos aplicados. Un 80% o más es saludable.`,
    },
    {
      label: isToday ? "Visitantes hoy" : "Visitantes",
      value: String(visitorsPeriod),
      scope: ventanaActividad,
      insight: getTrendInsight(visitorsPeriod, visitorsComparison, periodSuffix),
      tone: "neutral" as const,
      href: "/admin/visitors",
      help: `Visitas registradas (${periodLabel}).`,
    },
    {
      label: isToday ? "Reservas hoy" : "Reservas",
      value: String(reservationsPeriod),
      scope: ventanaActividad,
      insight: getTrendInsight(reservationsPeriod, reservationsComparison, periodSuffix),
      // **Un recuento de actividad no es bueno ni malo, así que va neutro.** Estaba en `success`:
      // «0 reservas hoy» se pintaba en verde igual que «40 reservas hoy». Pintar de logro algo
      // que solo cuenta lo que pasó gasta el color sin decir nada — y le resta significado al
      // verde de las tarjetas donde sí lo tiene. Es el mismo criterio que ya usa «Visitantes».
      tone: "neutral" as const,
      href: "/admin/reservations",
      help: `Reservas de zonas comunes (${periodLabel}).`,
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
    secondary: `${formatUnitInline(typeof item.unitLabel === "string" ? item.unitLabel : "", "Unidad")} - ${item.ageDays} días`,
    status: item.urgent ? "urgente" : asText(item.status, "open"),
    dateLabel: asDateLabel(item.radicationDate ?? item.createdAt ?? item.updatedAt),
  }));

  const communicationRows = communications.slice(0, 5).map((item, index) => ({
    id: asText(item.id, `comm-${index}`),
    primary: asText(item.title, "Comunicado"),
    secondary: asText(item.body, "Sin descripción").slice(0, 92),
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
      // La lista viene de `alertRows`, que es lo mismo que cuenta la píldora. Ver su comentario.
      return {
        title: "Alertas operativas",
        rows: alertRows,
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
          secondary: `${formatUnitInline(typeof item.unitLabel === "string" ? item.unitLabel : "", "Unidad")} - ${item.ageDays} días`,
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
        secondary: asText(item.body, "Sin descripción").slice(0, 140),
        status: "vigente",
        dateLabel: asDateLabel(item.publishedAt),
      })),
      emptyText: "No hay comunicaciones vigentes.",
    };
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [alertRows, communications, deliveredPackagesRecent, drawerSection, pendingPackages, ticketsWithUrgency, visitorsToday]);

  return (
    <section className="space-y-5 pb-2">
      {/* Primero lo primero: mientras el conjunto no esté en marcha, la guía
          pesa más que los indicadores (que además estarían casi vacíos). */}
      <DashboardSectionBoundary section="onboarding" fallback={null}>
        <OnboardingChecklist />
      </DashboardSectionBoundary>
      <DashboardSectionBoundary
        section="header"
        fallback={
          <Card>
            <CardTitle>Panel ejecutivo</CardTitle>
            <CardDescription className="mt-1">No pudimos cargar el encabezado inteligente.</CardDescription>
          </Card>
        }
      >
        <Card className="soft-panel border-[var(--tinte-neutro-borde-3)] bg-[linear-gradient(120deg,#f8fbff_0%,#edf4fb_45%,#f7fbff_100%)] p-5">
          <div className="flex flex-col gap-4">
            <div>
              {/* Era un `h1` con el nombre del conjunto y un rótulo «Centro de
                  control» encima. Con la cabecera del shell diciendo «Panel de
                  Control» a 40 px, eran dos nombres para lo mismo y DOS `h1` en
                  la misma pantalla. Queda el conjunto, que es el dato. */}
              <h2 className="font-display text-display text-[var(--slate-900)]">{asText(user?.tenantName, "Conjunto principal")}</h2>
              <p className="mt-1 text-sm text-[var(--slate-600)]">{headerDate}</p>
              <button
                type="button"
                className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--slate-300)] bg-[var(--surface-strong)]/80 px-3 py-1 [transition:background-color_150ms_ease-out,border-color_150ms_ease-out,transform_120ms_ease-out] hover:border-[var(--slate-400)] hover:bg-[var(--surface-strong)] active:scale-[0.97] motion-reduce:[transform:none]"
                onClick={() => setDrawerSection("alerts")}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${alertCount > 0 ? "bg-[var(--tinte-ambar-fondo-2)]" : "bg-[var(--tinte-verde-fondo-3)]"}`}
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
        {loading ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Estado actual</p>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                {estadoActual.map((kpi) => (
                  <ExecutiveKpiCard
                    key={kpi.label}
                    label={kpi.label}
                    value={kpi.value}
                    scope={kpi.scope}
                    insight={kpi.insight}
                    tone={kpi.tone}
                    href={kpi.href}
                    help={kpi.help}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Actividad del período</p>
                <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-1">
                  {([
                    ["today", "Hoy"],
                    ["current", "Este mes"],
                    ["previous", "Mes pasado"],
                  ] as const).map(([key, lbl]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={dashboardPeriod === key}
                      onClick={() => setDashboardPeriod(key)}
                      className={`rounded-lg px-3 py-1 text-sm transition-colors ${
                        dashboardPeriod === key
                          ? "bg-[var(--surface-strong)] font-medium text-[var(--brand-700)] shadow-[0_1px_2px_rgba(12,33,53,0.08)]"
                          : "text-[var(--slate-600)] hover:text-[var(--slate-900)]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                {actividadPeriodo.map((kpi) => (
                  <ExecutiveKpiCard
                    key={kpi.label}
                    label={kpi.label}
                    value={kpi.value}
                    scope={kpi.scope}
                    insight={kpi.insight}
                    tone={kpi.tone}
                    href={kpi.href}
                    help={kpi.help}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
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
          helpText="Muestra la evolucion mensual del cobro vs. recaudo y el porcentaje de recaudo. Usa los filtros para comparar periodos especificos o aislar una unidad."
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
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
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
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
                />
              </label>
              <label className="text-xs text-[var(--slate-700)]">
                Unidad
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
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
          <div className="rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-3">
            {chartData.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--slate-300)] bg-[var(--surface-soft)] p-5 text-sm text-[var(--slate-600)]">
                No hay datos suficientes para construir la gráfica con el filtro actual.
              </p>
            ) : (
              <div className="h-[320px] w-full sm:h-[420px]">
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
                      tickFormatter={formatAmountCompact}
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
                    <Tooltip content={<BillingTrendTooltip formatAmount={formatAmount} />} />
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
        section="compliance"
        fallback={
          <Card>
            <CardTitle>Cumplimiento</CardTitle>
            <CardDescription className="mt-1">No pudimos cargar el módulo de cumplimiento.</CardDescription>
          </Card>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--slate-200)]" />
            <p className="text-label text-[var(--slate-500)] uppercase tracking-widest px-1">Cumplimiento</p>
            <div className="h-px flex-1 bg-[var(--slate-200)]" />
          </div>
          <RegulationComplianceWidget tenantId={tenantId} />
        </div>
      </DashboardSectionBoundary>

      <DashboardSectionBoundary
        section="operational-widgets"
        fallback={
          <Card>
            <CardTitle>Operativo</CardTitle>
            <CardDescription className="mt-1">No pudimos cargar los widgets operativos.</CardDescription>
          </Card>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--slate-200)]" />
            <p className="text-label text-[var(--slate-500)] uppercase tracking-widest px-1">Operativo</p>
            <div className="h-px flex-1 bg-[var(--slate-200)]" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <VisitorFlowWidget tenantId={tenantId} />
            <PqrsAgingWidget tenantId={tenantId} />
          </div>
        </div>
      </DashboardSectionBoundary>

      <DashboardSectionBoundary
        section="financial-widgets"
        fallback={
          <Card>
            <CardTitle>Financiero</CardTitle>
            <CardDescription className="mt-1">No pudimos cargar el módulo financiero.</CardDescription>
          </Card>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--slate-200)]" />
            <p className="text-label text-[var(--slate-500)] uppercase tracking-widest px-1">Financiero</p>
            <div className="h-px flex-1 bg-[var(--slate-200)]" />
          </div>
          <OverdueUnitsWidget items={billing} loading={loadingBilling} />
        </div>
      </DashboardSectionBoundary>

      <DashboardSectionBoundary
        section="logistics-widgets"
        fallback={
          <Card>
            <CardTitle>Logística</CardTitle>
            <CardDescription className="mt-1">No pudimos cargar el módulo de logística.</CardDescription>
          </Card>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--slate-200)]" />
            <p className="text-label text-[var(--slate-500)] uppercase tracking-widest px-1">Logística</p>
            <div className="h-px flex-1 bg-[var(--slate-200)]" />
          </div>
          <PackagesBodegaWidget tenantId={tenantId} />
        </div>
      </DashboardSectionBoundary>

      <DashboardSectionBoundary
        section="operations"
        fallback={
          <Card>
            <CardTitle>Operación en tiempo real</CardTitle>
            <CardDescription className="mt-1">No pudimos cargar los módulos operativos.</CardDescription>
          </Card>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="premium-card-hover border-[var(--tinte-neutro-borde-2)] bg-[var(--surface-strong)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-label text-[var(--slate-500)]">Operación</p>
                <CardTitle className="mt-1 flex items-center gap-2 text-lg" help="Ingresos validados por portería hoy. Muestra visitantes activos y completados del día en curso.">
                  <Users className="h-4 w-4 text-[var(--tinte-azul-texto-4)]" /> Visitantes hoy
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
              <Link href="/admin/visitors" className="text-sm font-medium text-[var(--brand-700)] hover:underline">Gestionar visitantes</Link>
            </div>
          </Card>

          <Card className="premium-card-hover border-[var(--tinte-verde-borde-3)] bg-[var(--surface-strong)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-label text-[var(--slate-500)]">Logística</p>
                <CardTitle className="mt-1 flex items-center gap-2 text-lg" help="Paquetes en espera de ser recogidos. Haz clic en 'Ver todo' para ver el historial reciente de entregas.">
                  <PackageCheck className="h-4 w-4 text-[var(--tinte-ambar-texto-5)]" /> Paquetes
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

          <Card className={`premium-card-hover p-4 transition-colors ${urgentTickets > 0 ? "border-[var(--danger-200)] bg-[var(--tinte-neutro-fondo-8)]" : "border-[var(--tinte-ambar-borde-1)] bg-[var(--surface-strong)]"}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-label ${urgentTickets > 0 ? "text-[var(--danger-500)]" : "text-[var(--slate-500)]"}`}>Atención{urgentTickets > 0 ? ` · ${urgentTickets} urgente${urgentTickets > 1 ? "s" : ""}` : ""}</p>
                <CardTitle className="mt-1 flex items-center gap-2 text-lg" help="Casos abiertos ordenados por antiguedad. Los marcados como urgentes llevan mas de 15 dias sin respuesta.">
                  <ClipboardList className={`h-4 w-4 ${urgentTickets > 0 ? "text-[var(--danger-500)]" : "text-[var(--tinte-ambar-texto-6)]"}`} /> PQRS
                </CardTitle>
              </div>
              <Button type="button" size="xs" variant="outline" onClick={() => setDrawerSection("pqrs")}>Ver todo</Button>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {pqrsRows.map((item) => (
                <li key={item.id} className={`rounded-xl border p-3 ${item.status === "urgente" ? "border-[var(--danger-200)] bg-[var(--danger-50)]" : "border-[var(--slate-200)] bg-[var(--surface-soft)]"}`}>
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
              <p className="text-xs text-[var(--slate-500)]">{urgentTickets} con alerta mayor a 15 días</p>
              <Link href="/admin/pqrs" className="text-sm font-medium text-[var(--brand-700)] hover:underline">Gestionar PQRS</Link>
            </div>
          </Card>

          <Card className="premium-card-hover border-[var(--tinte-neutro-borde-1)] bg-[var(--surface-strong)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-label text-[var(--slate-500)]">Comunicación</p>
                <CardTitle className="mt-1 flex items-center gap-2 text-lg" help="Comunicados publicados y vigentes a la fecha. Los programados o vencidos no aparecen aqui.">
                  <MessageSquareText className="h-4 w-4 text-[var(--tinte-azul-texto-5)]" /> Comunicaciones vigentes
                </CardTitle>
              </div>
              <Button type="button" size="xs" variant="outline" onClick={() => setDrawerSection("communications")}>Ver todo</Button>
            </div>
            <ul className="mt-3 divide-y divide-[var(--slate-100)] text-sm">
              {communicationRows.map((item) => (
                <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="font-medium text-[var(--slate-900)] leading-snug">{item.primary}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-[var(--slate-500)]">{item.secondary}</p>
                </li>
              ))}
              {!loadingCommunications && communicationRows.length === 0 ? (
                <li className="py-3 text-xs text-[var(--slate-500)]">
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
          <p className="text-xs text-[var(--slate-500)]">Actualizando módulos en tiempo real...</p>
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
