"use client";

import { useState } from "react";
import { Clock } from "lucide-react";

import { AdvisorRequestDialog } from "@/components/shared/advisor-request-dialog";
import type { TenantTrialState } from "@/features/tenant/use-tenant-trial";

/**
 * Banda de vigencia de la prueba, siempre visible dentro del portal.
 *
 * Cumple dos funciones del plan a la vez: recordar cuántos días quedan (el
 * usuario pidió que se viera "todas las veces que entra") y tener el CTA de
 * asesor permanentemente a la mano. Nunca dice "elige un plan" ni "pagar": no
 * hay catálogo de precios, la conversión siempre pasa por una persona.
 */

export function TrialBanner({ trial }: { trial: TenantTrialState }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  if (trial.loading) return null;
  if (!trial.isTrial && !trial.isExpired) return null;

  const days = trial.daysLeft ?? 0;
  const expired = trial.isExpired || days < 0;

  // Semáforo: se vuelve urgente conforme se acaba la prueba.
  const tone = expired
    ? { bg: "#FCEBEB", border: "#e2b6b6", text: "#791F1F" }
    : days <= 3
      ? { bg: "#FCEBEB", border: "#e2b6b6", text: "#791F1F" }
      : days <= 7
        ? { bg: "#FAEEDA", border: "#e8d3a8", text: "#633806" }
        : { bg: "#E6F1FB", border: "#bcd9f2", text: "#0C447C" };

  const message = expired
    ? "Tu período de prueba terminó. Tus datos siguen aquí: puedes consultarlos, y al contratar se reactiva todo tal como lo dejaste."
    : days === 0
      ? "Hoy es el último día de tu prueba."
      : `Te ${days === 1 ? "queda" : "quedan"} ${days} día${days === 1 ? "" : "s"} de prueba.`;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2 text-sm"
      style={{ backgroundColor: tone.bg, borderColor: tone.border, color: tone.text }}
    >
      <span className="inline-flex items-center gap-2">
        <Clock className="h-4 w-4 flex-shrink-0" aria-hidden />
        <span>{message}</span>
      </span>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="inline-flex shrink-0 items-center rounded-lg border px-3 py-1 text-xs font-semibold hover:opacity-80"
        style={{ borderColor: tone.text, color: tone.text }}
      >
        Hablar con un asesor
      </button>
      <AdvisorRequestDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        motivoInicial={expired ? "contratar" : "contratar"}
      />
    </div>
  );
}
