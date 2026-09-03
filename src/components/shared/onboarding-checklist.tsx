"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Compass, Lock } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { useGuidedNavigation } from "@/features/onboarding/route-transition";
import { saveOnboardingSummary } from "@/features/onboarding/services";
import { useOnboardingProgress } from "@/features/onboarding/use-onboarding-progress";
import { useTenantTrial } from "@/features/tenant/use-tenant-trial";
import { isModuleLocked } from "@/lib/config/trial-modules";
import {
  activationStepsFor,
  blocksForTrack,
  discoveryStepsFor,
  hrefFor,
  stepsForTrack,
  type OnboardingStep,
  type OnboardingTrack,
} from "@/lib/onboarding/steps";
import { getIconTone } from "@/lib/ui/icon-tones";
import { cn } from "@/lib/utils/cn";

/**
 * El punto de partida del administrador que acaba de entrar a su ambiente.
 *
 * Se eligió checklist y no un tour con spotlight: el tour se ve bien en una
 * demo pero se salta una vez y nunca vuelve, se rompe cada vez que se mueve un
 * botón, e interrumpe. El checklist **persiste** —quien se va y vuelve a los
 * tres días retoma donde quedó— y además mide activación.
 *
 * Cada fila lleva a su pantalla con `?guia=<paso>`, que es lo que hace aparecer
 * la explicación al llegar (ver `guided-step-banner.tsx`). Sin esa segunda
 * mitad, el checklist sería un marcador y el usuario se perdería al aterrizar.
 */

const COLLAPSE_KEY = "vivaru:onboarding-checklist:collapsed";

export function OnboardingChecklist() {
  const { user } = useAuth();
  const trial = useTenantTrial(user?.tenantId);
  // Solo se suscribe a las colecciones si el ambiente es de prueba: en un
  // cliente ya contratado la guía no se muestra y no vale pagar los listeners.
  // La compuerta: sin recorrido asignado, la guía no existe. Ver
  // `onboardingTrack` en use-tenant-trial.ts para por qué es asimétrica.
  const track = trial.onboardingTrack;
  const progress = useOnboardingProgress(
    track ? user?.tenantId : undefined,
    track ?? "trial",
  );
  const activationTotal = activationStepsFor(track ?? "trial").length;
  const discoveryTotal = discoveryStepsFor(track ?? "trial").length;
  const [collapsed, setCollapsed] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch {
      // Sin localStorage (modo privado): se queda abierto.
    }
  }, []);

  // Solo en pruebas: en un cliente ya contratado el hook no se suscribe a nada
  // y publicar su "0 de 7" ensuciaría la consola comercial con un dato falso.
  const tenantId = track ? user?.tenantId : undefined;
  const { activationDone, discoveryDone, loading: progressLoading } = progress;

  // El avance se deja contado en el documento del ambiente para que la consola
  // comercial no tenga que recalcularlo por tenant. Ver `saveOnboardingSummary`.
  useEffect(() => {
    if (!tenantId || progressLoading) return;
    void saveOnboardingSummary({
      tenantId,
      activationDone,
      activationTotal,
      discoveryDone,
      discoveryTotal,
    });
  }, [tenantId, progressLoading, activationDone, discoveryDone, activationTotal, discoveryTotal]);

  // La guía acompaña la evaluación del producto. Un cliente ya contratado tiene
  // acompañamiento humano y no necesita que le ocupemos el tablero.
  if (!track) return null;
  if (trial.loading || progress.loading) return null;

  const activationComplete = progress.activationDone >= activationTotal;
  // Terminado el recorrido completo, la guía deja de ocupar el tablero.
  if (activationComplete && progress.discoveryDone >= discoveryTotal) return null;

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // Sin persistencia: el toggle igual funciona en esta sesión.
      }
      return next;
    });
  }

  return (
    <Card className="mb-4 border-[var(--brand-200)]/70 bg-gradient-to-br from-[var(--surface-strong)] via-[var(--brand-50)]/60 to-[var(--sky-50)] p-5">
      <div className="flex items-start gap-4">
        <ProgressRing done={progress.activationDone} total={activationTotal} />

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[var(--brand-900)]">
                <Compass className="h-4.5 w-4.5 shrink-0 text-[var(--brand-700)]" aria-hidden />
                {activationComplete ? "Tu conjunto ya está en marcha" : "Pon tu conjunto en marcha"}
              </h2>
              <p className="mt-1 text-sm text-[var(--slate-600)]">
                {activationComplete
                  ? "Ahora recorre el resto del producto: cada módulo se explica al entrar."
                  : "Cada paso te lleva a su pantalla y te explica ahí mismo cómo se hace."}
              </p>
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-expanded={!collapsed}
              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--brand-700)] [transition:background-color_150ms_var(--ease-out)] hover:bg-[var(--surface-strong)]/70"
            >
              {collapsed ? "Ver la guía" : "Ocultar"}
              <ChevronDown
                className={cn(
                  "h-4 w-4 [transition-property:transform] duration-200 ease-[var(--ease-out)]",
                  collapsed ? "" : "rotate-180",
                )}
                aria-hidden
              />
            </button>
          </div>
        </div>
      </div>

      {collapsed ? null : (
        <div className="mt-5 space-y-5">
          {blocksForTrack(track).map((block) => {
            const steps = stepsForTrack(track).filter((step) => step.block === block.key);
            const isDiscovery = block.key === "descubre";
            // El bloque de descubrimiento arranca plegado: quince filas de golpe
            // se leen como tarea escolar, y lo urgente son los siete primeros.
            const open = !isDiscovery || showDiscovery;

            return (
              <section key={block.key}>
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="min-w-0">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-700)]">
                      {block.title}
                    </h3>
                    <p className="text-xs text-[var(--slate-500)]">{block.description}</p>
                  </div>
                  {isDiscovery ? (
                    <button
                      type="button"
                      onClick={() => setShowDiscovery((prev) => !prev)}
                      aria-expanded={showDiscovery}
                      className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--brand-700)] [transition:background-color_150ms_var(--ease-out)] hover:bg-[var(--surface-strong)]/70"
                    >
                      {showDiscovery
                        ? "Ocultar"
                        : `Ver los ${discoveryTotal} módulos (${progress.discoveryDone} recorridos)`}
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 [transition-property:transform] duration-200 ease-[var(--ease-out)]",
                          showDiscovery ? "rotate-180" : "",
                        )}
                        aria-hidden
                      />
                    </button>
                  ) : null}
                </div>

                {open ? (
                  <ul className="mt-2 space-y-1.5">
                    {steps.map((step, indexInBlock) => (
                      <ChecklistRow
                        key={step.key}
                        step={step}
                        /* El escalonado se reinicia en cada bloque: con un
                           contador corrido, la última fila esperaría medio
                           segundo y el retraso se notaría como pereza. */
                        index={indexInBlock}
                        done={progress.isDone(step.key)}
                        locked={Boolean(step.module && isModuleLocked(trial.status, step.module))}
                      />
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/**
 * Anillo de avance. Se prefirió a una barra porque comunica "cuánto falta" de
 * un vistazo y sostiene el número dentro, sin robar una línea entera del ancho.
 */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? Math.min(done / total, 1) : 0;
  const complete = done >= total;

  return (
    <div
      className="relative grid h-16 w-16 shrink-0 place-items-center"
      role="progressbar"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label="Progreso de la puesta en marcha"
    >
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--brand-200)" strokeWidth="5" opacity="0.6" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={complete ? "var(--color-brand-green-succ, #16a34a)" : "var(--brand-700)"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          style={{ transition: "stroke-dashoffset 420ms var(--ease-out), stroke 200ms ease" }}
        />
      </svg>
      <span className="relative text-center leading-none">
        <span className="block text-base font-semibold text-[var(--brand-900)]">{done}</span>
        <span className="block text-[10px] font-medium text-[var(--slate-500)]">de {total}</span>
      </span>
    </div>
  );
}

function ChecklistRow({
  step,
  index,
  done,
  locked,
}: {
  step: OnboardingStep;
  index: number;
  done: boolean;
  locked: boolean;
}) {
  const navigate = useGuidedNavigation();
  const href = hrefFor(step);
  const tone = getIconTone(step.tone);
  const Icon = step.icon;

  return (
    <li className="onboarding-step" style={{ "--step-index": index } as React.CSSProperties}>
      <Link
        href={href}
        onClick={(event) => {
          // Solo se intercepta el clic simple: ctrl/cmd, rueda o "abrir en
          // pestaña nueva" siguen funcionando como en cualquier enlace.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          navigate(href);
        }}
        className={cn(
          "group flex items-center gap-3 rounded-2xl border bg-[var(--surface-strong)]/70 px-3 py-2.5",
          "[transition:background-color_180ms_var(--ease-out),border-color_180ms_var(--ease-out),box-shadow_180ms_var(--ease-out),transform_140ms_var(--ease-out)]",
          "active:scale-[0.99]",
          done
            ? "border-transparent bg-[var(--surface-strong)]/40"
            : "border-[var(--slate-200)]/70 hover:border-[var(--brand-200)] hover:bg-[var(--surface-strong)] hover:shadow-[0_4px_14px_rgba(12,33,53,0.06)]",
        )}
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl [transition:opacity_180ms_var(--ease-out)]"
          style={{
            backgroundColor: done ? "var(--slate-100)" : tone.mutedBg,
            color: done ? "var(--slate-400)" : tone.mutedFg,
          }}
          aria-hidden
        >
          <Icon className="h-4.5 w-4.5" />
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium",
              done ? "text-[var(--slate-500)]" : "text-[var(--slate-900)]",
            )}
          >
            {step.title}
            {locked ? (
              // El candado comunica estado, no adorna: se queda en slate-500
              // porque slate-400 (2.8:1) no llega al 3:1 de WCAG 1.4.11.
              <Lock className="h-3 w-3 shrink-0 text-[var(--slate-500)]" aria-label="En vista previa" />
            ) : null}
          </span>
          {done ? null : <span className="block text-xs text-[var(--slate-600)]">{step.why}</span>}
        </span>

        <CompletionIndicator done={done} />
      </Link>
    </li>
  );
}

/**
 * Estado del paso, a la derecha de la fila. Hecho: sello verde con la palomita.
 * Pendiente: la flecha, que además se desplaza al pasar el cursor para insinuar
 * hacia dónde lleva.
 */
function CompletionIndicator({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--success-50)] py-1 pl-1.5 pr-2.5 text-[11px] font-semibold text-[var(--success-700)]">
        <span className="grid h-4 w-4 place-items-center rounded-full bg-[var(--relleno-exito)] text-[var(--on-fill)]">
          <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
        </span>
        Listo
      </span>
    );
  }

  return (
    <ChevronRight
      className="h-4 w-4 shrink-0 text-[var(--slate-400)] [transition:transform_180ms_var(--ease-out),color_180ms_var(--ease-out)] group-hover:translate-x-0.5 group-hover:text-[var(--brand-700)]"
      aria-hidden
    />
  );
}
