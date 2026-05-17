"use client";

import Link from "next/link";
import { useState } from "react";

import { MetricCard } from "@/components/shared/metric-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useBillingStatements } from "@/features/billing/use-billing-statements";
import { useCommunications } from "@/features/communications/use-communications";
import { usePackages } from "@/features/packages/use-packages";
import { useReservations } from "@/features/reservations/use-reservations";
import { useVisitorPasses } from "@/features/visitors/use-visitor-passes";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import type { Reservation } from "@/types/domain";
import type { ResidentCommunication } from "@/features/communications/visibility";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatShortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function formatPublishedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

// ─── CommunicationItem — colapsable ─────────────────────────────────────────

function CommunicationItem({ item }: { item: ResidentCommunication }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = item.body.length > 180;

  return (
    <li className="rounded-xl border border-[var(--slate-200)] bg-white p-3">
      <p className="font-medium text-[var(--slate-900)]">{item.title}</p>
      {formatPublishedDate(item.publishedAt) ? (
        <p className="mt-0.5 text-xs text-[var(--slate-500)]">{formatPublishedDate(item.publishedAt)}</p>
      ) : null}

      {/* Preview: 3 líneas cuando no está expandido. Ocultar cuando expanded
          para evitar doble render del body (preview + collapsible simultáneos). */}
      {(!isLong || !expanded) && (
        <p className={`mt-2 text-sm text-[var(--slate-700)] ${isLong ? "line-clamp-3" : ""}`}>
          {item.body}
        </p>
      )}

      {/* Expanded body: animated with collapsible-grid pattern */}
      {isLong ? (
        <>
          <div
            className="collapsible-grid"
            data-open={expanded ? "true" : "false"}
          >
            <div>
              <p className="collapsible-content whitespace-pre-wrap pt-1 text-sm text-[var(--slate-700)]">
                {item.body}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 text-xs font-medium text-[var(--brand-700)] [transition:opacity_120ms_ease] hover:underline active:opacity-60"
          >
            {expanded ? "Ver menos" : "Ver más"}
          </button>
        </>
      ) : null}
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResidentHomePage() {
  const { user } = useAuth();
  const { formatAmount } = useTenantCurrency();

  const tenantId = user?.tenantId;
  const unitId = user?.unitId;

  const { items: billing = [], loading: billingLoading, error: billingError } = useBillingStatements(tenantId, unitId);
  const { items: reservations = [], loading: reservationsLoading, error: reservationsError } = useReservations(tenantId, unitId);
  const { items: visitors = [], loading: visitorsLoading, error: visitorsError } = useVisitorPasses(tenantId, unitId);
  const { items: packages = [], loading: packagesLoading, error: packagesError } = usePackages(tenantId, unitId);
  const { items: communications = [], loading: communicationsLoading, error: communicationsError } = useCommunications(tenantId);

  // ── Defensive guards ──
  if (!tenantId) {
    return (
      <section className="space-y-4">
        <Card>
          <CardTitle>Perfil incompleto</CardTitle>
          <CardDescription className="mt-1">
            No se pudo determinar el conjunto residencial asociado a tu usuario. Contacta a la administración.
          </CardDescription>
        </Card>
      </section>
    );
  }
  if (!unitId) {
    return (
      <section className="space-y-4">
        <Card>
          <CardTitle>Unidad no asociada</CardTitle>
          <CardDescription className="mt-1">
            Tu usuario no tiene una unidad asignada. Contacta a la administración para asociar tu apartamento o casa.
          </CardDescription>
        </Card>
      </section>
    );
  }

  // ── Metrics ──
  let pendingBalance = 0;
  let billingStatus: "overdue" | "pending" | "clear" = "clear";
  try {
    const hasOverdue = billing.some((item) => item.status === "overdue");
    const hasPending = billing.some((item) => item.status === "pending");
    pendingBalance = billing
      .filter((item) => item.status === "pending" || item.status === "overdue")
      .reduce((sum, item) => sum + (item.balance || 0), 0);
    billingStatus = hasOverdue ? "overdue" : hasPending ? "pending" : "clear";
  } catch (e) {
    console.error("[resident-home] Error calculando saldo pendiente", e, billing);
  }

  let nextReservation: Reservation | null = null;
  try { nextReservation = reservations[0] || null; } catch (e) {
    console.error("[resident-home] Error obteniendo próxima reserva", e, reservations);
  }

  let activeVisitors = 0;
  try { activeVisitors = visitors.filter((item) => item.status !== "completed").length; } catch (e) {
    console.error("[resident-home] Error contando visitantes activos", e, visitors);
  }

  let pendingPackages = 0;
  try { pendingPackages = packages.filter((item) => item.status === "pending").length; } catch (e) {
    console.error("[resident-home] Error contando paquetes pendientes", e, packages);
  }

  // ── Next reservation label ──
  function reservationLabel() {
    if (!nextReservation) return "Sin reservas";
    const amenity = nextReservation.amenity || "Amenidad";
    const date = formatShortDate(nextReservation.date);
    return date ? `${amenity} · ${date}` : amenity;
  }

  return (
    <section className="space-y-4">

      {/* ── Metric grid ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {billingLoading ? (
          <Skeleton className="h-[88px] rounded-2xl" />
        ) : (
          <div className="metric-stagger metric-stagger-0">
            <MetricCard
              label="Saldo pendiente"
              value={formatAmount(pendingBalance)}
              semantic={billingStatus}
              href="/resident/account"
            />
          </div>
        )}
        {reservationsLoading ? (
          <Skeleton className="h-[88px] rounded-2xl" />
        ) : (
          <div className="metric-stagger metric-stagger-1">
            <MetricCard
              label="Próxima reserva"
              value={reservationLabel()}
              tone="mint"
              href="/resident/reservations"
            />
          </div>
        )}
        {visitorsLoading ? (
          <Skeleton className="h-[88px] rounded-2xl" />
        ) : (
          <div className="metric-stagger metric-stagger-2">
            <MetricCard
              label="Visitantes activos"
              value={String(activeVisitors)}
              tone="peach"
              href="/resident/visitors"
            />
          </div>
        )}
        {packagesLoading ? (
          <Skeleton className="h-[88px] rounded-2xl" />
        ) : (
          <div className="metric-stagger metric-stagger-3">
            <MetricCard
              label="Paquetes pendientes"
              value={String(pendingPackages)}
              tone="sand"
              href="/resident/packages"
            />
          </div>
        )}
      </div>

      {/* ── Errores localizados ── */}
      {(billingError || reservationsError || visitorsError || packagesError) && (
        <Card className="border-red-200 bg-red-50">
          <CardTitle className="text-red-800">Algunos datos no se pudieron cargar</CardTitle>
          <CardDescription className="mt-1 text-red-700">
            {billingError && <div>Saldo: {billingError}</div>}
            {reservationsError && <div>Reservas: {reservationsError}</div>}
            {visitorsError && <div>Visitantes: {visitorsError}</div>}
            {packagesError && <div>Paquetes: {packagesError}</div>}
          </CardDescription>
        </Card>
      )}

      {/* ── Accesos rápidos ── */}
      <Card>
        <CardTitle>Accesos rápidos</CardTitle>
        <CardDescription className="mt-1">
          Las acciones más frecuentes de tu unidad, a un toque.
        </CardDescription>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            className="resident-quick-link font-medium text-[var(--slate-900)]"
            href="/resident/account"
          >
            Ver estado de cuenta
          </Link>
          <Link
            className="resident-quick-link font-medium text-[var(--slate-900)]"
            href="/resident/reservations"
          >
            Reservar amenidades
          </Link>
          <Link
            className="resident-quick-link font-medium text-[var(--slate-900)]"
            href="/resident/visitors"
          >
            Autorizar visitantes
          </Link>
          <Link
            className="resident-quick-link text-[var(--slate-600)]"
            href="/resident/pqrs"
          >
            Crear PQRS
          </Link>
        </div>
      </Card>

      {/* ── Comunicados recientes ── */}
      <Card>
        <CardTitle>Comunicados recientes</CardTitle>
        <CardDescription className="mt-1">Últimos anuncios del edificio para tu unidad.</CardDescription>
        {communicationsError && (
          <p className="mt-2 text-sm text-red-700">No se pudieron cargar los comunicados. Intenta de nuevo más tarde.</p>
        )}
        <ul className="mt-4 space-y-2 text-sm text-[var(--slate-700)]">
          {communicationsLoading ? (
            <>
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </>
          ) : (
            communications.slice(0, 4).map((item) => (
              <CommunicationItem key={item.id} item={item} />
            ))
          )}
          {!communicationsLoading && communications.length === 0 && !communicationsError ? (
            <li className="rounded-xl border border-[var(--slate-200)] p-3 text-[var(--slate-500)]">
              No hay comunicados vigentes en este momento.
            </li>
          ) : null}
        </ul>
        <div className="mt-3">
          <Link className="text-sm font-medium text-[var(--brand-700)] hover:underline" href="/resident/communications">
            Ver todas las comunicaciones
          </Link>
        </div>
      </Card>
    </section>
  );
}
