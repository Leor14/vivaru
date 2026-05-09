import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  helper,
  href,
  tone = "sky",
}: {
  label: string;
  value: string;
  helper?: string;
  href?: string;
  tone?: "sky" | "mint" | "peach" | "sand";
}) {
  const toneClass =
    tone === "mint"
      ? "bg-[linear-gradient(180deg,#f6fffc_0%,var(--mint-50)_100%)]"
      : tone === "peach"
        ? "bg-[linear-gradient(180deg,#fffdfb_0%,var(--peach-50)_100%)]"
        : tone === "sand"
          ? "bg-[linear-gradient(180deg,#fffef8_0%,var(--sand-50)_100%)]"
          : "bg-[linear-gradient(180deg,#f9fdff_0%,var(--sky-50)_100%)]";

  const content = (
    <Card className={`premium-card-hover soft-panel ${toneClass}`}>
      <CardDescription className="text-[var(--slate-700)]">{label}</CardDescription>
      <CardTitle className="kpi-value-fluid mt-2 font-semibold text-[var(--slate-900)]">{value}</CardTitle>
      {helper ? <p className="mt-1 text-xs text-[var(--slate-500)]">{helper}</p> : null}
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-200)]">
        {content}
      </Link>
    );
  }

  return (
    content
  );
}
