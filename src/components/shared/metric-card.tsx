import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tone = "sky" | "mint" | "peach" | "sand";

/**
 * semantic overrides tone when set.
 * - "overdue"  → red tint  (billing vencido, deuda urgente)
 * - "pending"  → amber tint (billing pendiente por pagar)
 * - "clear"    → emerald tint (al día, sin deuda)
 * - undefined  → uses tone prop
 */
type Semantic = "overdue" | "pending" | "clear";

// ─── Color maps ───────────────────────────────────────────────────────────────

const TONE_BG: Record<Tone, string> = {
  sky:   "bg-[var(--degradado-metrica-sky)]",
  mint:  "bg-[var(--degradado-metrica-mint)]",
  peach: "bg-[var(--degradado-metrica-peach)]",
  sand:  "bg-[var(--degradado-metrica-sand)]",
};

const SEMANTIC_BG: Record<Semantic, string> = {
  overdue: "bg-[var(--degradado-metrica-vencido)] !border-[var(--danger-200)]",
  pending: "bg-[var(--degradado-metrica-pendiente)] !border-[var(--amber-200)]",
  clear:   "bg-[var(--degradado-metrica-aldia)] !border-[var(--success-200)]",
};

const SEMANTIC_VALUE_COLOR: Record<Semantic, string> = {
  overdue: "text-[var(--danger-700)]",
  pending: "text-[var(--amber-700)]",
  clear:   "text-[var(--success-700)]",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function MetricCard({
  label,
  value,
  helper,
  href,
  tone = "sky",
  semantic,
}: {
  label: string;
  value: string;
  helper?: string;
  href?: string;
  tone?: Tone;
  /** Overrides tone with semantic status coloring (overdue/pending/clear). */
  semantic?: Semantic;
}) {
  const bgClass    = semantic ? SEMANTIC_BG[semantic]        : TONE_BG[tone];
  const valueColor = semantic ? SEMANTIC_VALUE_COLOR[semantic] : "text-[var(--slate-900)]";

  const content = (
    <Card className={`premium-card-hover soft-panel ${bgClass}`}>
      <CardDescription className="text-[var(--slate-700)]">{label}</CardDescription>
      <CardTitle className={`kpi-value-fluid mt-2 font-semibold ${valueColor}`}>
        {value}
      </CardTitle>
      {helper ? <p className="mt-1 text-xs text-[var(--slate-500)]">{helper}</p> : null}
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-200)]"
      >
        {content}
      </Link>
    );
  }

  return content;
}
