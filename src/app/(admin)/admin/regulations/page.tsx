"use client";

import { ModulePreviewGate } from "@/components/shared/module-preview-gate";
import { Tabs } from "@/components/ui/tabs";
import { useTabParam } from "@/lib/navigation/use-tab-param";
import { FolderOpen, ScrollText, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpTip } from "@/components/shared/help-tip";
import { CommitteeAgreementsTab } from "@/components/features/admin/regulations/committee-agreements-tab";
import { TablePager } from "@/components/shared/table-pager";
import { usePagination } from "@/components/shared/use-pagination";
import { useAuth } from "@/features/auth/auth-context";
import {
  foldRegulationsIntoFolder,
  setActiveRegulation,
  uploadRegulationDocument,
} from "@/features/regulations/services";
import { ensureSystemFolderCallable } from "@/lib/firebase/callables";
import type { RegulationSignature } from "@/features/regulations/types";
import { buildUnitIndex, resolveUnitName } from "@/utils/unitLabel";
import {
  useActiveRegulation,
  useRegulationSignatures,
} from "@/features/regulations/use-regulation";
import {
  watchUnits,
  watchPeople,
  type UnitItem,
  type PersonItem,
} from "@/features/admin/services";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

// ─── Signatures table ─────────────────────────────────────────────────────────

function SignaturesTable({
  signatures,
  loading,
  unitsById,
  peopleByUnitId,
}: {
  signatures: RegulationSignature[];
  loading: boolean;
  unitsById: Map<string, UnitItem>;
  peopleByUnitId: Map<string, PersonItem>;
}) {
  const pager = usePagination(signatures);
  const unitIndex = useMemo(() => buildUnitIndex(Array.from(unitsById.values())), [unitsById]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (signatures.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--slate-500)]">
        Ninguna unidad ha firmado el reglamento todavía.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--slate-200)] text-left text-xs font-medium uppercase tracking-wide text-[var(--slate-500)]">
            <th className="pb-2 pr-4">Unidad</th>
            <th className="pb-2 pr-4">Agrupación</th>
            <th className="pb-2 pr-4">Residente</th>
            <th className="pb-2 pr-4">Email</th>
            <th className="pb-2 pr-4">Fecha de firma</th>
            <th className="pb-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {pager.pageItems.map((sig) => {
            const unit = unitsById.get(sig.unitId);
            const person = peopleByUnitId.get(sig.unitId);

            const signedDate =
              sig.signedAt &&
              typeof sig.signedAt === "object" &&
              "toDate" in sig.signedAt
                ? (sig.signedAt as { toDate: () => Date }).toDate()
                : null;

            return (
              <tr
                key={sig.id}
                className="border-b border-[var(--slate-100)] last:border-0"
              >
                <td className="py-3 pr-4 font-medium text-[var(--slate-900)]">
                  {resolveUnitName(sig.unitId, unitIndex)}
                </td>
                <td className="py-3 pr-4 text-[var(--slate-600)]">
                  {unit?.tower ?? "—"}
                </td>
                <td className="py-3 pr-4 text-[var(--slate-900)]">
                  {person?.fullName ?? "—"}
                </td>
                <td className="py-3 pr-4 text-[var(--slate-600)]">
                  {person?.email ?? "—"}
                </td>
                <td className="py-3 pr-4 text-[var(--slate-600)]">
                  {signedDate ? formatDate(signedDate) : "—"}
                </td>
                <td className="py-3">
                  <Badge className="bg-emerald-100 text-emerald-700">Firmado</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pager.hasPagination ? (
        <TablePager
          page={pager.page}
          totalPages={pager.totalPages}
          total={pager.total}
          start={pager.start}
          pageSize={pager.pageSize}
          onPrev={pager.prev}
          onNext={pager.next}
          onPageSizeChange={pager.setPageSize}
        />
      ) : null}
    </div>
  );
}

// ─── Pending units table ───────────────────────────────────────────────────────

function PendingUnitsTable({
  units,
  signedUnitIds,
  peopleByUnitId,
}: {
  units: UnitItem[];
  signedUnitIds: Set<string>;
  peopleByUnitId: Map<string, PersonItem>;
}) {
  const pending = units.filter((u) => u.status === "active" && !signedUnitIds.has(u.id));

  const pager = usePagination(pending);

  if (pending.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-[var(--slate-500)]">
        Todas las unidades activas han firmado el reglamento. 🎉
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--slate-200)] text-left text-xs font-medium uppercase tracking-wide text-[var(--slate-500)]">
            <th className="pb-2 pr-4">Unidad</th>
            <th className="pb-2 pr-4">Agrupación</th>
            <th className="pb-2 pr-4">Titular</th>
            <th className="pb-2 pr-4">Email</th>
            <th className="pb-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {pager.pageItems.map((unit) => {
            const person = peopleByUnitId.get(unit.id);
            return (
              <tr
                key={unit.id}
                className="border-b border-[var(--slate-100)] last:border-0"
              >
                <td className="py-3 pr-4 font-medium text-[var(--slate-900)]">
                  {unit.displayName}
                </td>
                <td className="py-3 pr-4 text-[var(--slate-600)]">
                  {unit.tower || "—"}
                </td>
                <td className="py-3 pr-4 text-[var(--slate-900)]">
                  {person?.fullName ?? <span className="text-[var(--slate-400)]">Sin titular</span>}
                </td>
                <td className="py-3 pr-4 text-[var(--slate-600)]">
                  {person?.email ?? "—"}
                </td>
                <td className="py-3">
                  <Badge className="bg-amber-100 text-amber-700">Pendiente</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pager.hasPagination ? (
        <TablePager
          page={pager.page}
          totalPages={pager.totalPages}
          total={pager.total}
          start={pager.start}
          pageSize={pager.pageSize}
          onPrev={pager.prev}
          onNext={pager.next}
          onPageSizeChange={pager.setPageSize}
        />
      ) : null}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AdminRegulationsPageContent() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? "";

  const { activeRegulation, loading: regulationLoading } = useActiveRegulation(tenantId);
  const { signatures, loading: signaturesLoading } = useRegulationSignatures(
    tenantId,
    activeRegulation?.id,
  );

  // ── Load units & people for enrichment ────────────────────────────────────
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [people, setPeople] = useState<PersonItem[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = watchUnits(tenantId, setUnits, () => {});
    return unsub;
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const unsub = watchPeople(tenantId, setPeople, () => {});
    return unsub;
  }, [tenantId]);

  /** unit.id → UnitItem */
  const unitsById = useMemo(
    () => new Map(units.map((u) => [u.id, u])),
    [units],
  );

  /**
   * person.unitId → PersonItem (first active person per unit).
   * Covers both unitId formats (Firestore doc ID and slug).
   */
  const peopleByUnitId = useMemo(() => {
    const map = new Map<string, PersonItem>();
    for (const p of people) {
      if (!map.has(p.unitId) || p.status === "active") {
        map.set(p.unitId, p);
      }
    }
    return map;
  }, [people]);

  /** Set of unitIds that have already signed */
  const signedUnitIds = useMemo(
    () => new Set(signatures.map((s) => s.unitId)),
    [signatures],
  );

  // ── Stats ─────────────────────────────────────────────────────────────────
  // Misma regla que el widget del Panel de Control (use-regulation-compliance-
  // summary): cuentan las firmas vinculadas a una unidad ACTIVA. Antes se usaba
  // signatures.length crudo, que contaba firmas huérfanas o de unidades
  // inactivas → cifras distintas entre Panel y módulo (VIV-103) y "pendientes"
  // negativos.
  const activeUnits = units.filter((u) => u.status === "active");
  const totalActive = activeUnits.length;
  const signedCount = activeUnits.filter((u) => signedUnitIds.has(u.id)).length;
  const pendingCount = Math.max(totalActive - signedCount, 0);
  const complianceRate = totalActive > 0 ? Math.round((signedCount / totalActive) * 100) : 0;

  // La pestaña vive en la URL (`?vista=`), así se puede enlazar y el botón
  // «atrás» vuelve a la anterior en vez de salir de la pantalla.
  const [tab, setTab] = useTabParam("vista", CLAVES_PESTANA, "reglamento");
  const router = useRouter();

  // Carpeta de sistema "Reglamentos": se asegura y se backfillean los existentes.
  const [regulationsFolderId, setRegulationsFolderId] = useState<string | null>(null);
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      try {
        const { folderId } = await ensureSystemFolderCallable({ tenantId, systemKey: "regulations" });
        if (cancelled) return;
        setRegulationsFolderId(folderId);
        await foldRegulationsIntoFolder(tenantId, folderId);
      } catch {
        // best-effort: si falla, los reglamentos quedan sin carpeta.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tenantId || !user?.uid) return;

    if (file.type !== "application/pdf") {
      toast.error("Solo se permiten archivos PDF.");
      return;
    }

    setUploading(true);
    try {
      const title = titleFromFilename(file.name);
      const newDocId = await uploadRegulationDocument({
        tenantId,
        userId: user.uid,
        file,
        title,
        folderId: regulationsFolderId,
      });
      await setActiveRegulation(tenantId, newDocId);
      toast.success("Reglamento actualizado correctamente.");
    } catch {
      toast.error("Error al subir el reglamento. Intenta de nuevo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--slate-100)]">
            <ScrollText className="h-5 w-5 text-[var(--slate-600)]" />
          </div>
          {/* El nombre lo pone `PageHeader` desde el shell. */}
          <div className="flex items-center gap-2">
            <p className="text-sm text-[var(--slate-500)]">
              Gestiona el reglamento vigente y supervisa las firmas de residentes.
            </p>
            <HelpTip text="Carga y activa el reglamento interno del conjunto. Cuando los residentes tienen acceso fácil a las normas vigentes, se reducen los conflictos y la administración cuenta con respaldo documental ante cualquier incidencia." />
          </div>
        </div>

        {tab === "reglamento" ? (
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            {regulationsFolderId ? (
              <Button variant="outline" type="button" onClick={() => router.push(`/admin/documents?folder=${regulationsFolderId}`)}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Carpeta de reglamentos
              </Button>
            ) : null}
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !tenantId}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Subiendo…" : "Subir nuevo reglamento"}
            </Button>
          </div>
        ) : null}
      </div>

      <Tabs items={PESTANAS} value={tab} onChange={setTab} ariaLabel="Secciones de Reglamento" />

      {tab === "reglamento" ? (
        <>
      {/* ── Active regulation card ──────────────────────────────────────────── */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--slate-500)]">
              Reglamento vigente
            </p>
            {regulationLoading ? (
              <Skeleton className="h-6 w-48" />
            ) : activeRegulation ? (
              <>
                <CardTitle>{activeRegulation.title}</CardTitle>
                <CardDescription>
                  Subido el{" "}
                  {activeRegulation.uploadedAt
                    ? formatDate(new Date(activeRegulation.uploadedAt))
                    : "—"}
                </CardDescription>
              </>
            ) : (
              <CardDescription>
                No hay reglamento vigente. Sube el primero usando el botón de arriba.
              </CardDescription>
            )}
          </div>

          {activeRegulation && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(activeRegulation.fileUrl, "_blank")}
            >
              Ver PDF
            </Button>
          )}
        </div>
      </Card>

      {/* ── Compliance KPIs ────────────────────────────────────────────────── */}
      {activeRegulation && !signaturesLoading && totalActive > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-[var(--slate-200)] bg-white px-4 py-3">
            <p className="text-xs text-[var(--slate-500)]">Unidades activas</p>
            <p className="mt-0.5 text-xl font-semibold text-[var(--slate-900)]">{totalActive}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs text-emerald-700">Firmadas</p>
            <p className="mt-0.5 text-xl font-semibold text-emerald-700">{signedCount}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs text-amber-700">Pendientes</p>
            <p className="mt-0.5 text-xl font-semibold text-amber-700">{pendingCount}</p>
          </div>
          <div className="rounded-xl border border-[var(--slate-200)] bg-white px-4 py-3">
            <p className="text-xs text-[var(--slate-500)]">Cumplimiento</p>
            <p className="mt-0.5 text-xl font-semibold text-[var(--slate-900)]">{complianceRate}%</p>
          </div>
        </div>
      )}

      {/* ── Signatures section ─────────────────────────────────────────────── */}
      {activeRegulation && (
        <Card>
          <div className="mb-4">
            <CardTitle help="Seguimiento de qué residentes han leído y firmado el reglamento vigente. Una alta tasa de firmas fortalece la posición de la administración ante cualquier disputa sobre las normas del conjunto.">
              Estado de firmas
            </CardTitle>
            <CardDescription className="mt-0.5">
              {signaturesLoading
                ? "Cargando firmas…"
                : `${signedCount} firma${signedCount !== 1 ? "s" : ""} registrada${signedCount !== 1 ? "s" : ""}`}
            </CardDescription>
          </div>
          <SignaturesTable
            signatures={signatures}
            loading={signaturesLoading}
            unitsById={unitsById}
            peopleByUnitId={peopleByUnitId}
          />
        </Card>
      )}

      {/* ── Pending units section ──────────────────────────────────────────── */}
      {activeRegulation && !signaturesLoading && (
        <Card>
          <div className="mb-4">
            <CardTitle>
              Unidades pendientes de firma
            </CardTitle>
            <CardDescription className="mt-0.5">
              {pendingCount > 0
                ? `${pendingCount} unidad${pendingCount !== 1 ? "es activas" : " activa"} sin firma todavía.`
                : "Sin pendientes."}
            </CardDescription>
          </div>
          <PendingUnitsTable
            units={units}
            signedUnitIds={signedUnitIds}
            peopleByUnitId={peopleByUnitId}
          />
        </Card>
      )}

      {/* Empty state when no regulation exists */}
      {!regulationLoading && !activeRegulation && (
        <div className="rounded-2xl border border-dashed border-[var(--slate-300)] py-16 text-center">
          <ScrollText className="mx-auto mb-3 h-10 w-10 text-[var(--slate-400)]" />
          <p className="font-medium text-[var(--slate-700)]">
            No hay reglamento vigente
          </p>
          <p className="mt-1 text-sm text-[var(--slate-500)]">
            Sube el primer reglamento usando el botón de arriba.
          </p>
        </div>
      )}
        </>
      ) : null}

      {tab === "acuerdos" ? (
        <CommitteeAgreementsTab
          tenantId={tenantId}
          userId={user?.uid}
          units={units}
          peopleByUnitId={peopleByUnitId}
        />
      ) : null}
    </div>
  );
}

/**
 * Durante la prueba este módulo es VISTA PREVIA: se explora con datos de
 * ejemplo pero no se opera (ver src/lib/config/trial-modules.ts). Para un
 * cliente activo, el gate es transparente.
 */
/** Nivel de módulo: la lista de claves tiene que ser estable entre renders. */
const PESTANAS = [
  { key: "reglamento", label: "Reglamento" },
  { key: "acuerdos", label: "Acuerdos de comité" },
] as const;
const CLAVES_PESTANA = PESTANAS.map((pestana) => pestana.key);

export default function AdminRegulationsPage() {
  return (
    <ModulePreviewGate module="regulations">
      <AdminRegulationsPageContent />
    </ModulePreviewGate>
  );
}
