"use client";

type Props = {
  current: number;
  total: number;
};

export function ProgressBar({ current, total }: Props) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
        <span>
          Pregunta {current} de {total}
        </span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Progreso del diagnóstico"
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className="h-full rounded-full bg-brand-blue transition-[width] duration-400 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
