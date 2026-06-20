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
  blue: { border: "#d6e6f3", bg: "#f5faff", text: "#2c648d" },
  green: { border: "#d6ede4", bg: "#f1fbf7", text: "#2f775f" },
  amber: { border: "#eee0c1", bg: "#fff8e8", text: "#936b24" },
  red: { border: "#f0d6d2", bg: "#fff6f4", text: "#9c4631" },
  slate: { border: "var(--slate-200)", bg: "var(--surface-soft)", text: "var(--slate-700)" },
};

export function StatTile({
  tone = "blue",
  label,
  value,
  className,
}: {
  tone?: StatTone;
  label: string;
  value: ReactNode;
  className?: string;
}) {
  const c = TONES[tone];
  return (
    <div
      className={cn("rounded-2xl border p-3", className)}
      style={{ borderColor: c.border, backgroundColor: c.bg }}
    >
      <p className="text-xs text-[var(--slate-500)]">{label}</p>
      <p className="mt-1 text-lg font-semibold" style={{ color: c.text }}>
        {value}
      </p>
    </div>
  );
}
