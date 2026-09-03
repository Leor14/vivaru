import { cn } from "@/lib/utils/cn";
import { getStatusLabel } from "@/utils/statusMapper";

type StatusTone = "finance" | "success" | "pending" | "alert" | "neutral";

const TONE_CLASS: Record<StatusTone, string> = {
  finance: "bg-[var(--tono-finance-fondo)] text-[var(--tono-finance-texto)] border-[var(--tono-finance-borde)]",
  success: "bg-[var(--tono-success-fondo)] text-[var(--tono-success-texto)] border-[var(--tono-success-borde)]",
  pending: "bg-[var(--tono-pending-fondo)] text-[var(--tono-pending-texto)] border-[var(--tono-pending-borde)]",
  alert: "bg-[var(--tono-alert-fondo)] text-[var(--tono-alert-texto)] border-[var(--tono-alert-borde)]",
  neutral: "bg-[var(--slate-100)] text-[var(--slate-700)] border-[var(--slate-200)]",
};

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: StatusTone;
}) {
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold", TONE_CLASS[tone])}>
      {getStatusLabel(label)}
    </span>
  );
}
