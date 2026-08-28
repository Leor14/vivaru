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
    shell: "from-[#f4f9ff] to-[#e7f2ff] border-[#cddff2]",
    dot: "bg-[#3d7ea6]",
    insight: "text-[#2a5f83]",
  },
  success: {
    shell: "from-[#f3fdf8] to-[#e6f8f0] border-[#cde8da]",
    dot: "bg-[#378b6d]",
    insight: "text-[#2b6f58]",
  },
  pending: {
    shell: "from-[#fffbee] to-[#fff4d8] border-[#f1dfad]",
    dot: "bg-[#b5862f]",
    insight: "text-[#8a641f]",
  },
  alert: {
    shell: "from-[#fff6f3] to-[#ffece7] border-[#f4d0c7]",
    dot: "bg-[#bd5a4a]",
    insight: "text-[#9e4436]",
  },
  neutral: {
    shell: "from-[#f7f9fc] to-[#edf2f8] border-[#d6e0eb]",
    dot: "bg-[#63788d]",
    insight: "text-[#4e6378]",
  },
};

export function ExecutiveKpiCard({
  label,
  value,
  insight,
  tone = "neutral",
  href,
  help,
}: {
  label: string;
  value: string;
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
      <p className="kpi-value-fluid kpi-value-fluid-xl mt-3 font-semibold text-[var(--slate-900)]">{value}</p>
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
