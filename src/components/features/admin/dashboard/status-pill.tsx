import { cn } from "@/lib/utils/cn";
import { getStatusLabel } from "@/utils/statusMapper";

type StatusTone = "finance" | "success" | "pending" | "alert" | "neutral";

const TONE_CLASS: Record<StatusTone, string> = {
  finance: "bg-[#eaf2fb] text-[#2d6187] border-[#c7dbef]",
  success: "bg-[#ebf8f2] text-[#2f725b] border-[#cbe6d9]",
  pending: "bg-[#fff7df] text-[#8a6626] border-[#ead8a3]",
  alert: "bg-[#ffeceb] text-[#9a4033] border-[#f2c8c1]",
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
