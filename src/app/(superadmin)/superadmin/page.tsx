"use client";

import { useEffect, useState } from "react";
import { collection, getCountFromServer, getDocs, limit, query } from "firebase/firestore";

import { MetricCard } from "@/components/shared/metric-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase/client";
import type { Tenant } from "@/types/domain";

export default function SuperadminDashboardPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [totalReservations, setTotalReservations] = useState(0);
  const [openTickets, setOpenTickets] = useState(0);

  useEffect(() => {
    if (!db) return;
    const firestore = db!;

    async function loadGlobalMetrics() {
      const tenantsSnap = await getDocs(query(collection(firestore, "tenants"), limit(50)));
      const tenantItems = tenantsSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }) as Tenant);
      setTenants(tenantItems);

      const reservationsCount = await getCountFromServer(collection(firestore, "reservations"));
      const openTicketsCount = await getCountFromServer(collection(firestore, "tickets"));

      setTotalReservations(reservationsCount.data().count);
      setOpenTickets(openTicketsCount.data().count);
    }

    void loadGlobalMetrics();
  }, []);

  const activeTenants = tenants.filter((tenant) => tenant.status === "active").length;
  const trialTenants = tenants.filter((tenant) => tenant.status === "trial").length;
  const suspendedTenants = tenants.filter((tenant) => tenant.status === "suspended").length;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Tenants totales" value={String(tenants.length)} />
        <MetricCard label="Activos" value={String(activeTenants)} />
        <MetricCard label="Prueba" value={String(trialTenants)} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Suspendidos" value={String(suspendedTenants)} />
        <MetricCard label="Reservas totales" value={String(totalReservations)} />
        <MetricCard label="Tickets totales" value={String(openTickets)} />
      </div>
      <Card>
        <CardTitle>Alertas operativas</CardTitle>
        <CardDescription className="mt-2">Tenants con onboarding incompleto y uso de modulos.</CardDescription>
        <ul className="mt-4 space-y-2 text-sm text-[var(--slate-700)]">
          {tenants.slice(0, 8).map((tenant) => (
            <li key={tenant.id} className="rounded-xl border border-[var(--slate-200)] p-3">
              <strong>{tenant.name}</strong> - estado: {tenant.status} - onboarding: {tenant.onboardingStatus}
            </li>
          ))}
          {tenants.length === 0 ? (
            <li className="rounded-xl border border-[var(--slate-200)] p-3">No hay tenants cargados o no tienes acceso global.</li>
          ) : null}
        </ul>
      </Card>
    </section>
  );
}
