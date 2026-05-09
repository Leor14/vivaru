"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { useBillingStatements } from "@/features/billing/use-billing-statements";

export default function ResidentAccountPage() {
  const { user } = useAuth();
  const { items, loading } = useBillingStatements(user?.tenantId, user?.unitId);

  return (
    <Card>
      <CardTitle>Estado de cuenta</CardTitle>
      <CardDescription className="mt-1">Saldo, movimientos, cuotas y carga de comprobante.</CardDescription>
      <div className="mt-4 grid gap-2 text-sm">
        {loading ? <p className="text-[var(--slate-600)]">Cargando estado de cuenta...</p> : null}
        {!loading && items.length === 0 ? (
          <EmptyState
            title="Sin movimientos"
            description="Aun no hay estados de cuenta publicados para tu unidad."
          />
        ) : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-[var(--slate-200)] p-3">
            {item.period} - Saldo ${item.balance.toLocaleString("es-CO")} - {item.status === "paid" ? "Al dia" : "Pendiente"}
          </div>
        ))}
      </div>
      <Button className="mt-4">Subir comprobante</Button>
    </Card>
  );
}
