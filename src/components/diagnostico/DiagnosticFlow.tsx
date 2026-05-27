"use client";

import * as React from "react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import {
  Building2,
  Building,
  Hotel,
  Construction,
  Wallet,
  MessageSquare,
  ShieldCheck,
  ScrollText,
  Calendar,
  CalendarRange,
  CalendarDays,
  Search,
} from "lucide-react";

import { Button } from "@/components/marketing/ui/button";
import { track } from "@/lib/marketing/analytics";
import { useReducedMotion } from "@/lib/marketing/hooks";
import {
  diagnosticSchema,
  stepSchemas,
  type DiagnosticAnswers,
} from "@/lib/marketing/diagnostic-schema";

import { ProgressBar } from "./ProgressBar";
import { DraftRecoveryBanner } from "./DraftRecoveryBanner";
import { ViewWelcome } from "./ViewWelcome";
import { ViewQuestion } from "./ViewQuestion";
import { ViewContactForm } from "./ViewContactForm";
import { ViewReport } from "./ViewReport";
import { RadioCards } from "./controls/RadioCards";
import { CheckboxCards } from "./controls/CheckboxCards";
import { BigSlider } from "./controls/BigSlider";

/** Step indices map to the 11 views: 0 welcome → 9 contact → 10 report. */
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
const TOTAL_QUESTIONS = 9;
const DRAFT_KEY = "vivaru.diag.draft";

type Draft = {
  step: number;
  answers: Partial<DiagnosticAnswers>;
  savedAt: number;
};

const WEBMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "yahoo.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
]);

const DEFAULT_ANSWERS: Partial<DiagnosticAnswers> = {
  q3_tipoConjunto: [],
  q4_herramientas: [],
  q6_morosidad: 10,
  q7_horasManuales: 8,
  q2_unidades: 150,
};

export function DiagnosticFlow() {
  const [step, setStep] = React.useState<Step>(0);
  const [answers, setAnswers] = React.useState<Partial<DiagnosticAnswers>>(DEFAULT_ANSWERS);
  const [draftDetected, setDraftDetected] = React.useState<Draft | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [score, setScore] = React.useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  // --- Draft persistence ----------------------------------------------------
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Draft;
      if (parsed.step > 0 && parsed.step < 10) {
        setDraftDetected(parsed);
      }
    } catch {
      // Corrupt draft — ignore.
    }
  }, []);

  const saveDraft = React.useCallback(
    (nextStep: number, nextAnswers: Partial<DiagnosticAnswers>) => {
      try {
        const draft: Draft = { step: nextStep, answers: nextAnswers, savedAt: Date.now() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Quota / private mode — silent.
      }
    },
    [],
  );

  const clearDraft = React.useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  }, []);

  const resumeDraft = () => {
    if (!draftDetected) return;
    setAnswers({ ...DEFAULT_ANSWERS, ...draftDetected.answers });
    setStep(draftDetected.step as Step);
    setDraftDetected(null);
  };

  const discardDraft = () => {
    clearDraft();
    setDraftDetected(null);
  };

  // --- Navigation -----------------------------------------------------------
  const goTo = (nextStep: Step) => {
    setValidationError(null);
    setStep(nextStep);
  };

  const handleStart = () => {
    track("lead_magnet_start", {});
    goTo(1);
  };

  const validateCurrent = (): boolean => {
    if (step < 1 || step > 8) return true;
    const schema = stepSchemas[step as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8];
    const key = (`q${step}_${stepFieldName(step)}` as unknown) as keyof DiagnosticAnswers;
    const value = (answers as Record<string, unknown>)[key];
    const result = schema.safeParse(value);
    if (!result.success) {
      const first = result.error.issues[0]?.message ?? "Completa esta pregunta para continuar";
      setValidationError(first);
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrent()) return;
    if (step >= 1 && step <= 8) {
      track("lead_magnet_step_complete", {
        step_number: step,
        answer: summariseAnswer(step, answers),
      });
    }
    goTo(Math.min(10, step + 1) as Step);
  };

  const handleBack = () => {
    if (step === 0) return;
    goTo(Math.max(0, step - 1) as Step);
  };

  // Browser back button: intercept to step inside the flow if step > 1.
  React.useEffect(() => {
    if (step === 0) return;
    const onPop = (e: PopStateEvent) => {
      e.preventDefault();
      if (step > 0) {
        setStep((s) => Math.max(0, s - 1) as Step);
      }
    };
    window.history.pushState({ vivaruDiag: step }, "");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [step]);

  // Enter key advances on desktop (except inside text inputs).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (step >= 9) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "BUTTON" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (step === 0) handleStart();
      else handleNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, answers]);

  // Save draft after each answer change for steps 1-9.
  React.useEffect(() => {
    if (step === 0 || step === 10) return;
    saveDraft(step, answers);
  }, [step, answers, saveDraft]);

  // --- Submission -----------------------------------------------------------
  const handleContactSubmit = async (
    contact: DiagnosticAnswers["q9_contacto"],
  ) => {
    setServerError(null);
    const merged: Partial<DiagnosticAnswers> = { ...answers, q9_contacto: contact };
    const parsed = diagnosticSchema.safeParse(merged);
    if (!parsed.success) {
      setServerError("Faltan respuestas. Por favor revisa el formulario.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (res.status === 429) {
        setServerError("Demasiados intentos. Intenta en unos minutos.");
        return;
      }
      if (!res.ok) {
        setServerError("No pudimos generar tu reporte. Reintenta en un momento.");
        return;
      }
      const data = (await res.json()) as { ok: boolean; score: number };
      setAnswers(parsed.data);
      setScore(data.score);

      // Telemetry: completion event with full segmentation.
      const emailDomain = parsed.data.q9_contacto.email.split("@")[1]?.toLowerCase() ?? "";
      track("lead_magnet_complete", {
        score: data.score,
        pillar: parsed.data.q5_pilarDolor,
        segment: parsed.data.q1_conjuntos,
        tier_recommended:
          parsed.data.q5_pilarDolor === "cartera"
            ? "profesional"
            : parsed.data.q5_pilarDolor === "gobernanza"
              ? "enterprise"
              : "operacion",
        timeline: parsed.data.q8_timeline,
        email_domain_type: WEBMAIL_DOMAINS.has(emailDomain) ? "webmail" : "corporate",
        units_total: parsed.data.q2_unidades,
      });
      clearDraft();
      goTo(10);
    } catch {
      setServerError("Sin conexión. Verifica tu red y reintenta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render ---------------------------------------------------------------
  const anim = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-md px-md pb-32 pt-md sm:px-lg">
        {step === 0 && draftDetected ? (
          <DraftRecoveryBanner
            step={draftDetected.step}
            onResume={resumeDraft}
            onDiscard={discardDraft}
          />
        ) : null}

        {step >= 1 && step <= 9 ? (
          <ProgressBar current={Math.min(step, TOTAL_QUESTIONS)} total={TOTAL_QUESTIONS} />
        ) : null}

        <AnimatePresence mode="wait" initial={false}>
          <m.div key={step} {...anim}>
            {renderStep({
              step,
              answers,
              setAnswers,
              validationError,
              onStart: handleStart,
              onContactSubmit: handleContactSubmit,
              isSubmitting,
              serverError,
              score,
            })}
          </m.div>
        </AnimatePresence>
      </div>

      {/* Sticky footer nav — only visible for question steps. */}
      {step >= 1 && step <= 8 ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-md py-3 backdrop-blur sm:px-lg"
          aria-label="Navegación del diagnóstico"
        >
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={handleBack}
              className={step === 1 ? "invisible" : ""}
            >
              ← Anterior
            </Button>
            <Button
              type="button"
              size="xl"
              onClick={handleNext}
              className="min-w-[140px]"
            >
              {step === 8 ? "Casi listo →" : "Siguiente →"}
            </Button>
          </div>
        </nav>
      ) : null}
    </LazyMotion>
  );
}

// -- Helpers ----------------------------------------------------------------

function stepFieldName(step: number): string {
  return {
    1: "conjuntos",
    2: "unidades",
    3: "tipoConjunto",
    4: "herramientas",
    5: "pilarDolor",
    6: "morosidad",
    7: "horasManuales",
    8: "timeline",
  }[step] as string;
}

function summariseAnswer(step: number, answers: Partial<DiagnosticAnswers>): unknown {
  const key = `q${step}_${stepFieldName(step)}` as keyof DiagnosticAnswers;
  return (answers as Record<string, unknown>)[key];
}

// -- Step renderer ----------------------------------------------------------

function renderStep(props: {
  step: Step;
  answers: Partial<DiagnosticAnswers>;
  setAnswers: React.Dispatch<React.SetStateAction<Partial<DiagnosticAnswers>>>;
  validationError: string | null;
  onStart: () => void;
  onContactSubmit: (c: DiagnosticAnswers["q9_contacto"]) => Promise<void>;
  isSubmitting: boolean;
  serverError: string | null;
  score: number | null;
}) {
  const {
    step,
    answers,
    setAnswers,
    validationError,
    onStart,
    onContactSubmit,
    isSubmitting,
    serverError,
    score,
  } = props;

  const update = <K extends keyof DiagnosticAnswers>(key: K, value: DiagnosticAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  switch (step) {
    case 0:
      return <ViewWelcome onStart={onStart} />;

    case 1:
      return (
        <ViewQuestion
          title="¿Cuántos conjuntos administras hoy?"
          subtitle="Cuenta solo los que estén activos en tu operación."
          error={validationError ?? undefined}
        >
          <RadioCards
            name="conjuntos"
            value={answers.q1_conjuntos}
            onChange={(v) => update("q1_conjuntos", v)}
            options={[
              { value: "1", label: "1 conjunto", icon: <Building className="h-5 w-5" /> },
              { value: "2-5", label: "2 a 5", icon: <Building2 className="h-5 w-5" /> },
              { value: "6-15", label: "6 a 15", icon: <Hotel className="h-5 w-5" /> },
              { value: "16+", label: "16 o más", icon: <Construction className="h-5 w-5" /> },
            ]}
          />
        </ViewQuestion>
      );

    case 2:
      return (
        <ViewQuestion
          title="¿Cuántas unidades en total?"
          subtitle="Suma todos los apartamentos, casas o locales que administras."
          error={validationError ?? undefined}
        >
          <BigSlider
            name="unidades"
            min={50}
            max={2000}
            step={10}
            value={answers.q2_unidades ?? 150}
            onChange={(v) => update("q2_unidades", v)}
            unit="unidades"
            hint="Arrastra para ajustar. Puedes redondear."
          />
        </ViewQuestion>
      );

    case 3:
      return (
        <ViewQuestion
          title="¿Qué tipos de conjunto manejas?"
          subtitle="Selecciona todas las que apliquen."
          error={validationError ?? undefined}
        >
          <CheckboxCards
            name="tipoConjunto"
            value={answers.q3_tipoConjunto ?? []}
            onChange={(v) => update("q3_tipoConjunto", v)}
            options={[
              { value: "vertical", label: "Vertical", description: "Edificios de apartamentos" },
              { value: "horizontal", label: "Horizontal", description: "Casas en propiedad horizontal" },
              { value: "fraccionamiento", label: "Fraccionamiento", description: "Lotes / parcelas" },
              { value: "mixto", label: "Mixto", description: "Combinación de los anteriores" },
            ]}
          />
        </ViewQuestion>
      );

    case 4:
      return (
        <ViewQuestion
          title="¿Con qué herramientas operas hoy?"
          subtitle="Selecciona todas las que uses, aunque sea ocasionalmente."
          error={validationError ?? undefined}
        >
          <CheckboxCards
            name="herramientas"
            value={answers.q4_herramientas ?? []}
            onChange={(v) => update("q4_herramientas", v)}
            options={[
              { value: "excel", label: "Excel / Sheets", description: "Cartera, residentes, cuentas" },
              { value: "whatsapp", label: "WhatsApp", description: "Comunicación con residentes" },
              { value: "otroSoftware", label: "Otro software", description: "Plataforma administrativa" },
              { value: "libretas", label: "Libretas físicas", description: "Portería / paquetería" },
              { value: "nada", label: "Nada formal", description: "Todo lo lleva el administrador" },
            ]}
          />
        </ViewQuestion>
      );

    case 5:
      return (
        <ViewQuestion
          title="¿Cuál es tu pilar de dolor principal?"
          subtitle="Elige el que te quita más tiempo o energía hoy."
          error={validationError ?? undefined}
        >
          <RadioCards
            name="pilarDolor"
            value={answers.q5_pilarDolor}
            onChange={(v) => update("q5_pilarDolor", v)}
            options={[
              { value: "cartera", label: "Cartera & cobranza", description: "Morosidad, estados de cuenta", icon: <Wallet className="h-5 w-5" /> },
              { value: "comunicacion", label: "Comunicación", description: "Cadenas de WhatsApp, comunicados", icon: <MessageSquare className="h-5 w-5" /> },
              { value: "porteria", label: "Portería & visitas", description: "Visitantes, paquetes, accesos", icon: <ShieldCheck className="h-5 w-5" /> },
              { value: "gobernanza", label: "Gobernanza", description: "Reportes para consejo / asamblea", icon: <ScrollText className="h-5 w-5" /> },
            ]}
          />
        </ViewQuestion>
      );

    case 6:
      return (
        <ViewQuestion
          title="¿Cuál es tu morosidad promedio?"
          subtitle="El % de cartera vencida en tus conjuntos. Si no lo sabes con precisión, estima."
          error={validationError ?? undefined}
        >
          <BigSlider
            name="morosidad"
            min={0}
            max={50}
            step={1}
            value={answers.q6_morosidad ?? 10}
            onChange={(v) => update("q6_morosidad", v)}
            unit="%"
            hint="Promedio de cartera vencida"
          />
        </ViewQuestion>
      );

    case 7:
      return (
        <ViewQuestion
          title="¿Cuántas horas semanales gastas en tareas manuales?"
          subtitle="Estados de cuenta, recibos, oficios, conciliaciones."
          error={validationError ?? undefined}
        >
          <BigSlider
            name="horasManuales"
            min={0}
            max={30}
            step={1}
            value={answers.q7_horasManuales ?? 8}
            onChange={(v) => update("q7_horasManuales", v)}
            unit="horas"
            hint="Horas por semana, todos los conjuntos sumados"
          />
        </ViewQuestion>
      );

    case 8:
      return (
        <ViewQuestion
          title="¿Cuándo necesitas tener esto resuelto?"
          subtitle="Nos ayuda a priorizar tu demo si decides agendarla."
          error={validationError ?? undefined}
        >
          <RadioCards
            name="timeline"
            value={answers.q8_timeline}
            onChange={(v) => update("q8_timeline", v)}
            options={[
              { value: "30dias", label: "En los próximos 30 días", icon: <Calendar className="h-5 w-5" /> },
              { value: "trimestre", label: "Este trimestre", icon: <CalendarRange className="h-5 w-5" /> },
              { value: "anio", label: "Antes de fin de año", icon: <CalendarDays className="h-5 w-5" /> },
              { value: "investigando", label: "Solo estoy investigando", icon: <Search className="h-5 w-5" /> },
            ]}
          />
        </ViewQuestion>
      );

    case 9:
      return (
        <ViewContactForm
          defaultValues={answers.q9_contacto}
          onSubmit={onContactSubmit}
          isSubmitting={isSubmitting}
          serverError={serverError}
        />
      );

    case 10:
      if (score == null || !answers.q9_contacto) return null;
      return <ViewReport score={score} answers={answers as DiagnosticAnswers} />;
  }
}
