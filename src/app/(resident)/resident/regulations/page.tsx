"use client";

import { CheckCircle, ExternalLink, ScrollText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import {
  getMySignature,
  signRegulation,
} from "@/features/regulations/services";
import type { RegulationSignature } from "@/features/regulations/types";
import { useActiveRegulation } from "@/features/regulations/use-regulation";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResidentRegulationsPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? "";
  const unitId = user?.unitId ?? "";
  const uid = user?.uid ?? "";

  const { activeRegulation, loading: regulationLoading } = useActiveRegulation(tenantId);

  // ── Signature state ───────────────────────────────────────────────────────
  const [mySignature, setMySignature] = useState<RegulationSignature | null>(null);
  const [checkingSignature, setCheckingSignature] = useState(false);

  useEffect(() => {
    if (!activeRegulation || !unitId) {
      setMySignature(null);
      return;
    }

    let cancelled = false;
    setCheckingSignature(true);

    void getMySignature(activeRegulation.id, unitId).then((sig) => {
      if (cancelled) return;
      setMySignature(sig);
      setCheckingSignature(false);
    }).catch(() => {
      if (cancelled) return;
      setCheckingSignature(false);
    });

    return () => {
      cancelled = true;
      setCheckingSignature(false);
    };
  }, [activeRegulation?.id, unitId]);

  // ── Form state ────────────────────────────────────────────────────────────
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);

  const checkboxRef = useRef<HTMLInputElement>(null);

  async function handleSign() {
    if (!activeRegulation || !tenantId || !unitId || !uid) return;

    setSigning(true);
    try {
      await signRegulation(tenantId, activeRegulation, unitId, uid);
      // Refresh signature
      const sig = await getMySignature(activeRegulation.id, unitId);
      setMySignature(sig);
      setAccepted(false);
      toast.success("Reglamento firmado exitosamente.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message === "ALREADY_SIGNED") {
        toast.info("Ya firmaste este reglamento.");
        const sig = await getMySignature(activeRegulation.id, unitId);
        setMySignature(sig);
      } else {
        toast.error("Error al firmar el reglamento. Intenta de nuevo.");
      }
    } finally {
      setSigning(false);
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  const isLoading = regulationLoading || checkingSignature;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // ── No active regulation ──────────────────────────────────────────────────
  if (!activeRegulation) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <div className="rounded-2xl border border-dashed border-[var(--slate-300)] py-20 text-center">
          <ScrollText className="mx-auto mb-3 h-10 w-10 text-[var(--slate-400)]" />
          <p className="font-medium text-[var(--slate-700)]">
            Reglamento no disponible
          </p>
          <p className="mt-1 text-sm text-[var(--slate-500)]">
            El administrador aún no ha publicado el reglamento del edificio.
          </p>
        </div>
      </div>
    );
  }

  // ── Already signed ────────────────────────────────────────────────────────
  if (mySignature) {
    const signedDate =
      mySignature.signedAt &&
      typeof mySignature.signedAt === "object" &&
      "toDate" in mySignature.signedAt
        ? (mySignature.signedAt as { toDate: () => Date }).toDate()
        : null;

    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--slate-100)]">
            <ScrollText className="h-5 w-5 text-[var(--slate-600)]" />
          </div>
          <h1 className="text-xl font-semibold text-[var(--slate-900)]">
            Reglamento del edificio
          </h1>
        </div>

        <Card>
          <div className="flex items-start gap-4">
            <CheckCircle className="mt-0.5 h-8 w-8 flex-shrink-0 text-emerald-500" />
            <div className="space-y-1">
              <CardTitle className="text-emerald-700">Ya firmaste este reglamento</CardTitle>
              <CardDescription>{mySignature.regulationVersion}</CardDescription>
              {signedDate && (
                <p className="text-sm text-[var(--slate-500)]">
                  Firmado el {formatDate(signedDate)}
                </p>
              )}
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(activeRegulation.fileUrl, "_blank")}
                >
                  Ver reglamento
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ── Unsigned: show PDF + checkbox + sign button ───────────────────────────
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--slate-100)]">
          <ScrollText className="h-5 w-5 text-[var(--slate-600)]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[var(--slate-900)]">
            Reglamento del edificio
          </h1>
          <p className="text-sm text-[var(--slate-500)]">{activeRegulation.title}</p>
        </div>
      </div>

      {/* Document card — reemplaza iframe (inoperante en iOS Safari) */}
      <div className="rounded-xl border border-[var(--slate-200)] bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-50)]">
            <ScrollText className="h-5 w-5 text-[var(--brand-700)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--slate-900)]">{activeRegulation.title}</p>
            <p className="text-xs text-[var(--slate-500)]">Documento PDF</p>
          </div>
        </div>
        <a
          href={activeRegulation.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] px-4 py-2.5 text-sm font-medium text-[var(--brand-700)] [transition:background-color_150ms_ease-out] hover:bg-[var(--brand-100)] active:bg-[var(--brand-100)]"
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          Leer reglamento completo
        </a>
        <p className="mt-2 text-center text-xs text-[var(--slate-500)]">
          Se abre en una pestaña nueva. Lee el documento antes de firmar.
        </p>
      </div>

      {/* Acceptance card */}
      <Card>
        <div className="space-y-4">
          {/* touch target mínimo 44px — el label envuelve todo el bloque */}
          <label
            htmlFor="accept-regulation"
            className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl"
          >
            <input
              ref={checkboxRef}
              type="checkbox"
              id="accept-regulation"
              className="h-5 w-5 shrink-0 cursor-pointer rounded accent-[var(--brand-700)]"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span className="text-sm text-[var(--slate-700)]">
              He leído y acepto el reglamento del edificio
            </span>
          </label>

          <Button
            onClick={handleSign}
            disabled={!accepted || signing}
            className="w-full"
          >
            {signing ? "Firmando…" : "Firmar digitalmente"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
