"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { confirmPackageReceived, usePackages } from "@/features/packages/use-packages";
import { usePackageDirectory } from "@/features/security-guard/use-package-directory";
import { useModuleVariant } from "@/lib/config/use-module-variant";
import type { PackageItem } from "@/types/domain";
import { getStatusLabel } from "@/utils/statusMapper";
import { splitTowerUnit } from "@/lib/utils/unit-display";

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

function getDeliveredToName(item: PackageItem) {
  return item.deliveredToName || item.residentName || item.recipientName || "Sin asignar";
}

export function GuardPackagesList({ tenantId, userId }: { tenantId?: string; userId?: string }) {
  const { items, loading, error } = usePackages(tenantId);
  const { residents, residentsByUnitId, loading: loadingDirectory, error: directoryError } = usePackageDirectory(tenantId);
  const isSimpleMode = useModuleVariant(tenantId, "packages") === "aviso_simple";
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deliveredToByPackageId, setDeliveredToByPackageId] = useState<Record<string, string>>({});

  const rows = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        arrivedLabel: formatDate(item.arrivedAt),
        deliveredLabel: formatDate(item.deliveredAt || item.receivedAt),
        residentDisplayName: item.residentName || item.recipientName || "Sin asignar",
      })),
    [items],
  );

  const residentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const resident of residents) {
      map.set(resident.id, resident.fullName);
    }
    return map;
  }, [residents]);

  function getDeliveryOptions(item: PackageItem) {
    if (item.unitId) {
      const byUnit = residentsByUnitId.get(item.unitId) ?? [];
      if (byUnit.length > 0) return byUnit;
    }
    return residents;
  }

  function handleDeliveredToChange(packageId: string, residentId: string) {
    setDeliveredToByPackageId((prev) => ({
      ...prev,
      [packageId]: residentId,
    }));
  }

  async function markDelivered(item: PackageItem) {
    if (!tenantId || !userId) {
      toast.error("No se pudo identificar tu sesion para entregar paquetes.");
      return;
    }

    const selectedResidentId = deliveredToByPackageId[item.id]?.trim();
    if (!selectedResidentId) {
      toast.error("Selecciona el residente que recibe el paquete.");
      return;
    }

    const selectedResidentName = residentNameById.get(selectedResidentId) || "Residente";

    try {
      setProcessingId(item.id);
      await confirmPackageReceived({
        tenantId,
        packageId: item.id,
        userId,
        deliveredToId: selectedResidentId,
        deliveredToName: selectedResidentName,
      });
      toast.success("Paquete marcado como entregado.");
      setDeliveredToByPackageId((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setProcessingId(null);
    }
  }

  // Modo aviso simple: entrega de un toque, sin elegir residente ni firma.
  async function markDeliveredSimple(item: PackageItem) {
    if (!tenantId || !userId) {
      toast.error("No se pudo identificar tu sesion para entregar paquetes.");
      return;
    }
    try {
      setProcessingId(item.id);
      await confirmPackageReceived({ tenantId, packageId: item.id, userId });
      toast.success("Paquete marcado como entregado.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <Card>
      <CardTitle>Paquetes recibidos</CardTitle>
      <CardDescription className="mt-1">
        {isSimpleMode
          ? "Registro de paquetes y entrega rápida. El residente recibe la notificación al registrarse."
          : "Operación de entrega con trazabilidad de quien recibe cada paquete."}
      </CardDescription>

      {error ? <p className="mt-3 text-sm text-[var(--danger-700)]">{error}</p> : null}
      {directoryError ? <p className="mt-2 text-sm text-[var(--danger-700)]">{directoryError}</p> : null}

      <div className="mt-4 space-y-3">
        {loading ? <p className="text-sm text-[var(--slate-600)]">Cargando paquetes...</p> : null}
        {!loading && rows.length === 0 ? <p className="text-sm text-[var(--slate-600)]">No hay paquetes registrados.</p> : null}

        {rows.map((item) => {
          const options = getDeliveryOptions(item);
          const selectedResidentId = deliveredToByPackageId[item.id] || "";

          return (
            <article
              key={item.id}
              className="rounded-2xl border border-[var(--slate-200)] bg-white p-4 shadow-[0_10px_20px_rgba(10,40,70,0.08)]"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <p className="text-base font-semibold text-[var(--slate-900)]">{item.residentDisplayName}</p>
                  <p className="text-sm text-[var(--slate-700)]">Unidad: <span className="font-medium">{item.unitLabel ? splitTowerUnit(item.unitLabel).formatted : "Sin unidad"}</span></p>
                  <p className="text-sm text-[var(--slate-700)]">Torre: <span className="font-medium">{item.tower || item.towerId || "-"}</span></p>
                  <p className="text-sm text-[var(--slate-700)]">Descripcion: <span className="font-medium">{item.description || "Sin descripcion"}</span></p>
                  <p className="text-xs text-[var(--slate-600)]">Llegada: {item.arrivedLabel}</p>
                </div>

                <div className="w-full space-y-3 md:w-[320px]">
                  <div className="flex items-center justify-between gap-3">
                    <Badge className={item.status === "delivered" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                      {getStatusLabel(item.status)}
                    </Badge>
                    {item.status === "delivered" ? <p className="text-xs text-[var(--slate-600)]">{item.deliveredLabel}</p> : null}
                  </div>

                  {item.status === "delivered" ? (
                    <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      Entregado a: {getDeliveredToName(item)}
                    </p>
                  ) : isSimpleMode ? (
                    <Button
                      type="button"
                      className="h-11 w-full"
                      disabled={processingId === item.id}
                      onClick={() => void markDeliveredSimple(item)}
                    >
                      {processingId === item.id ? "Procesando..." : "Marcar entregado"}
                    </Button>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-[var(--slate-700)]">Entregado a</label>
                      <select
                        value={selectedResidentId}
                        onChange={(event) => handleDeliveredToChange(item.id, event.target.value)}
                        className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)] disabled:bg-[var(--slate-100)]"
                        disabled={processingId === item.id || loadingDirectory || options.length === 0}
                      >
                        <option value="">Selecciona residente</option>
                        {options.map((option) => (
                          <option key={option.id} value={option.id}>{option.fullName}</option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        className="h-11 w-full"
                        disabled={!selectedResidentId || processingId === item.id}
                        onClick={() => void markDelivered(item)}
                      >
                        {processingId === item.id ? "Procesando..." : "Confirmar entrega"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Card>
  );
}
