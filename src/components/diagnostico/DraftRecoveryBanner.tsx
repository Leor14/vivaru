"use client";

import { Clock4 } from "lucide-react";
import { Button } from "@/components/marketing/ui/button";

type Props = {
  step: number;
  onResume: () => void;
  onDiscard: () => void;
};

export function DraftRecoveryBanner({ step, onResume, onDiscard }: Props) {
  return (
    <aside
      role="status"
      className="mx-auto mt-md flex w-full max-w-2xl flex-col gap-3 rounded-xl border-2 border-brand-amber/40 bg-brand-amber/5 p-md sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-amber/15 text-brand-amber">
          <Clock4 className="h-4 w-4" />
        </span>
        <div className="flex flex-col">
          <strong className="text-sm font-semibold text-navy">
            Tienes un diagnóstico a medias
          </strong>
          <span className="text-xs text-slate-600">
            Te quedaste en la pregunta {step}. ¿Continuamos donde lo dejaste?
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 self-stretch sm:self-auto">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDiscard}
          className="flex-1 sm:flex-none"
        >
          Empezar de cero
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onResume}
          className="flex-1 sm:flex-none"
        >
          Continuar
        </Button>
      </div>
    </aside>
  );
}
