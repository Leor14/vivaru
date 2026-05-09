"use client";

import { useMemo } from "react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { usePackages } from "@/features/packages/use-packages";
import { useReservations } from "@/features/reservations/use-reservations";
import { useVisitorPasses } from "@/features/visitors/use-visitor-passes";

function isTodayDate(dateValue: string | undefined) {
  if (!dateValue) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateValue.slice(0, 10) === today;
}

function formatHourRange(start?: string, end?: string, fallback?: string) {
  if (start && end) return `${start} - ${end}`;
  return fallback ?? "-";
}

export function GuardDashboard({ tenantId }: { tenantId?: string }) {
  const { items: visitors, loading: loadingVisitors } = useVisitorPasses(tenantId);
  const { items: reservations, loading: loadingReservations } = useReservations(tenantId);
  const { items: packages, loading: loadingPackages } = usePackages(tenantId);

  const visitorsToday = useMemo(
    () => visitors.filter((visitor) => isTodayDate(visitor.date || visitor.visitDate) && visitor.status !== "completed"),
    [visitors],
  );

  const reservationsToday = useMemo(
    () => reservations.filter((reservation) => isTodayDate(reservation.date) && reservation.status !== "cancelled"),
    [reservations],
  );

  const pendingPackages = useMemo(
    () => packages.filter((pkg) => pkg.status === "pending"),
    [packages],
  );

  return (
    <section className="space-y-4">
      <Card>
        <CardTitle>Panel de Porteria</CardTitle>
        <CardDescription className="mt-1">
          Operación diaria de acceso, reservas y paquetería en una sola vista.
        </CardDescription>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardTitle>Visitantes esperados hoy</CardTitle>
          <CardDescription className="mt-2 text-3xl font-semibold text-[var(--slate-900)]">
            {loadingVisitors ? "..." : String(visitorsToday.length)}
          </CardDescription>
        </Card>
        <Card>
          <CardTitle>Reservas activas hoy</CardTitle>
          <CardDescription className="mt-2 text-3xl font-semibold text-[var(--slate-900)]">
            {loadingReservations ? "..." : String(reservationsToday.length)}
          </CardDescription>
        </Card>
        <Card>
          <CardTitle>Paquetes pendientes</CardTitle>
          <CardDescription className="mt-2 text-3xl font-semibold text-[var(--slate-900)]">
            {loadingPackages ? "..." : String(pendingPackages.length)}
          </CardDescription>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Visitantes del dia</CardTitle>
          <ul className="mt-3 space-y-2 text-sm">
            {visitorsToday.slice(0, 8).map((visitor) => (
              <li key={visitor.id} className="rounded-xl border border-[var(--slate-200)] p-3">
                <p className="font-medium text-[var(--slate-900)]">{visitor.visitorName}</p>
                <p className="text-[var(--slate-600)]">Unidad: {visitor.unitLabel}</p>
                <p className="text-[var(--slate-600)]">Estado: {visitor.status}</p>
              </li>
            ))}
            {visitorsToday.length === 0 ? (
              <li className="rounded-xl border border-dashed border-[var(--slate-300)] p-3 text-[var(--slate-600)]">
                No hay visitantes esperados hoy.
              </li>
            ) : null}
          </ul>
        </Card>

        <Card>
          <CardTitle>Reservas activas</CardTitle>
          <ul className="mt-3 space-y-2 text-sm">
            {reservationsToday.slice(0, 8).map((reservation) => (
              <li key={reservation.id} className="rounded-xl border border-[var(--slate-200)] p-3">
                <p className="font-medium text-[var(--slate-900)]">{reservation.amenity}</p>
                <p className="text-[var(--slate-600)]">Unidad: {reservation.unitLabel}</p>
                <p className="text-[var(--slate-600)]">
                  Horario: {formatHourRange(reservation.startTime, reservation.endTime, reservation.slot)}
                </p>
              </li>
            ))}
            {reservationsToday.length === 0 ? (
              <li className="rounded-xl border border-dashed border-[var(--slate-300)] p-3 text-[var(--slate-600)]">
                No hay reservas activas para hoy.
              </li>
            ) : null}
          </ul>
        </Card>
      </div>
    </section>
  );
}
