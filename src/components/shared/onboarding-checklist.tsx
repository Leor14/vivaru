"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Circle, Compass, Lock } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { saveOnboardingSummary } from "@/features/onboarding/services";
import { useOnboardingProgress } from "@/features/onboarding/use-onboarding-progress";
import { useTenantTrial } from "@/features/tenant/use-tenant-trial";
import { isModuleLocked } from "@/lib/config/trial-modules";
import {
  ACTIVATION_TOTAL,
  DISCOVERY_TOTAL,
  ONBOARDING_BLOCKS,
  ONBOARDING_STEPS,
  hrefFor,
  type OnboardingStep,
} from "@/lib/onboarding/steps";
import { cn } from "@/lib/utils/cn";

/**
 * El punto de partida del administrador que acaba de entrar a su ambiente.
 *
 * Se eligió checklist y no un tour con spotlight: el tour se ve bien en una
 * demo pero se salta una vez y nunca vuelve, se rompe cada vez que se mueve un
 * botón, e interrumpe. El checklist **persiste** —quien se va y vuelve a los
 * tres días retoma donde quedó— y además mide activación real.
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
  const progress = useOnboardingProgress(
    trial.isTrial || trial.isExpired ? user?.tenantId : undefined,
  );
  const [collapsed, setCollapsed] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch {
      // Sin localStorage (modo privado): se queda abierto.
    }
  }, []);

  // El avance se deja contado en el documento del ambiente para que la consola
  // comercial no tenga que recalcularlo por tenant. Ver `saveOnboardingSummary`.
  // Solo en pruebas: en un cliente ya contratado el hook no se suscribe a nada
  // y publicar su "0 de 7" ensuciaría la consola comercial con un dato falso.
  const tenantId = trial.isTrial || trial.isExpired ? user?.tenantId : undefined;
  const { activationDone, discoveryDone, loading: progressLoading } = progress;
  useEffect(() => {
    if (!tenantId || progressLoading) return;
    void saveOnboardingSummary({
      tenantId,
      activationDone,
      activationTotal: ACTIVATION_TOTAL,
      discoveryDone,
      discoveryTotal: DISCOVERY_TOTAL,
    });
  }, [tenantId, progressLoading, activationDone, discoveryDone]);

  // La guía acompaña la evaluación del producto. Un cliente ya contratado tiene
  // acompañamiento humano y no necesita que le ocupemos el tablero.
  if (!trial.isTrial && !trial.isExpired) return null;
  if (trial.loading || progress.loading) return null;

  const activationComplete = progress.activationDone >= ACTIVATION_TOTAL;
  // Terminado el recorrido completo, la guía deja de ocupar el tablero.
  if (activationComplete && progress.discoveryDone >= DISCOVERY_TOTAL) return null;

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

  const pct = Math.round((progress.activationDone / ACTIVATION_TOTAL) * 100);

  return (
    <Card className="mb-4 border-[var(--brand-200)] bg-[var(--brand-50)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--brand-900)]">
            <Compass className="h-4 w-4 shrink-0" aria-hidden />
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
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--brand-700)] hover:bg-[var(--brand-200)]/40"
        >
          {collapsed ? "Ver la guía" : "Ocultar"}
          <ChevronDown
            className={cn("h-4 w-4 [transition-property:transform] duration-200", collapsed ? "" : "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--brand-200)]/60"
          role="progressbar"
          aria-valuenow={progress.activationDone}
          aria-valuemin={0}
          aria-valuemax={ACTIVATION_TOTAL}
          aria-label="Progreso de la puesta en marcha"
        >
          <div
            className="h-full rounded-full bg-[var(--brand-700)] [transition-property:width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-semibold text-[var(--brand-800)]">
          {progress.activationDone} de {ACTIVATION_TOTAL}
        </span>
      </div>

      {collapsed ? null : (
        <div className="mt-4 space-y-4">
          {ONBOARDING_BLOCKS.map((block) => {
            const steps = ONBOARDING_STEPS.filter((step) => step.block === block.key);
            const isDiscovery = block.key === "descubre";
            // El bloque de descubrimiento arranca plegado: quince filas de golpe
            // se leen como tarea escolar, y lo urgente son los siete primeros.
            const open = !isDiscovery || showDiscovery;

            return (
              <section key={block.key}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-700)]">
                      {block.title}
                    </h3>
                    <p className="text-xs text-[var(--slate-600)]">{block.description}</p>
                  </div>
                  {isDiscovery ? (
                    <button
                      type="button"
                      onClick={() => setShowDiscovery((prev) => !prev)}
                      aria-expanded={showDiscovery}
                      className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--brand-700)] hover:bg-[var(--brand-200)]/40"
                    >
                      {showDiscovery
                        ? "Ocultar"
                        : `Ver los ${DISCOVERY_TOTAL} módulos (${progress.discoveryDone} recorridos)`}
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 [transition-property:transform] duration-200",
                          showDiscovery ? "rotate-180" : "",
                        )}
                        aria-hidden
                      />
                    </button>
                  ) : null}
                </div>

                {open ? (
                  <ul className="mt-2 space-y-1">
                    {steps.map((step) => (
                      <ChecklistRow
                        key={step.key}
                        step={step}
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

function ChecklistRow({
  step,
  done,
  locked,
}: {
  step: OnboardingStep;
  done: boolean;
  locked: boolean;
}) {
  return (
    <li>
      <Link
        href={hrefFor(step)}
        className="group flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-white/70"
      >
        <span
          className={cn(
            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border",
            done
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-[var(--brand-200)] bg-white text-transparent",
          )}
          aria-hidden
        >
          {done ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2" />}
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
              <Lock className="h-3 w-3 shrink-0 text-[var(--slate-400)]" aria-label="En vista previa" />
            ) : null}
          </span>
          {done ? null : <span className="block text-xs text-[var(--slate-600)]">{step.why}</span>}
        </span>
        <ChevronRight
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--slate-400)] group-hover:text-[var(--brand-700)]"
          aria-hidden
        />
      </Link>
    </li>
  );
}
