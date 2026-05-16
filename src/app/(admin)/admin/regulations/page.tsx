"use client";

import { ScrollText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpTip } from "@/components/shared/help-tip";
import { useAuth } from "@/features/auth/auth-context";
import {
  setActiveRegulation,
  uploadRegulationDocument,
} from "@/features/regulations/services";
import type { RegulationSignature } from "@/features/regulations/types";
import {
  useActiveRegulation,
  useRegulationSignatures,
} from "@/features/regulations/use-regulation";

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
}: {
  signatures: RegulationSignature[];
  loading: boolean;
}) {
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
            <th className="pb-2 pr-4">Residente (uid)</th>
            <th className="pb-2 pr-4">Fecha de firma</th>
            <th className="pb-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {signatures.map((sig) => {
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
                  {sig.unitId}
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-[var(--slate-600)]">
                  {sig.signedBy.slice(0, 12)}…
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
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminRegulationsPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? "";

  const { activeRegulation, loading: regulationLoading } = useActiveRegulation(tenantId);
  const { signatures, loading: signaturesLoading } = useRegulationSignatures(
    tenantId,
    activeRegulation?.id,
  );

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
      });
      await setActiveRegulation(tenantId, newDocId);
      toast.success("Reglamento actualizado correctamente.");
    } catch {
      toast.error("Error al subir el reglamento. Intenta de nuevo.");
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--slate-100)]">
            <ScrollText className="h-5 w-5 text-[var(--slate-600)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[var(--slate-900)]">
                Reglamento del edificio
              </h1>
              <HelpTip text="Carga y activa el reglamento interno del conjunto. Cuando los residentes tienen acceso fácil a las normas vigentes, se reducen los conflictos y la administración cuenta con respaldo documental ante cualquier incidencia." />
            </div>
            <p className="text-sm text-[var(--slate-500)]">
              Gestiona el reglamento vigente y supervisa las firmas de residentes.
            </p>
          </div>
        </div>

        {/* Upload button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !tenantId}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Subiendo…" : "Subir nuevo reglamento"}
          </Button>
        </div>
      </div>

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

      {/* ── Signatures section ─────────────────────────────────────────────── */}
      {activeRegulation && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <CardTitle help="Seguimiento de qué residentes han leído y firmado el reglamento vigente. Una alta tasa de firmas fortalece la posición de la administración ante cualquier disputa sobre las normas del conjunto.">Estado de firmas</CardTitle>
              <CardDescription className="mt-0.5">
                {signaturesLoading
                  ? "Cargando firmas…"
                  : `${signatures.length} firma${signatures.length !== 1 ? "s" : ""} registrada${signatures.length !== 1 ? "s" : ""}`}
              </CardDescription>
            </div>
          </div>
          <SignaturesTable signatures={signatures} loading={signaturesLoading} />
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
    </div>
  );
}
