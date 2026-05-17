"use client";

import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { confirmPackageReceived, usePackages } from "@/features/packages/use-packages";
import { getStatusLabel } from "@/utils/statusMapper";

function formatDate(value: unknown) {
  if (!value) return "-";

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(parsed);
    }
    return value;
  }

  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return new Intl.DateTimeFormat("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format((value as { toDate: () => Date }).toDate());
  }

  return "-";
}

function resolveGuardName(item: {
  receivedByGuardName?: string;
  registeredByName?: string;
  status: string;
}) {
  if (item.receivedByGuardName?.trim()) return item.receivedByGuardName;
  if (item.registeredByName?.trim()) return item.registeredByName;
  return item.status === "pending" ? "Guardia no registrado" : "No registrado";
}

export default function ResidentPackagesPage() {
  const { user } = useAuth();
  const { items, loading } = usePackages(user?.tenantId, user?.unitId);

  async function handleConfirm(packageId: string) {
    if (!user?.tenantId) return;
    try {
      await confirmPackageReceived({ tenantId: user.tenantId, packageId, userId: user.uid });
      toast.success("Paquete confirmado como recibido.");
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  return (
    <Card>
      <CardTitle>Paquetería</CardTitle>
      <CardDescription className="mt-1">Consulta de paquetes pendientes y confirmacion de recibido.</CardDescription>
      <div className="mt-4 space-y-3 text-sm">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-[var(--slate-200)] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-14 rounded" />
                    <Skeleton className="h-5 w-28 rounded" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="mt-3 space-y-1.5">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-4/5 rounded" />
                  <Skeleton className="h-4 w-2/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {!loading && items.length === 0 ? (
          <EmptyState
            title="Sin paquetes"
            description="No tienes paquetes pendientes por recoger en este momento."
          />
        ) : null}
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-[var(--slate-200)] bg-white p-4 shadow-[0_8px_20px_rgba(10,40,70,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-[var(--slate-500)]">Codigo</p>
                <p className="text-base font-semibold text-[var(--slate-900)]">{item.reference || `PK-${item.id.slice(0, 6).toUpperCase()}`}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {getStatusLabel(item.status)}
              </span>
            </div>

            <div className="mt-3 grid gap-1 text-sm">
              <p className="text-[var(--slate-700)]">Descripcion: <span className="font-medium text-[var(--slate-900)]">{item.description?.trim() || "Sin descripcion"}</span></p>
              <p className="text-[var(--slate-700)]">Recibido en porteria por: <span className="font-medium text-[var(--slate-900)]">{resolveGuardName(item)}</span></p>
              <p className="text-[var(--slate-700)]">Fecha de recepción: <span className="font-medium text-[var(--slate-900)]">{formatDate(item.arrivedAt)}</span></p>
              {item.status === "delivered" ? (
                <p className="text-[var(--slate-700)]">Fecha de entrega: <span className="font-medium text-[var(--slate-900)]">{formatDate(item.deliveredAt || item.receivedAt)}</span></p>
              ) : null}
            </div>

            {item.status === "pending" ? (
              <Button className="mt-2" size="sm" onClick={() => void handleConfirm(item.id)}>
                Confirmar recibido
              </Button>
            ) : null}
          </article>
        ))}
      </div>
    </Card>
  );
}
