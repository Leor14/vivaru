"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchTenantCollection } from "@/lib/firebase/realtime-helpers";
import { computeCollectionSummary, statementChargedAmount } from "@/features/billing/collection";
import {
  buildFinancialStatement,
  esRecaudoDeCartera,
  planParaInformes,
} from "@/features/finanzas/financial-statement";
import { useChartOfAccounts } from "@/features/finanzas/use-chart-of-accounts";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
import { categoriaDeConcepto, type RecaudoDeCartera } from "@/lib/finanzas/conceptos-de-cargo";
import { computeFundPosition } from "@/features/finanzas/use-ledger";
import type { CommitteeAgreement, CommitteeAgreementSignature } from "@/features/committee-agreements/types";
import type { BillingStatement, LedgerEntry, PackageItem, Ticket, VisitorPass, Reservation } from "@/types/domain";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DateRange = {
  /** ISO date YYYY-MM-DD — inclusive */
  start: string;
  /** ISO date YYYY-MM-DD — inclusive */
  end: string;
};

export type ReportPeriodKey =
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "last_quarter"
  | "custom";

export type OverdueUnit = {
  unitId: string;
  unitLabel: string;
  balance: number;
  /** Number of periods with balance > 0 */
  periods: number;
};

export type WeeklyCount = {
  label: string; // e.g. "Sem 1", "Sem 2"
  count: number;
};

export type CommitteeReport = {
  loading: boolean;
  error: string | null;

  /** Billing metrics */
  billing: {
    totalCollected: number;       // sum of paymentAmount for paid statements
    totalOverdue: number;         // sum of balance for overdue statements
    paidCount: number;
    pendingCount: number;
    overdueCount: number;
    overdueUnits: OverdueUnit[];  // sorted by balance desc
  };

  /** Package metrics */
  packages: {
    totalReceived: number;        // arrived in period
    totalDelivered: number;       // delivered in period
    stillPending: number;         // status === "pending" (all time — operational KPI)
  };

  /** PQRS / Ticket metrics */
  tickets: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;             // resolved + responded + closed
    byCategory: { pqrs: number; maintenance: number; billing: number };
  };

  /** Visitor metrics */
  visitors: {
    total: number;                // passes in period
    byWeek: WeeklyCount[];        // for bar chart
    insideNow: number;            // status === "inside" (real-time)
  };

  /** Reservation metrics */
  reservations: {
    total: number;
    approved: number;
    pending: number;
    cancelled: number;
    byAmenity: Array<{ amenity: string; count: number }>;
  };

  /** Tablero ejecutivo: ratios de gestión + deltas vs período anterior (R1). */
  executive: {
    collectionRate: number;           // % recaudo del período (recaudado / facturado)
    collectionRateDelta: number | null; // puntos vs período anterior
    collectedDelta: number | null;    // % cambio del recaudado vs período anterior
    delinquencyAmount: number;        // ÍNDICE de morosidad por MONTO (cartera vencida / facturado, acumulado)
    delinquencyRate: number;          // secundario: % de unidades morosas (vencidas / activas)
    reserveMonths: number | null;     // meses de fondo de reserva (saldo / egreso mensual)
    pqrsResolutionRate: number;       // % de PQRS resueltos
    netResultDelta: number | null;    // % cambio del resultado neto vs período anterior
    activeUnits: number;
  };

  /** Tendencias por mes (últimos 12) para gráficos — desde datos ya cargados (P3). */
  trends: {
    byMonth: Array<{
      period: string;        // YYYY-MM
      facturado: number;
      recaudado: number;
      /**
       * Lo que dejó de deberse (`FLOW-002` R16). **Es el numerador de
       * `collectionRate`**, y por eso tiene que viajar: las barras pintan
       * `facturado` y `recaudado`, y sin este número la línea del porcentaje
       * contradice a las barras sin que nada en pantalla lo explique — un mes
       * saldado con anticipos deja la barra verde corta y la línea al 100 %.
       */
      liquidado: number;
      collectionRate: number;
      vencido: number;
      ingresos: number;
      egresos: number;
      neto: number;
    }>;
  };

  /** Resumen financiero del período: cartera + libro/fondos */
  financial: {
    totalIncome: number;                 // ingresos del período (recaudo + otros)
    totalExpenses: number;               // egresos del período
    netResult: number;                   // ingresos - egresos
    fundBalance: number;                 // saldo de fondos actual (acumulado)
    /**
     * Los ingresos por cuenta. **Faltaban, y no por descuido de diseño:** el
     * estado financiero los calculaba desde siempre y este hook los tiraba al
     * armar `financialMetrics`, así que el reparto por concepto que construyó la
     * entrega 1b-iii no lo enseñaba NADIE — solo salía en el Excel. Los egresos
     * sí llegaban, y su tabla y su torta son el gemelo que ya lo hacía bien.
     */
    incomeByCategory: Array<{ category: string; label: string; amount: number }>;
    expenseByCategory: Array<{ category: string; label: string; amount: number }>;
  };

  /** Acuerdos de comité del período (por sessionDate/eventDate). */
  agreements: {
    total: number;
    forSignature: number;     // de firma (obligatoria + parcial)
    informative: number;      // informativos
    expectedSignatures: number;
    signed: number;
    pending: number;
    signatureRate: number;    // % firmado sobre lo esperado
    /** Detalle por acuerdo (accionable): cuáles faltan por firmar. */
    items: Array<{ id: string; title: string; forSignature: boolean; expected: number; signed: number; pending: number; rate: number }>;
  };

  /** Loading por sección, para render progresivo (cada una aparece al cargar). */
  sectionLoading: {
    billing: boolean;
    financial: boolean;
    packages: boolean;
    tickets: boolean;
    visitors: boolean;
    reservations: boolean;
    agreements: boolean;
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns "" for any value that isn't a valid ISO-like date string or Firestore Timestamp */
function toDateStr(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : value.slice(0, 10); // YYYY-MM-DD
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const d = (value as { toDate: () => Date }).toDate();
    return d.toISOString().slice(0, 10);
  }
  return "";
}

function inRange(dateStr: string, start: string, end: string): boolean {
  if (!dateStr) return false;
  return dateStr >= start && dateStr <= end;
}

/** Compute ISO week label within the report range, e.g. "Sem 1" */
function weekLabel(dateStr: string, rangeStart: string): string {
  const dayDiff = Math.floor(
    (new Date(dateStr).getTime() - new Date(rangeStart).getTime()) / (1000 * 60 * 60 * 24),
  );
  const week = Math.floor(dayDiff / 7) + 1;
  return `Sem ${week}`;
}

// ─── Period presets ───────────────────────────────────────────────────────────

export function periodToDateRange(key: ReportPeriodKey, custom?: DateRange): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  if (key === "custom" && custom) return custom;

  if (key === "this_month") {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }

  if (key === "last_month") {
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }

  if (key === "last_3_months") {
    const start = new Date(y, m - 3, 1);
    const end = new Date(y, m + 1, 0);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }

  if (key === "last_quarter") {
    const q = Math.floor(m / 3);
    const qStart = new Date(y, (q - 1) * 3, 1);
    const qEnd = new Date(y, q * 3, 0);
    return { start: qStart.toISOString().slice(0, 10), end: qEnd.toISOString().slice(0, 10) };
  }

  // fallback: this month
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** Formats DateRange as human-readable label, e.g. "Mayo 2026" or "Feb – Abr 2026" */
export function formatPeriodLabel(range: DateRange): string {
  const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const s = new Date(range.start + "T12:00:00");
  const e = new Date(range.end + "T12:00:00");
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    const full = s.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    return full.charAt(0).toUpperCase() + full.slice(1);
  }
  return `${MONTHS[s.getMonth()]} – ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const EMPTY: CommitteeReport = {
  loading: true,
  error: null,
  billing: { totalCollected: 0, totalOverdue: 0, paidCount: 0, pendingCount: 0, overdueCount: 0, overdueUnits: [] },
  executive: { collectionRate: 0, collectionRateDelta: null, collectedDelta: null, delinquencyAmount: 0, delinquencyRate: 0, reserveMonths: null, pqrsResolutionRate: 0, netResultDelta: null, activeUnits: 0 },
  trends: { byMonth: [] },
  packages: { totalReceived: 0, totalDelivered: 0, stillPending: 0 },
  tickets: { total: 0, open: 0, inProgress: 0, resolved: 0, byCategory: { pqrs: 0, maintenance: 0, billing: 0 } },
  visitors: { total: 0, byWeek: [], insideNow: 0 },
  reservations: { total: 0, approved: 0, pending: 0, cancelled: 0, byAmenity: [] },
  financial: { totalIncome: 0, totalExpenses: 0, netResult: 0, fundBalance: 0, incomeByCategory: [], expenseByCategory: [] },
  agreements: { total: 0, forSignature: 0, informative: 0, expectedSignatures: 0, signed: 0, pending: 0, signatureRate: 0, items: [] },
  sectionLoading: { billing: true, financial: true, packages: true, tickets: true, visitors: true, reservations: true, agreements: true },
};

export function useCommitteeReport(tenantId: string | undefined, range: DateRange): CommitteeReport {
  // Entrega 1b-iii. Si el informe del consejo se quedara con el total en un solo
  // bloque mientras Finanzas lo reparte, las dos pantallas dirían cosas
  // distintas del mismo dinero — que es exactamente el problema que esta PRD
  // arregla, reaparecido una pantalla más allá.
  const conceptoAlLibro = useFeatureFlag("producto-concepto-al-libro");

  // R9. El plan hace falta aunque `producto-plan-de-cuentas` esté apagada: esa
  // bandera gobierna la EDICIÓN, no la lectura de los informes. Sin plan
  // sembrado sale `undefined` y el informe se comporta como siempre.
  const { accounts: chartAccounts } = useChartOfAccounts(tenantId);
  const planInformes = useMemo(() => planParaInformes(chartAccounts), [chartAccounts]);
  const [billing, setBilling] = useState<BillingStatement[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [visitors, setVisitors] = useState<VisitorPass[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [visitorsInside, setVisitorsInside] = useState<VisitorPass[]>([]);
  const [agreements, setAgreements] = useState<CommitteeAgreement[]>([]);
  const [agreementSignatures, setAgreementSignatures] = useState<CommitteeAgreementSignature[]>([]);
  const [units, setUnits] = useState<Array<{ id: string; status?: string }>>([]);

  const [loadingBilling, setLoadingBilling] = useState(true);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingVisitors, setLoadingVisitors] = useState(true);
  const [loadingReservations, setLoadingReservations] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(true);
  const [loadingVisitorsInside, setLoadingVisitorsInside] = useState(true);
  const [loadingAgreements, setLoadingAgreements] = useState(true);
  const [loadingAgreementSignatures, setLoadingAgreementSignatures] = useState(true);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lecturas que NO dependen del período (solo cambian con el tenant):
  // billing/ledger se necesitan históricos (saldo de fondos, mora); packages
  // tiene KPI "pendientes" de todo el tiempo; visitorsInside = "actualmente
  // dentro" (consulta de igualdad, fuera del rango del período).
  useEffect(() => {
    if (!tenantId) {
      setLoadingBilling(false);
      setLoadingPackages(false);
      setLoadingLedger(false);
      setLoadingVisitorsInside(false);
      setLoadingAgreementSignatures(false);
      setLoadingUnits(false);
      return;
    }

    const tid = tenantId;
    let cancelled = false;

    function load<T extends { id: string }>(
      name: string,
      options: Parameters<typeof fetchTenantCollection>[2],
      setData: (items: T[]) => void,
      setLoading: (value: boolean) => void,
    ) {
      fetchTenantCollection<T>(name, tid, options)
        .then((items) => {
          if (cancelled) return;
          setData(items);
          setLoading(false);
        })
        .catch((e) => {
          if (cancelled) return;
          console.error(`[committee-report][${name}]`, e);
          setError("No fue posible cargar parte del reporte.");
          setLoading(false);
        });
    }

    load<BillingStatement>("billingStatements", { orderByField: "period", orderDirection: "desc" }, setBilling, setLoadingBilling);
    // SIN `orderBy`, y no es un descuido: `where tenantId == X orderBy date desc`
    // exige un índice compuesto `(tenantId, date)` que NUNCA ha existido —el único
    // de `ledgerEntries` es `(tenantId, accountCode, date)`, que no sirve para esta
    // consulta porque `accountCode` va en medio sin restringir—. La consulta fallaba
    // entera, el `catch` dejaba `ledger` en `[]`, y el informe del comité enseñaba
    // **egresos $0 y un saldo de fondos sin restar nada**: el 23 de agosto de 2026
    // decía «+$55.500 y sin alertas» mientras Finanzas, en la misma pantalla y el
    // mismo día, avisaba en rojo de **−$10.300**.
    //
    // El orden aquí no lo usaba NADIE: los cuatro consumidores de `ledger` son un
    // `computeFundPosition` y tres `filter`+`reduce`, y `buildFinancialStatement`
    // ordena por su cuenta. Se pedía un índice para nada.
    //
    // Se quita en vez de añadir el índice porque es el patrón de `watchLedger`
    // —el gemelo de `/admin/finanzas` que lleva todo este tiempo funcionando—:
    // pedir sin ordenar y ordenar en memoria no depende de ningún índice que
    // alguien pueda olvidar.
    load<LedgerEntry>("ledgerEntries", undefined, setLedger, setLoadingLedger);
    load<PackageItem>("packages", { orderByField: "arrivedAt", orderDirection: "desc" }, setPackages, setLoadingPackages);
    load<VisitorPass>("visitorPasses", { equals: [{ field: "status", value: "inside" }] }, setVisitorsInside, setLoadingVisitorsInside);
    load<CommitteeAgreementSignature>("committee_agreement_signatures", undefined, setAgreementSignatures, setLoadingAgreementSignatures);
    load<{ id: string; status?: string }>("units", undefined, setUnits, setLoadingUnits);
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // Colecciones limitadas por rango de fecha server-side: se re-consultan al
  // cambiar el período. reservations por `date`; visitorPasses y tickets por el
  // campo canónico `eventDate` (poblado 100% por write-path + backfill).
  useEffect(() => {
    if (!tenantId) {
      setLoadingReservations(false);
      setLoadingVisitors(false);
      setLoadingTickets(false);
      setLoadingAgreements(false);
      return;
    }
    const tid = tenantId;
    let cancelled = false;

    function loadRanged<T extends { id: string }>(
      name: string,
      field: string,
      setData: (items: T[]) => void,
      setLoading: (value: boolean) => void,
    ) {
      setLoading(true);
      fetchTenantCollection<T>(name, tid, {
        orderByField: field,
        orderDirection: "desc",
        range: { field, start: range.start, end: range.end },
      })
        .then((items) => {
          if (cancelled) return;
          setData(items);
          setLoading(false);
        })
        .catch((e) => {
          if (cancelled) return;
          console.error(`[committee-report][${name}]`, e);
          setError("No fue posible cargar parte del reporte.");
          setLoading(false);
        });
    }

    loadRanged<Reservation>("reservations", "date", setReservations, setLoadingReservations);
    loadRanged<VisitorPass>("visitorPasses", "eventDate", setVisitors, setLoadingVisitors);
    loadRanged<Ticket>("tickets", "eventDate", setTickets, setLoadingTickets);
    loadRanged<CommitteeAgreement>("committee_agreements", "eventDate", setAgreements, setLoadingAgreements);

    return () => {
      cancelled = true;
    };
  }, [tenantId, range.start, range.end]);

  const report = useMemo((): CommitteeReport => {
    const loading =
      loadingBilling || loadingPackages || loadingTickets || loadingVisitors || loadingReservations || loadingLedger || loadingVisitorsInside ||
      loadingAgreements || loadingAgreementSignatures || loadingUnits;
    const { start, end } = range;

    // ── Billing ──────────────────────────────────────────────────────────────
    // BillingStatement uses `period` (YYYY-MM); compare start month to end month
    const startMonth = start.slice(0, 7); // YYYY-MM
    const endMonth = end.slice(0, 7);

    const billingInPeriod = billing.filter((b) => b.period >= startMonth && b.period <= endMonth);

    const totalCollected = billingInPeriod
      .filter((b) => b.status === "paid")
      .reduce((sum, b) => sum + (b.paymentAmount ?? b.amount ?? 0), 0);

    const totalOverdue = billing
      .filter((b) => b.status === "overdue" && b.balance > 0)
      .reduce((sum, b) => sum + b.balance, 0);

    // Build overdue units map (across all time — operational KPI)
    const overdueMap = new Map<string, OverdueUnit>();
    for (const b of billing) {
      if (b.status === "overdue" && b.balance > 0) {
        const prev = overdueMap.get(b.unitId);
        if (prev) {
          prev.balance += b.balance;
          prev.periods += 1;
        } else {
          overdueMap.set(b.unitId, { unitId: b.unitId, unitLabel: b.unitLabel, balance: b.balance, periods: 1 });
        }
      }
    }
    const overdueUnits = Array.from(overdueMap.values()).sort((a, b) => b.balance - a.balance);

    const billingMetrics = {
      totalCollected,
      totalOverdue,
      paidCount: billingInPeriod.filter((b) => b.status === "paid").length,
      pendingCount: billingInPeriod.filter((b) => b.status === "pending").length,
      overdueCount: billingInPeriod.filter((b) => b.status === "overdue").length,
      overdueUnits,
    };

    // ── Packages ─────────────────────────────────────────────────────────────
    const pkgsReceived = packages.filter((p) => {
      const d = toDateStr(p.arrivedAt);
      return inRange(d, start, end);
    });
    const pkgsDelivered = packages.filter((p) => {
      const d = toDateStr(p.deliveredAt);
      return inRange(d, start, end);
    });
    const packageMetrics = {
      totalReceived: pkgsReceived.length,
      totalDelivered: pkgsDelivered.length,
      stillPending: packages.filter((p) => p.status === "pending").length,
    };

    // ── Tickets ───────────────────────────────────────────────────────────────
    // tickets ya viene limitado por rango (eventDate) server-side.
    const ticketsInPeriod = tickets;
    const RESOLVED_STATUSES: Ticket["status"][] = ["resolved", "responded", "closed"];
    const ticketMetrics = {
      total: ticketsInPeriod.length,
      open: ticketsInPeriod.filter((t) => t.status === "open").length,
      inProgress: ticketsInPeriod.filter((t) => t.status === "in_progress").length,
      resolved: ticketsInPeriod.filter((t) => RESOLVED_STATUSES.includes(t.status)).length,
      byCategory: {
        pqrs: ticketsInPeriod.filter((t) => t.category === "pqrs").length,
        maintenance: ticketsInPeriod.filter((t) => t.category === "maintenance").length,
        billing: ticketsInPeriod.filter((t) => t.category === "billing").length,
      },
    };

    // ── Visitors ─────────────────────────────────────────────────────────────
    // visitors ya viene limitado por rango (eventDate) server-side; insideNow
    // ("actualmente dentro") es una consulta de igualdad aparte (todo el tiempo).
    const visitorsInPeriod = visitors;

    // Group by week
    const weekMap = new Map<string, number>();
    for (const v of visitorsInPeriod) {
      const d = v.eventDate ?? "";
      if (d) {
        const label = weekLabel(d, start);
        weekMap.set(label, (weekMap.get(label) ?? 0) + 1);
      }
    }
    const byWeek: WeeklyCount[] = Array.from(weekMap.entries())
      .sort((a, b) => {
        const nA = parseInt(a[0].replace("Sem ", ""), 10);
        const nB = parseInt(b[0].replace("Sem ", ""), 10);
        return nA - nB;
      })
      .map(([label, count]) => ({ label, count }));

    const visitorMetrics = {
      total: visitorsInPeriod.length,
      byWeek,
      insideNow: visitorsInside.length,
    };

    // ── Reservations ──────────────────────────────────────────────────────────
    const reservationsInPeriod = reservations.filter((r) => {
      const d = toDateStr(r.date ?? r.createdAt);
      return inRange(d, start, end);
    });

    const amenityMap = new Map<string, number>();
    for (const r of reservationsInPeriod) {
      const name = r.amenity ?? r.amenityId ?? "Sin nombre";
      amenityMap.set(name, (amenityMap.get(name) ?? 0) + 1);
    }
    const byAmenity = Array.from(amenityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([amenity, count]) => ({ amenity, count }));

    const reservationMetrics = {
      total: reservationsInPeriod.length,
      approved: reservationsInPeriod.filter((r) => r.status === "approved").length,
      pending: reservationsInPeriod.filter((r) => r.status === "pending").length,
      cancelled: reservationsInPeriod.filter((r) => r.status === "cancelled").length,
      byAmenity,
    };

    // ── Financiero (cartera + libro/fondos) ────────────────────────────────────
    // Saldo de fondos = acumulado (recaudo histórico + ingresos del libro − egresos).
    // Ingresos/egresos del período = estado de resultados sobre el libro filtrado.
    const cuotaIncomeAllTime = billing
      .filter((b) => b.status === "paid")
      .reduce((sum, b) => sum + (b.paymentAmount ?? b.amount ?? 0), 0);
    const fundPosition = computeFundPosition(ledger, cuotaIncomeAllTime);
    const periodLedger = ledger.filter((e) => inRange(toDateStr(e.date), start, end));
    // El reparto se construye AQUÍ y no con `repartirRecaudo` a propósito: este
    // informe define «recaudado» de otra forma que la pantalla de Finanzas
    // —solo cargos `paid`, y con `amount` de respaldo si falta `paymentAmount`—.
    // Esa discrepancia es anterior a esta entrega y no se toca aquí; lo que sí
    // importa es que el reparto sume EXACTAMENTE el total de este informe, o el
    // estado financiero dejaría de cuadrar consigo mismo.
    const recaudoPorCategoria = new Map<string, number>();
    for (const b of billingInPeriod) {
      if (b.status !== "paid") continue;
      const pagado = b.paymentAmount ?? b.amount ?? 0;
      if (!pagado) continue;
      const cat = categoriaDeConcepto(b.concept);
      recaudoPorCategoria.set(cat, (recaudoPorCategoria.get(cat) ?? 0) + pagado);
    }
    const recaudo: RecaudoDeCartera = {
      total: totalCollected,
      porCategoria: recaudoPorCategoria as RecaudoDeCartera["porCategoria"],
    };
    const statement = buildFinancialStatement(
      periodLedger,
      conceptoAlLibro ? recaudo : totalCollected,
      0,
      planInformes,
    );
    const financialMetrics = {
      totalIncome: statement.totalIncome,
      totalExpenses: statement.totalExpenses,
      netResult: statement.netResult,
      fundBalance: fundPosition.balance,
      incomeByCategory: statement.incomeByCategory,
      expenseByCategory: statement.expenseByCategory,
    };

    // ── Acuerdos de comité ─────────────────────────────────────────────────────
    // agreements ya viene limitado por rango de eventDate (período).
    const activeUnitsCount = units.filter((u) => u.status === "active").length;
    const forSignatureAgreements = agreements.filter((a) => a.signatureMode !== "informativo");
    const forSignatureIds = new Set(forSignatureAgreements.map((a) => a.id));
    const expectedSignatures = forSignatureAgreements.reduce(
      (sum, a) => sum + (a.signerScope === "selected" ? (a.signerUnitIds?.length ?? 0) : activeUnitsCount),
      0,
    );
    const agreementsSigned = agreementSignatures.filter((s) => forSignatureIds.has(s.agreementId)).length;
    const agreementItems = agreements
      .map((a) => {
        const isForSignature = a.signatureMode !== "informativo";
        const expected = isForSignature
          ? (a.signerScope === "selected" ? (a.signerUnitIds?.length ?? 0) : activeUnitsCount)
          : 0;
        const signed = agreementSignatures.filter((s) => s.agreementId === a.id).length;
        const pending = Math.max(expected - signed, 0);
        return {
          id: a.id,
          title: a.title ?? "Acuerdo",
          forSignature: isForSignature,
          expected,
          signed,
          pending,
          rate: expected > 0 ? Math.round((signed / expected) * 100) : 0,
        };
      })
      .sort((x, y) => y.pending - x.pending); // los que más faltan, primero
    const agreementMetrics = {
      total: agreements.length,
      forSignature: forSignatureAgreements.length,
      informative: agreements.length - forSignatureAgreements.length,
      expectedSignatures,
      signed: agreementsSigned,
      pending: Math.max(expectedSignatures - agreementsSigned, 0),
      signatureRate: expectedSignatures > 0 ? Math.round((agreementsSigned / expectedSignatures) * 100) : 0,
      items: agreementItems,
    };

    // ── Tablero ejecutivo (R1): ratios + comparativo vs período anterior ────────
    // Período anterior equivalente (mismo largo, justo antes del actual).
    const startD = new Date(start + "T12:00:00");
    const endD = new Date(end + "T12:00:00");
    const lenMs = endD.getTime() - startD.getTime();
    const prevEndD = new Date(startD.getTime() - 24 * 3600 * 1000);
    const prevStartD = new Date(prevEndD.getTime() - lenMs);
    const prevStartStr = prevStartD.toISOString().slice(0, 10);
    const prevEndStr = prevEndD.toISOString().slice(0, 10);
    const prevStartMonth = prevStartStr.slice(0, 7);
    const prevEndMonth = prevEndStr.slice(0, 7);
    const monthsInRange =
      (endD.getFullYear() * 12 + endD.getMonth()) - (startD.getFullYear() * 12 + startD.getMonth()) + 1;

    // % de recaudo del período y del anterior — fórmula única compartida con
    // Dashboard y Cartera (src/features/billing/collection.ts, VIV-1103).
    const currentCollection = computeCollectionSummary(billingInPeriod);
    const recaudado = currentCollection.collected;
    const collectionRate = Math.round(currentCollection.rate);

    const billingPrev = billing.filter((b) => b.period >= prevStartMonth && b.period <= prevEndMonth);
    const prevCollection = computeCollectionSummary(billingPrev);
    const recaudadoPrev = prevCollection.collected;
    const collectionRatePrev = Math.round(prevCollection.rate);
    const collectionRateDelta = prevCollection.charged > 0 ? collectionRate - collectionRatePrev : null;
    const collectedDelta = recaudadoPrev > 0 ? Math.round(((recaudado - recaudadoPrev) / recaudadoPrev) * 100) : null;

    // Resultado neto del período anterior (mismo método que el actual).
    const totalCollectedPrev = billingPrev
      .filter((b) => b.status === "paid")
      .reduce((s, b) => s + (b.paymentAmount ?? b.amount ?? 0), 0);
    const prevLedger = ledger.filter((e) => inRange(toDateStr(e.date), prevStartStr, prevEndStr));
    const prevNet = buildFinancialStatement(prevLedger, totalCollectedPrev).netResult;
    const netResultDelta = prevNet !== 0 ? Math.round(((statement.netResult - prevNet) / Math.abs(prevNet)) * 100) : null;

    // Morosidad: índice por MONTO (cartera vencida acumulada / facturado acumulado) como
    // primario; % de unidades morosas como secundario. Ambos acumulados (todo el tiempo).
    const billedAllTime = billing.reduce((sum, b) => sum + statementChargedAmount(b), 0);
    const delinquencyAmount = billedAllTime > 0 ? Math.round((totalOverdue / billedAllTime) * 100) : 0;
    const delinquencyRate = activeUnitsCount > 0 ? Math.round((overdueUnits.length / activeUnitsCount) * 100) : 0;
    const monthlyExpense = monthsInRange > 0 ? statement.totalExpenses / monthsInRange : statement.totalExpenses;
    const reserveMonths = monthlyExpense > 0 ? Math.round((fundPosition.balance / monthlyExpense) * 10) / 10 : null;
    const pqrsResolutionRate = ticketMetrics.total > 0 ? Math.round((ticketMetrics.resolved / ticketMetrics.total) * 100) : 0;

    const executiveMetrics = {
      collectionRate,
      collectionRateDelta,
      collectedDelta,
      delinquencyAmount,
      delinquencyRate,
      reserveMonths,
      pqrsResolutionRate,
      netResultDelta,
      activeUnits: activeUnitsCount,
    };

    // ── Tendencias por mes (últimos 12) — sin lecturas extra ────────────────────
    const TREND_MONTHS = 12;
    const trendMonths: string[] = [];
    for (let k = TREND_MONTHS - 1; k >= 0; k--) {
      const d = new Date(endD.getFullYear(), endD.getMonth() - k, 1);
      trendMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const byMonth = trendMonths.map((period) => {
      const bs = billing.filter((b) => b.period === period);
      const monthCollection = computeCollectionSummary(bs);
      const facturado = monthCollection.charged;
      const recaudado = monthCollection.collected;
      const vencido = bs.filter((b) => b.status === "overdue").reduce((s, b) => s + (b.balance ?? 0), 0);
      const monthLedger = ledger.filter((e) => toDateStr(e.date).slice(0, 7) === period);
      const ingresosOtros = monthLedger.filter((e) => e.type === "ingreso" && !esRecaudoDeCartera(e)).reduce((s, e) => s + e.amount, 0);
      const egresos = monthLedger.filter((e) => e.type === "egreso").reduce((s, e) => s + e.amount, 0);
      const ingresos = recaudado + ingresosOtros;
      return {
        period,
        facturado,
        recaudado,
        liquidado: monthCollection.settled,
        collectionRate: Math.round(monthCollection.rate),
        vencido,
        ingresos,
        egresos,
        neto: ingresos - egresos,
      };
    });

    return {
      loading,
      error,
      executive: executiveMetrics,
      trends: { byMonth },
      billing: billingMetrics,
      packages: packageMetrics,
      tickets: ticketMetrics,
      visitors: visitorMetrics,
      reservations: reservationMetrics,
      financial: financialMetrics,
      agreements: agreementMetrics,
      sectionLoading: {
        billing: loadingBilling,
        financial: loadingBilling || loadingLedger,
        packages: loadingPackages,
        tickets: loadingTickets,
        visitors: loadingVisitors,
        reservations: loadingReservations,
        agreements: loadingAgreements || loadingAgreementSignatures || loadingUnits,
      },
    };
  }, [billing, packages, tickets, visitors, visitorsInside, reservations, ledger, agreements, agreementSignatures, units, range, error,
    loadingBilling, loadingPackages, loadingTickets, loadingVisitors, loadingReservations, loadingLedger, loadingVisitorsInside,
    loadingAgreements, loadingAgreementSignatures, loadingUnits, conceptoAlLibro,
    // Sin esto, renombrar una cuenta NO refrescaba el informe hasta que otra
    // cosa cambiara — o sea, CA6 verde en la prueba y rota en la pantalla. Lo
    // cazo el aviso de exhaustive-deps, no una prueba.
    planInformes]);

  if (!tenantId) return EMPTY;
  return report;
}
