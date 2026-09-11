"use client";

import { useEffect, useState } from "react";
import { FileText, PenLine } from "lucide-react";
import { toast } from "sonner";

import { ResumenDelInforme } from "@/components/features/finanzas/ResumenDelInforme";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/features/auth/auth-context";
import { rotuloDelPeriodo } from "@/features/finanzas/informe-mensual-texto";
import { watchInformesEmitidos, type MonthlyReport } from "@/features/finanzas/use-monthly-reports";
import { veLasPantallasDelConsejo } from "@/lib/auth/consejo";
import { useFeatureFlag, useFeatureFlags } from "@/lib/feature-flags/provider";
import { signMonthlyReportCallable } from "@/lib/firebase/callables";
import { toastFirebaseError } from "@/lib/utils/error-handler";

/**
 * `PRD-V-PLAT-004` entrega 2 — los informes del conjunto, para el consejo.
 *
 * El consejero es un residente con la marca (`RN-01`), así que esta pantalla vive en su portal
 * (`TBD-B`). Lee los TOTALES de los informes que la administración ya emitió y los firma. **No
 * escribe nada directo**: firmar va por callable, y el nombre y el cargo los pone el servidor
 * (`identidadParaFirmar`), que además rehace el PDF con la firma.
 *
 * **Sin el PDF, a propósito** (David, 11 sep 2026). El PDF lista la cartera por unidad, y con
 * `K2` cerrado —hasta la entrega 3 de `FLOW-007`, que espera al abogado— el consejo ve el
 * agregado y no ese detalle. El PDF firmado lo abre la administración.
 *
 * **Sin la marca no pregunta.** La regla le rechazaría la consulta a un residente cualquiera, y
 * un error en pantalla diría que algo falló cuando lo que pasa es que no le toca.
 */
export default function InformesDelConsejoPage() {
  const { user } = useAuth();
  const { ready: banderasListas } = useFeatureFlags();
  const bandera = useFeatureFlag("producto-rol-consejo");
  const esConsejo = veLasPantallasDelConsejo(user, bandera);
  const tenantId = user?.tenantId;

  const [informes, setInformes] = useState<MonthlyReport[]>([]);
  const [cargando, setCargando] = useState(true);
  const [firmando, setFirmando] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !esConsejo) return;
    setCargando(true);
    return watchInformesEmitidos(
      tenantId,
      (items) => {
        setInformes(items);
        setCargando(false);
      },
      (mensaje) => {
        setCargando(false);
        // **El error se enseña, no se traga**: «no hay informes» se leería como un dato del
        // conjunto y no como un problema de lectura.
        toast.error(mensaje);
      },
    );
  }, [tenantId, esConsejo]);

  async function firmar(informe: MonthlyReport) {
    if (!tenantId) return;
    setFirmando(informe.id);
    try {
      const r = await signMonthlyReportCallable({ tenantId, reportId: informe.id });
      if (r.pdfActualizado === false) {
        // La firma SÍ quedó: lo que falló es rehacer el papel, y lo rehace la próxima firma.
        toast.warning("Firma registrada. El PDF no se pudo actualizar ahora; se actualizará con la próxima firma.");
      } else {
        toast.success("Firma registrada.");
      }
    } catch (e) {
      toastFirebaseError(e);
    } finally {
      setFirmando(null);
    }
  }

  if (!user || !banderasListas) {
    return (
      <Card>
        <Skeleton className="h-5 w-48 rounded-sm" />
        <Skeleton className="mt-4 h-28 w-full rounded-xl" />
      </Card>
    );
  }

  if (!esConsejo) {
    return (
      <Card>
        <EmptyState
          title="Esta sección es del consejo de administración"
          description="La administración del conjunto nombra a los miembros del consejo. Si eres del consejo y no ves los informes, pídele que revise tu nombramiento."
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Informes del conjunto</CardTitle>
      <CardDescription className="mt-1">
        Los informes económicos que la administración ya emitió. Como miembro del consejo puedes
        leer sus totales y firmarlos.
      </CardDescription>

      {cargando ? (
        <div className="mt-4 space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : null}

      {!cargando && informes.length === 0 ? (
        <EmptyState
          title="Sin informes emitidos"
          description="Cuando la administración emita el informe de un mes, aparecerá aquí para leerlo y firmarlo."
        />
      ) : null}

      <div className="mt-4 space-y-3">
        {informes.map((informe) => {
          const yaFirme = (informe.signatures ?? []).some((f) => f.uid === user.uid);
          // Un anulado se ve, con su motivo, pero ya no se firma: no queda nada que aprobar.
          const firmable = informe.status === "emitido" || informe.status === "publicado";
          return (
            <div
              key={informe.id}
              className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[var(--slate-500)]" />
                  <span className="font-medium text-[var(--slate-900)]">{rotuloDelPeriodo(informe.period)}</span>
                  <StatusBadge status={informe.status} />
                </div>
                {firmable ? (
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={firmando !== null || yaFirme}
                    onClick={() => void firmar(informe)}
                  >
                    <PenLine className="mr-1.5 h-3.5 w-3.5" />
                    {yaFirme ? "Ya firmaste" : "Firmar"}
                  </Button>
                ) : null}
              </div>

              <ResumenDelInforme informe={informe} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
