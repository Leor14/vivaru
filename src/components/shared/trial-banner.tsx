"use client";

import { useState } from "react";
import { ArrowRight, Clock, Sparkles } from "lucide-react";

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
    ? { bg: "var(--mapa-neutro-superficie-2)", border: "var(--mapa-rojo-borde-1)", text: "var(--mapa-rojo-texto-1)" }
    : days <= 3
      ? { bg: "var(--mapa-neutro-superficie-2)", border: "var(--mapa-rojo-borde-1)", text: "var(--mapa-rojo-texto-1)" }
      : days <= 7
        ? { bg: "var(--mapa-verde-superficie-2)", border: "var(--mapa-verde-borde-5)", text: "var(--mapa-ambar-texto-1)" }
        : { bg: "var(--mapa-neutro-superficie-1)", border: "var(--mapa-azul-borde-5)", text: "var(--mapa-azul-texto-1)" };

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
      {/* El CTA es sólido y no un contorno tenue: es la única acción comercial
          del portal y competía en peso con el texto informativo de al lado.
          Con fondo de marca gana jerarquía sin gritar. */}
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="group inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--relleno-marca)] px-4 py-2 text-xs font-semibold text-[var(--on-fill)] shadow-[var(--sombra-marca-baja-1)] [transition:background-color_180ms_var(--ease-out),transform_140ms_var(--ease-out),box-shadow_180ms_var(--ease-out)] hover:bg-[var(--relleno-marca-hover)] hover:shadow-[var(--sombra-marca-media-1)] active:scale-[0.97] motion-reduce:transform-none"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Inicia tu suscripción
        <ArrowRight
          className="h-3.5 w-3.5 [transition-property:transform] duration-200 ease-[var(--ease-out)] group-hover:translate-x-0.5 motion-reduce:transform-none"
          aria-hidden
        />
      </button>
      <AdvisorRequestDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        motivoInicial={expired ? "contratar" : "contratar"}
      />
    </div>
  );
}
