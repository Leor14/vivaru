import Link from "next/link";

import { HelpTip } from "@/components/shared/help-tip";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type KpiTone = "finance" | "success" | "pending" | "alert" | "neutral";

/**
 * El texto de apoyo de cada tono tiene que leerse sobre SU tarjeta, y la tarjeta
 * es un degradado: el caso peor es el extremo `to-[...]`, que es el mas oscuro.
 *
 * `pending` daba 4,39:1 —por debajo del minimo AA— y era anterior a cualquier
 * cambio de este frente. Con #8a641f da 4,89. Los otros cuatro ya cumplian.
 *
 * `tests/tonos-del-tablero.test.ts` CALCULA los cinco leyendo este mismo mapa:
 * añadir un tono o retocar un color enrojece con la cifra delante.
 */
const TONE_STYLES: Record<KpiTone, { shell: string; dot: string; insight: string }> = {
  finance: {
    shell: "from-[var(--tono-finance-panel-desde)] to-[var(--tono-finance-panel-hasta)] border-[var(--tono-finance-panel-borde)]",
    dot: "bg-[var(--tono-finance-punto)]",
    insight: "text-[var(--tono-finance-apunte)]",
  },
  success: {
    shell: "from-[var(--tono-success-panel-desde)] to-[var(--tono-success-panel-hasta)] border-[var(--tono-success-panel-borde)]",
    dot: "bg-[var(--tono-success-punto)]",
    insight: "text-[var(--tono-success-apunte)]",
  },
  pending: {
    shell: "from-[var(--tono-pending-panel-desde)] to-[var(--tono-pending-panel-hasta)] border-[var(--tono-pending-panel-borde)]",
    dot: "bg-[var(--tono-pending-punto)]",
    insight: "text-[var(--tono-pending-apunte)]",
  },
  alert: {
    shell: "from-[var(--tono-alert-panel-desde)] to-[var(--tono-alert-panel-hasta)] border-[var(--tono-alert-panel-borde)]",
    dot: "bg-[var(--tono-alert-punto)]",
    insight: "text-[var(--tono-alert-apunte)]",
  },
  neutral: {
    shell: "from-[var(--tono-neutral-panel-desde)] to-[var(--tono-neutral-panel-hasta)] border-[var(--tono-neutral-panel-borde)]",
    dot: "bg-[var(--tono-neutral-punto)]",
    insight: "text-[var(--tono-neutral-apunte)]",
  },
};

export function ExecutiveKpiCard({
  label,
  value,
  scope,
  insight,
  tone = "neutral",
  href,
  help,
}: {
  label: string;
  value: string;
  /**
   * **La ventana que mide el indicador, bajo el rótulo.**
   *
   * Existe porque el mismo rótulo —«% recaudo»— vivía en esta tarjeta midiendo UN MES y en
   * Cartera midiendo hasta DOCE PERÍODOS, y ninguno de los dos lo decía. Un rótulo que no
   * nombra su ventana no es ambiguo: es una afirmación distinta según quién la lea.
   */
  scope?: string;
  insight: string;
  tone?: KpiTone;
  href?: string;
  help?: string;
}) {
  const content = (
    <Card className={cn("premium-card-hover bg-gradient-to-b p-4 sm:p-5", TONE_STYLES[tone].shell)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-[var(--slate-700)]">{label}</p>
          {help ? <HelpTip text={help} side="bottom" /> : null}
        </div>
        <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", TONE_STYLES[tone].dot)} aria-hidden />
      </div>
      {scope ? <p className="mt-0.5 text-[11px] leading-tight text-[var(--slate-500)]">{scope}</p> : null}
      <p className="kpi-value-fluid kpi-value-fluid-xl mt-2 font-semibold text-[var(--slate-900)]">{value}</p>
      <p className={cn("mt-1 text-xs font-medium", TONE_STYLES[tone].insight)}>{insight}</p>
    </Card>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-200)]"
    >
      {content}
      <span className="sr-only">Ver detalle de {label}</span>
    </Link>
  );
}
