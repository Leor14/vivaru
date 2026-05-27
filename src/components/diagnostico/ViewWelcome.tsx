"use client";

import { Button } from "@/components/marketing/ui/button";
import { Clock4, FileBarChart, ShieldCheck } from "lucide-react";

export function ViewWelcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-blue">
        Diagnóstico gratuito
      </span>
      <h1 className="mt-md font-display text-h1 text-navy text-balance md:text-[56px] md:leading-[1.05]">
        ¿Qué tan operativamente maduro es tu conjunto?
      </h1>
      <p className="mx-auto mt-md max-w-xl text-base leading-relaxed text-slate-600">
        9 preguntas. 4 minutos. Recibes un reporte personalizado con tu score
        de madurez digital, recomendaciones por pilar de dolor y el plan
        Vivaru que mejor se ajusta a tu portafolio.
      </p>

      <ul className="mt-xl grid w-full max-w-2xl gap-md sm:grid-cols-3">
        <FeatureLi
          icon={<Clock4 className="h-5 w-5" />}
          title="4 minutos"
          desc="9 preguntas guiadas"
        />
        <FeatureLi
          icon={<FileBarChart className="h-5 w-5" />}
          title="Reporte personalizado"
          desc="Score + recomendaciones"
        />
        <FeatureLi
          icon={<ShieldCheck className="h-5 w-5" />}
          title="100% confidencial"
          desc="LFPDPPP / Ley 1581 de 2012"
        />
      </ul>

      <Button
        size="xl"
        className="mt-xl w-full max-w-sm"
        onClick={onStart}
        type="button"
      >
        Comenzar diagnóstico →
      </Button>

      <p className="mt-md text-xs text-slate-500">
        Sin tarjeta de crédito. Sin compromiso. Solo claridad operativa.
      </p>
    </div>
  );
}

function FeatureLi({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <li className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-md text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
        {icon}
      </span>
      <span className="text-sm font-semibold text-navy">{title}</span>
      <span className="text-xs text-slate-500">{desc}</span>
    </li>
  );
}
