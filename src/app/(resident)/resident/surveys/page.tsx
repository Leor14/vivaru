"use client";

import { ChevronLeft, ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import { hasResponded, submitResponse } from "@/features/surveys/services";
import type { Survey, SurveyAnswer } from "@/features/surveys/types";
import { useResidentSurveys } from "@/features/surveys/use-surveys";

// ─── Types ─────────────────────────────────────────────────────────────────────

type PageView = "list" | "form";

// answers keyed by questionId: string (single/text), string[] (multiple), number (likert)
type AnswerMap = Record<string, string | string[] | number>;
type ErrorMap = Record<string, string>;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

// ─── Page component ────────────────────────────────────────────────────────────

export default function ResidentSurveysPage() {
  const { user } = useAuth();
  const { surveys, loading, error } = useResidentSurveys(user?.tenantId);
  const unitId = user?.unitId ?? "";

  // ── Responded state ───────────────────────────────────────────────────────
  // Set of survey IDs the resident has already answered
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
  const [checkingResponded, setCheckingResponded] = useState(false);

  useEffect(() => {
    if (!unitId || surveys.length === 0) return;

    let cancelled = false;
    setCheckingResponded(true);

    void Promise.all(surveys.map((s) => hasResponded(s.id, unitId)))
      .then((results) => {
        if (cancelled) return;
        const ids = new Set<string>();
        surveys.forEach((s, idx) => {
          if (results[idx]) ids.add(s.id);
        });
        setRespondedIds(ids);
        setCheckingResponded(false);
      })
      .catch(() => {
        if (!cancelled) setCheckingResponded(false);
      });

    return () => {
      cancelled = true;
    };
  }, [surveys, unitId]);

  // ── Form state ────────────────────────────────────────────────────────────
  const [view, setView] = useState<PageView>("list");
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [answerErrors, setAnswerErrors] = useState<ErrorMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Open form
  // ─────────────────────────────────────────────────────────────────────────

  function openForm(survey: Survey) {
    // Initialize empty answers for each question
    const initial: AnswerMap = {};
    for (const q of survey.questions) {
      if (q.type === "multiple_choice") {
        initial[q.id] = [];
      } else if (q.type === "likert") {
        initial[q.id] = 0; // 0 = not yet selected
      } else {
        initial[q.id] = "";
      }
    }
    setActiveSurvey(survey);
    setAnswers(initial);
    setAnswerErrors({});
    setSuccessMsg(null);
    setView("form");
  }

  function backToList() {
    setView("list");
    setActiveSurvey(null);
    setSuccessMsg(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Answer setters
  // ─────────────────────────────────────────────────────────────────────────

  function setAnswer(questionId: string, value: string | string[] | number) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    // Clear error for this question on change
    setAnswerErrors((prev) => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }

  function toggleMultiChoice(questionId: string, option: string, checked: boolean) {
    const current = (answers[questionId] as string[]) ?? [];
    const next = checked ? [...current, option] : current.filter((o) => o !== option);
    setAnswer(questionId, next);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────────────────

  function validate(survey: Survey): boolean {
    const errors: ErrorMap = {};
    for (const q of survey.questions) {
      if (!q.required) continue;
      const val = answers[q.id];
      if (q.type === "multiple_choice") {
        if (!Array.isArray(val) || val.length === 0) {
          errors[q.id] = "Selecciona al menos una opción.";
        }
      } else if (q.type === "likert") {
        if (!val || (val as number) === 0) {
          errors[q.id] = "Selecciona un valor del 1 al 5.";
        }
      } else {
        if (!val || String(val).trim() === "") {
          errors[q.id] = "Esta pregunta es obligatoria.";
        }
      }
    }
    setAnswerErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!activeSurvey || !unitId) return;
    if (!validate(activeSurvey)) return;

    setSubmitting(true);
    try {
      const surveyAnswers: SurveyAnswer[] = activeSurvey.questions.map((q) => ({
        questionId: q.id,
        value: answers[q.id] ?? "",
      }));

      await submitResponse(activeSurvey, unitId, surveyAnswers);

      const now = new Date();
      setSuccessMsg(
        `Respuesta registrada el ${formatDate(now)}. ¡Gracias por participar!`,
      );
      setRespondedIds((prev) => new Set([...prev, activeSurvey.id]));

      // Return to list after 2 seconds
      setTimeout(() => {
        backToList();
      }, 2000);
    } catch (error) {
      console.error("[surveys] submitResponse failed:", error);
      toast.error("No fue posible enviar tu respuesta. Intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Form view
  // ─────────────────────────────────────────────────────────────────────────

  if (view === "form" && activeSurvey) {
    return (
      <Card className="border border-[var(--slate-200)] bg-[var(--slate-50)]/40 p-4 sm:p-6">
        {/* Header */}
        <div className="border-b border-[var(--slate-200)] pb-4">
          <button
            type="button"
            onClick={backToList}
            className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--brand-700)] hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            Volver
          </button>
          <CardTitle className="text-xl font-semibold tracking-tight text-[var(--slate-900)]">
            {activeSurvey.title}
          </CardTitle>
          {activeSurvey.description && (
            <CardDescription className="mt-1 text-sm text-[var(--slate-600)]">
              {activeSurvey.description}
            </CardDescription>
          )}
        </div>

        {/* Success message */}
        {successMsg && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {successMsg}
          </div>
        )}

        {/* Questions */}
        {!successMsg && (
          <div className="mt-5 space-y-6">
            {activeSurvey.questions.map((question, idx) => (
              <div key={question.id} className="space-y-2">
                <p className="text-sm font-medium text-[var(--slate-900)]">
                  {idx + 1}.{" "}
                  {question.text}
                  {question.required && (
                    <span className="ml-1 text-[var(--danger-700)]">*</span>
                  )}
                </p>

                {/* single_choice */}
                {question.type === "single_choice" && (
                  <RadioGroup
                    name={`q-${question.id}`}
                    value={String(answers[question.id] ?? "")}
                    onChange={(val) => setAnswer(question.id, val)}
                    className="space-y-1.5"
                  >
                    {(question.options ?? []).map((opt) => (
                      <RadioItem
                        key={opt}
                        value={opt}
                        label={opt}
                        name={`q-${question.id}`}
                        checked={answers[question.id] === opt}
                        onChange={(val) => setAnswer(question.id, val)}
                      />
                    ))}
                  </RadioGroup>
                )}

                {/* multiple_choice */}
                {question.type === "multiple_choice" && (
                  <div className="space-y-1.5">
                    {(question.options ?? []).map((opt) => {
                      const selected = (answers[question.id] as string[]) ?? [];
                      return (
                        <Checkbox
                          key={opt}
                          label={opt}
                          checked={selected.includes(opt)}
                          onChange={(checked) =>
                            toggleMultiChoice(question.id, opt, checked)
                          }
                        />
                      );
                    })}
                  </div>
                )}

                {/* likert */}
                {question.type === "likert" && (
                  <div className="flex flex-wrap items-center gap-2">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const selected = answers[question.id] === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          aria-label={`Valor ${n}`}
                          onClick={() => setAnswer(question.id, n)}
                          className={[
                            "flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold transition-colors",
                            selected
                              ? "border-[var(--brand-700)] bg-[var(--brand-700)] text-white"
                              : "border-[var(--slate-300)] bg-white text-[var(--slate-700)] hover:border-[var(--brand-700)] hover:text-[var(--brand-700)]",
                          ].join(" ")}
                        >
                          {n}
                        </button>
                      );
                    })}
                    <span className="text-xs text-[var(--slate-500)]">1 = Muy malo · 5 = Excelente</span>
                  </div>
                )}

                {/* text */}
                {question.type === "text" && (
                  <Textarea
                    placeholder="Escribe tu respuesta aquí"
                    value={String(answers[question.id] ?? "")}
                    onChange={(e) => setAnswer(question.id, e.target.value)}
                    className="min-h-20"
                  />
                )}

                {/* Inline error */}
                {answerErrors[question.id] && (
                  <p className="text-xs text-[var(--danger-700)]">
                    {answerErrors[question.id]}
                  </p>
                )}
              </div>
            ))}

            <div className="border-t border-[var(--slate-200)] pt-4">
              <Button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                {submitting ? "Enviando..." : "Enviar respuesta"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: List view (default)
  // ─────────────────────────────────────────────────────────────────────────

  const isChecking = loading || checkingResponded;

  return (
    <Card className="border border-[var(--slate-200)] bg-[var(--slate-50)]/40 p-4 sm:p-6">
      <div className="border-b border-[var(--slate-200)] pb-4">
        <CardTitle className="text-xl font-semibold tracking-tight text-[var(--slate-900)]">
          Encuestas
        </CardTitle>
        <CardDescription className="mt-1 text-sm text-[var(--slate-600)]">
          Encuestas activas de la administración del conjunto.
        </CardDescription>
      </div>

      <div className="mt-5 space-y-4">
        {isChecking && (
          <div className="rounded-2xl border border-[var(--slate-200)] bg-white p-4 text-sm text-[var(--slate-600)]">
            Cargando encuestas...
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-[var(--danger-200)] bg-[var(--danger-50)] p-3 text-sm text-[var(--danger-700)]">
            No se pudieron cargar las encuestas.
          </p>
        )}

        {!isChecking && !error && surveys.length === 0 && (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--slate-300)] bg-white px-6 py-10 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--slate-100)] text-[var(--slate-500)]">
              <ClipboardList className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-[var(--slate-900)]">
              No hay encuestas activas
            </h3>
            <p className="mt-1 max-w-md text-sm leading-6 text-[var(--slate-600)]">
              Cuando la administración publique una encuesta, aparecerá aquí.
            </p>
          </div>
        )}

        {!isChecking &&
          surveys.map((survey) => {
            const responded = respondedIds.has(survey.id);
            return (
              <article
                key={survey.id}
                className="group relative rounded-2xl border border-[var(--slate-200)] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold leading-6 text-[var(--slate-900)]">
                        {survey.title}
                      </h3>
                      {responded ? (
                        <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          Respondida
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          Pendiente
                        </span>
                      )}
                    </div>

                    {survey.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--slate-600)]">
                        {survey.description}
                      </p>
                    )}

                    <p className="mt-1.5 text-xs text-[var(--slate-500)]">
                      {survey.questions.length}{" "}
                      {survey.questions.length === 1 ? "pregunta" : "preguntas"}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {responded ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled
                        className="cursor-not-allowed opacity-60"
                      >
                        Ya respondiste
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => openForm(survey)}
                      >
                        Responder
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
      </div>
    </Card>
  );
}
