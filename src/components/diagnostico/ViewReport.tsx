"use client";

import * as React from "react";
import { Download, FileText, Lock } from "lucide-react";

import { Button } from "@/components/marketing/ui/button";
import { DemoDialog } from "@/components/marketing/DemoDialog";
import { Tooltip } from "@/components/marketing/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { getScoreCategory } from "@/lib/marketing/diagnostic-score";
import { RECOMMENDATIONS, TIER_LABELS } from "@/lib/marketing/diagnostic-recommendations";
import type { DiagnosticAnswers } from "@/lib/marketing/diagnostic-schema";

type Props = {
  score: number;
  answers: DiagnosticAnswers;
};

export function ViewReport({ score, answers }: Props) {
  const category = getScoreCategory(score);
  const rec = RECOMMENDATIONS[answers.q5_pilarDolor];
  const firstName = answers.q9_contacto.nombre.split(" ")[0];

  return (
    <article className="flex flex-col gap-xl">
      {/* Hero score */}
      <header className="flex flex-col items-center text-center">
        <span className="rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-blue">
          Tu reporte personalizado
        </span>
        <h2 className="mt-md font-display text-h2 text-navy text-balance md:text-[40px] md:leading-[1.1]">
          {firstName}, este es tu diagnóstico
        </h2>

        <div className="mt-xl flex flex-col items-center gap-3">
          <ScoreCircle score={score} categoryColor={category.color} />
          <p className={cn("font-display text-2xl font-semibold", category.color)}>
            {category.label}
          </p>
        </div>
      </header>

      {/* Recommendation card */}
      <section
        className={cn(
          "rounded-2xl border-2 bg-background p-lg shadow-brand-sm",
          rec.accentBorder,
        )}
      >
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className={cn("text-xs font-semibold uppercase tracking-widest", rec.accentText)}>
              Pilar prioritario · {labelFor(answers.q5_pilarDolor)}
            </p>
            <h3 className="mt-1 font-display text-h3 text-navy md:text-[28px] md:leading-[1.2]">
              {rec.title}
            </h3>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold",
              rec.accentBorder,
              rec.accentText,
            )}
          >
            Plan {TIER_LABELS[rec.recommendedTier]}
          </span>
        </header>

        <ul className="mt-md grid gap-2 sm:grid-cols-2">
          {rec.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-slate-700">
              <span
                aria-hidden="true"
                className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", rec.accentText.replace("text-", "bg-"))}
              />
              {b}
            </li>
          ))}
        </ul>

        <p className="mt-md rounded-lg bg-muted/50 p-3 text-sm font-medium text-navy">
          {rec.roiHook}
        </p>
      </section>

      {/* ROI pills */}
      <section className="grid gap-md sm:grid-cols-3">
        <RoiPill
          label="Morosidad reportada"
          value={`${answers.q6_morosidad}%`}
          hint="Punto de partida"
        />
        <RoiPill
          label="Horas manuales / semana"
          value={`${answers.q7_horasManuales}h`}
          hint="Tiempo recuperable"
        />
        <RoiPill
          label="Unidades en portafolio"
          value={answers.q2_unidades.toLocaleString("es-CO")}
          hint={`${labelConjuntos(answers.q1_conjuntos)} conjunto(s)`}
        />
      </section>

      {/* CTAs */}
      <section className="flex flex-col gap-md rounded-2xl border border-border bg-muted/30 p-lg sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-xl text-navy">
            Siguiente paso: una demo de 20 min
          </h3>
          <p className="text-sm text-slate-600">
            Sin presentación corporativa. Te mostramos {labelFor(answers.q5_pilarDolor)} resuelto.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <DemoDialog section="diagnostico_result">
            <Button size="xl">Agendar demo →</Button>
          </DemoDialog>

          <Tooltip label="Próximamente · te lo enviamos por correo" side="top">
            <Button
              type="button"
              variant="outline"
              size="xl"
              disabled
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Descargar PDF
              <Lock className="ml-1 h-3 w-3 text-slate-400" aria-hidden="true" />
            </Button>
          </Tooltip>
        </div>
      </section>

      <footer className="flex items-start gap-2 text-xs text-slate-500">
        <FileText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Te enviamos una copia de este reporte a{" "}
          <strong className="font-semibold text-slate-700">
            {answers.q9_contacto.email}
          </strong>
          . Si no llega en 5 minutos, revisa tu carpeta de promociones.
        </span>
      </footer>
    </article>
  );
}

function ScoreCircle({ score, categoryColor }: { score: number; categoryColor: string }) {
  const r = 72;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="relative h-44 w-44">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="80" cy="80" r={r} stroke="#E2E8F0" strokeWidth="10" fill="none" />
        <circle
          cx="80"
          cy="80"
          r={r}
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          className={categoryColor}
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-display text-[64px] leading-none tabular-nums", categoryColor)}>
          {score}
        </span>
        <span className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
          / 100
        </span>
      </div>
    </div>
  );
}

function RoiPill({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background p-md text-center">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className="font-display text-3xl text-navy tabular-nums">{value}</span>
      <span className="text-xs text-slate-500">{hint}</span>
    </div>
  );
}

function labelFor(pillar: DiagnosticAnswers["q5_pilarDolor"]): string {
  return {
    cartera: "cartera",
    comunicacion: "comunicación",
    porteria: "portería",
    gobernanza: "gobernanza",
  }[pillar];
}

function labelConjuntos(c: DiagnosticAnswers["q1_conjuntos"]): string {
  return { "1": "1", "2-5": "2–5", "6-15": "6–15", "16+": "16+" }[c];
}
