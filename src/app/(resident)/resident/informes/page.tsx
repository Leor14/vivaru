"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, PenLine } from "lucide-react";
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
import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { TenantDocument } from "@/types/domain";

/**
 * `PRD-V-PLAT-004` entrega 2 — los informes del conjunto, para el consejo.
 *
 * El consejero es un residente con la marca (`RN-01`), así que esta pantalla vive en su portal
 * (`TBD-B`). Lee los informes que la administración ya emitió, abre su PDF y los firma. **No
 * escribe nada directo**: firmar va por callable, y el nombre y el cargo los pone el servidor
 * (`identidadParaFirmar`), que además rehace el PDF con la firma.
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
  const [pdfs, setPdfs] = useState<TenantDocument[]>([]);
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

  // El PDF de cada informe es un documento de categoría `informe_mensual`: lo archiva el
  // servidor al emitir y lo rehace en cada firma, con el mismo id. **La consulta NOMBRA la
  // categoría** porque la regla se la concede al consejo por categoría, y sin el filtro
  // Firestore la rechazaría entera.
  useEffect(() => {
    if (!tenantId || !esConsejo) return;
    const unsub = subscribeTenantCollection<TenantDocument>(
      "documents",
      tenantId,
      setPdfs,
      () => toast.error("No se pudieron cargar los PDF de los informes."),
      { oneOf: { field: "category", values: ["informe_mensual"] } },
    );
    return () => {
      if (unsub) unsub();
    };
  }, [tenantId, esConsejo]);

  const urlDelPdf = useMemo(() => new Map(pdfs.map((d) => [d.id, d.fileUrl])), [pdfs]);

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
        leerlos, abrir su PDF y firmarlos.
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
          const url = informe.documentId ? urlDelPdf.get(informe.documentId) : undefined;
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
                <div className="flex flex-wrap items-center gap-3">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-700)] underline-offset-2 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver PDF
                    </a>
                  ) : null}
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
              </div>

              <ResumenDelInforme informe={informe} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
