"use client";

import Link from "next/link";

import { MetricCard } from "@/components/shared/metric-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { useBillingStatements } from "@/features/billing/use-billing-statements";
import { useCommunications } from "@/features/communications/use-communications";
import { usePackages } from "@/features/packages/use-packages";
import { useReservations } from "@/features/reservations/use-reservations";
import { useVisitorPasses } from "@/features/visitors/use-visitor-passes";

function formatDateLabel(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

export default function ResidentHomePage() {
  const { user } = useAuth();

  const tenantId = user?.tenantId;
  const unitId = user?.unitId;

  const {
    items: billing = [],
    loading: billingLoading,
    error: billingError,
  } = useBillingStatements(tenantId, unitId);
  const {
    items: reservations = [],
    loading: reservationsLoading,
    error: reservationsError,
  } = useReservations(tenantId, unitId);
  const {
    items: visitors = [],
    loading: visitorsLoading,
    error: visitorsError,
  } = useVisitorPasses(tenantId, unitId);
  const {
    items: packages = [],
    loading: packagesLoading,
    error: packagesError,
  } = usePackages(tenantId, unitId);
  const {
    items: communications = [],
    loading: communicationsLoading,
    error: communicationsError,
  } = useCommunications(tenantId);

  // Defensive guards for missing associations
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

  // Defensive metrics with try/catch and fallback
  let pendingBalance = 0;
  try {
    pendingBalance = billing.filter((item) => item.status === "pending").reduce((sum, item) => sum + (item.balance || 0), 0);
  } catch (e) {
    console.error("[resident-home] Error calculando saldo pendiente", e, billing);
    pendingBalance = 0;
  }
  let nextReservation = null;
  try {
    nextReservation = reservations[0] || null;
  } catch (e) {
    console.error("[resident-home] Error obteniendo próxima reserva", e, reservations);
    nextReservation = null;
  }
  let activeVisitors = 0;
  try {
    activeVisitors = visitors.filter((item) => item.status !== "completed").length;
  } catch (e) {
    console.error("[resident-home] Error contando visitantes activos", e, visitors);
    activeVisitors = 0;
  }
  let pendingPackages = 0;
  try {
    pendingPackages = packages.filter((item) => item.status === "pending").length;
  } catch (e) {
    console.error("[resident-home] Error contando paquetes pendientes", e, packages);
    pendingPackages = 0;
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Saldo pendiente */}
        <MetricCard
          label="Saldo pendiente"
          value={billingLoading ? "Cargando..." : `$${pendingBalance.toLocaleString("es-CO")}`}
        />
        {/* Próxima reserva */}
        <MetricCard
          label="Proxima reserva"
          value={reservationsLoading ? "Cargando..." : (nextReservation ? `${nextReservation.amenity || "Amenidad"} ${nextReservation.date || ""}` : "Sin reservas")}
        />
        {/* Visitantes activos */}
        <MetricCard
          label="Visitantes activos"
          value={visitorsLoading ? "Cargando..." : String(activeVisitors)}
        />
        {/* Paquetes pendientes */}
        <MetricCard
          label="Paquetes pendientes"
          value={packagesLoading ? "Cargando..." : String(pendingPackages)}
        />
      </div>

      {/* Errores localizados por bloque */}
      {(billingError || reservationsError || visitorsError || packagesError) && (
        <Card className="bg-[var(--red-50)] border-[var(--red-200)]">
          <CardTitle>Algunos datos no se pudieron cargar</CardTitle>
          <CardDescription className="mt-1 text-[var(--red-700)]">
            {billingError && <div>Saldo: {billingError}</div>}
            {reservationsError && <div>Reservas: {reservationsError}</div>}
            {visitorsError && <div>Visitantes: {visitorsError}</div>}
            {packagesError && <div>Paquetes: {packagesError}</div>}
          </CardDescription>
        </Card>
      )}

      <Card>
        <CardTitle>Accesos rapidos</CardTitle>
        <CardDescription className="mt-1">
          Gestióna tu vida residencial en menos de 2 taps desde movil.
        </CardDescription>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link className="rounded-xl border border-[var(--slate-200)] p-3 text-sm hover:bg-[var(--slate-100)]" href="/resident/account">
            Ver estado de cuenta
          </Link>
          <Link className="rounded-xl border border-[var(--slate-200)] p-3 text-sm hover:bg-[var(--slate-100)]" href="/resident/reservations">
            Reservar amenidades
          </Link>
          <Link className="rounded-xl border border-[var(--slate-200)] p-3 text-sm hover:bg-[var(--slate-100)]" href="/resident/visitors">
            Autorizar visitantes
          </Link>
          <Link className="rounded-xl border border-[var(--slate-200)] p-3 text-sm hover:bg-[var(--slate-100)]" href="/resident/pqrs">
            Crear PQRS
          </Link>
        </div>
      </Card>

      <Card>
        <CardTitle>Comunicados recientes</CardTitle>
        <CardDescription className="mt-1">Ultimos anuncios del edificio para tu unidad.</CardDescription>
        {communicationsError && (
          <div className="text-[var(--red-700)] text-sm p-2">No se pudieron cargar los comunicados: {communicationsError}</div>
        )}
        <ul className="mt-4 space-y-2 text-sm text-[var(--slate-700)]">
          {communicationsLoading ? (
            <li className="rounded-xl border border-[var(--slate-200)] p-3">Cargando comunicados...</li>
          ) : (
            communications.slice(0, 4).map((item) => (
              <li key={item.id} className="rounded-xl border border-[var(--slate-200)] bg-white p-3">
                <p className="font-medium text-[var(--slate-900)]">{item.title}</p>
                {formatDateLabel(item.publishedAt) ? <p className="mt-1 text-xs text-[var(--slate-600)]">Publicado: {formatDateLabel(item.publishedAt)}</p> : null}
                {formatDateLabel(item.endsAt) ? <p className="mt-1 text-xs text-[var(--slate-600)]">Vigente hasta: {formatDateLabel(item.endsAt)}</p> : null}
                <p className="mt-2 whitespace-pre-wrap text-[var(--slate-700)]">{item.body}</p>
                {item.attachments.length > 0 ? (
                  <div className="mt-3 border-t border-[var(--slate-200)] pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Adjuntos</p>
                    <ul className="mt-1 space-y-1">
                      {item.attachments.map((attachment) => (
                        <li key={`${item.id}-${attachment.url}`}>
                          <a className="text-[var(--brand-700)] hover:underline" href={attachment.url} target="_blank" rel="noreferrer">
                            {attachment.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            ))
          )}
          {!communicationsLoading && communications.length === 0 && !communicationsError ? (
            <li className="rounded-xl border border-[var(--slate-200)] p-3">No hay comunicados vigentes en este momento.</li>
          ) : null}
        </ul>
        <div className="mt-3">
          <Link className="text-sm text-[var(--brand-700)] hover:underline" href="/resident/communications">
            Ver todas las comunicaciones
          </Link>
        </div>
      </Card>
    </section>
  );
}
