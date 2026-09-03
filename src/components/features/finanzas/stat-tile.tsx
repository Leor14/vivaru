import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Tarjeta-métrica (KPI) del módulo Financiero. Extraída de la tendencia de
 * cartera para que todos los tableros muestren los KPIs con la misma paleta
 * pastel semántica. Los colores van inline porque Tailwind v4 no genera clases
 * arbitrarias construidas en runtime; las clases estructurales sí son Tailwind.
 * Ver chart-theme.ts para la firma de los gráficos.
 */

export type StatTone = "blue" | "green" | "amber" | "red" | "slate";

const TONES: Record<StatTone, { border: string; bg: string; text: string }> = {
  blue: { border: "var(--mapa-azul-borde-6)", bg: "var(--mapa-neutro-superficie-8)", text: "var(--mapa-azul-texto-3)" },
  green: { border: "var(--mapa-verde-borde-4)", bg: "var(--mapa-neutro-superficie-7)", text: "var(--mapa-verde-texto-4)" },
  amber: { border: "var(--mapa-verde-borde-6)", bg: "var(--mapa-verde-superficie-6)", text: "var(--mapa-ambar-texto-6)" },
  red: { border: "var(--mapa-rojo-borde-2)", bg: "var(--mapa-neutro-superficie-9)", text: "var(--mapa-ambar-texto-7)" },
  slate: { border: "var(--slate-200)", bg: "var(--surface-soft)", text: "var(--slate-700)" },
};

export function StatTile({
  tone = "blue",
  label,
  value,
  scope,
  className,
}: {
  tone?: StatTone;
  label: string;
  value: ReactNode;
  /**
   * **La ventana que mide el indicador, bajo el rótulo.**
   *
   * El «% recaudo» de esta pantalla mide el rango elegido —hasta doce períodos— y el del Panel
   * de Control mide UN MES, con el mismo rótulo y a un clic de distancia. El 30 de agosto de
   * 2026 los siete conjuntos de producción daban dos cifras distintas del mismo concepto.
   * Se resuelve nombrando cada ventana, no fusionando las dos: son preguntas legítimas y
   * distintas —«cómo va este mes» y «cómo va el histórico»—.
   */
  scope?: string;
  className?: string;
}) {
  const c = TONES[tone];
  return (
    <div
      className={cn("rounded-2xl border p-3", className)}
      style={{ borderColor: c.border, backgroundColor: c.bg }}
    >
      <p className="text-xs text-[var(--slate-500)]">{label}</p>
      {scope ? <p className="text-[11px] leading-tight text-[var(--slate-500)]">{scope}</p> : null}
      <p className="mt-1 text-lg font-semibold" style={{ color: c.text }}>
        {value}
      </p>
    </div>
  );
}
