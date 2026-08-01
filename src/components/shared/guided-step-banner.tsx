"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Lightbulb, ListChecks, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getIconTone } from "@/lib/ui/icon-tones";
import { useAuth } from "@/features/auth/auth-context";
import { runGuidedAction, useHasGuidedAction } from "@/features/onboarding/guided-action";
import { useGuidedNavigation } from "@/features/onboarding/route-transition";
import { markStepSeen } from "@/features/onboarding/services";
import { useOnboardingProgress } from "@/features/onboarding/use-onboarding-progress";
import { useTenantTrial } from "@/features/tenant/use-tenant-trial";
import {
  GUIDE_PARAM,
  blocksForTrack,
  hrefFor,
  nextStepAfter,
  positionInBlock,
  stepByKey,
  type OnboardingStep,
  type OnboardingTrack,
} from "@/lib/onboarding/steps";

/**
 * La ayuda que aparece **al llegar** a la pantalla desde el recorrido guiado.
 *
 * Es la mitad que le falta a cualquier checklist: llevar al usuario al lugar
 * correcto no sirve de nada si al llegar no sabe qué hacer ahí. Por eso la banda
 * explica para qué sirve el módulo y da el paso a paso concreto —dónde está el
 * botón, qué se escribe— en el momento y el lugar donde hace falta.
 *
 * Solo aparece si se llegó con `?guia=<paso>`. Quien entra a Comunicaciones por
 * su cuenta no ve nada: la guía acompaña, no invade.
 *
 * Cuando el paso queda hecho, la banda no desaparece — se transforma en el
 * enlace al paso siguiente. Ese es el momento donde se pierde la gente: termina
 * la tarea y se queda sin saber a dónde ir.
 */
export function GuidedStepBanner() {
  const params = useSearchParams();
  const { user } = useAuth();
  const trial = useTenantTrial(user?.tenantId);
  const track = trial.onboardingTrack;
  const step = stepByKey(params.get(GUIDE_PARAM), track ?? "trial");
  if (!track || !step) return null;
  return <GuidedStepBannerInner step={step} track={track} />;
}

function GuidedStepBannerInner({ step, track }: { step: OnboardingStep; track: OnboardingTrack }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const progress = useOnboardingProgress(user?.tenantId, track);
  const hasAction = useHasGuidedAction(step.key);
  const navigate = useGuidedNavigation();
  const [confirming, setConfirming] = useState(false);

  const tenantId = user?.tenantId;
  const done = progress.isDone(step.key);
  const block = blocksForTrack(track).find((item) => item.key === step.block);
  const { index, total } = positionInBlock(step, track);
  const tone = getIconTone(step.tone);
  const StepIcon = step.icon;

  /**
   * Los pasos de descubrimiento se completan con recorrerlos: el objetivo del
   * bloque es que sepa que el módulo existe y para qué, no cargarle más tareas.
   * Se esperan unos segundos a propósito — rebotar no es haber conocido nada.
   */
  const alreadySeen = Boolean(progress.seen[step.key]);
  const progressLoading = progress.loading;
  useEffect(() => {
    if (!tenantId || step.block !== "descubre") return;
    if (progressLoading || alreadySeen) return;
    const timer = setTimeout(() => void markStepSeen(tenantId, step.key), 4000);
    return () => clearTimeout(timer);
  }, [tenantId, step.key, step.block, progressLoading, alreadySeen]);

  const next = nextStepAfter(step, progress.isDone, track);

  function dismiss() {
    router.replace(pathname, { scroll: false });
  }

  async function confirmSeen() {
    if (!tenantId) return;
    setConfirming(true);
    await markStepSeen(tenantId, step.key);
    setConfirming(false);
  }

  /**
   * Recorrer un portal no deja rastro en los datos, así que hace falta que el
   * admin lo confirme. Se le pide solo en los pasos de activación: en el bloque
   * de descubrimiento un botón más sería fricción sin valor.
   */
  const needsConfirm = step.block === "prueba" && step.signal.kind === "seen" && !done;

  return (
    <section
      aria-label={`Guía: ${step.title}`}
      className="mb-4 rounded-2xl border border-[var(--brand-200)]/70 bg-gradient-to-br from-white via-[var(--brand-50)]/70 to-[var(--sky-50)] px-4 py-4 shadow-[0_4px_16px_rgba(12,33,53,0.05)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
            style={{
              backgroundColor: done ? "#dcfce7" : tone.mutedBg,
              color: done ? "#15803d" : tone.mutedFg,
            }}
            aria-hidden
          >
            {done ? <CheckCircle2 className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[var(--brand-700)]">
              <span className="inline-flex items-center gap-1 rounded-lg bg-white/70 px-2 py-0.5">
                <ListChecks className="h-3.5 w-3.5" aria-hidden />
                Guía de puesta en marcha
              </span>
              <span className="text-[var(--slate-500)]">
                Paso {index} de {total}
                {block ? ` · ${block.title}` : ""}
              </span>
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--brand-900)]">
              {step.title}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar la guía de este paso"
          className="shrink-0 rounded-lg p-1 text-[var(--brand-700)] [transition:background-color_150ms_var(--ease-out),transform_140ms_var(--ease-out)] hover:bg-white/80 active:scale-95"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {done ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-[var(--slate-700)]">
            Listo, este paso ya está hecho.{" "}
            {next ? "Cuando quieras, sigue con el siguiente." : "Completaste el recorrido."}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {next ? (
              <Button size="sm" onClick={() => navigate(hrefFor(next))}>
                Siguiente: {next.title}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => navigate("/admin")}>
              Volver a la guía
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-700)]">
                Para qué sirve
              </dt>
              <dd className="mt-1 text-sm text-[var(--slate-700)]">{step.purpose}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-700)]">
                Cómo se hace
              </dt>
              <dd className="mt-1 text-sm text-[var(--slate-700)]">{step.how}</dd>
            </div>
          </dl>

          {step.tip ? (
            <p className="flex items-start gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm text-[var(--slate-700)]">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-700)]" aria-hidden />
              <span>{step.tip}</span>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {step.action && hasAction ? (
              <Button size="sm" onClick={() => runGuidedAction(step.key, track)}>
                {step.action.label}
              </Button>
            ) : null}
            {needsConfirm ? (
              <Button size="sm" onClick={() => void confirmSeen()} disabled={confirming}>
                {confirming ? "Guardando…" : "Ya lo recorrí"}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => navigate("/admin")}>
              Volver a la guía
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
