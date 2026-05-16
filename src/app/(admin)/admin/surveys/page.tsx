"use client";

import { ChevronLeft, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { RowActionsMenu, type RowActionsMenuItem } from "@/components/shared/row-actions-menu";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer } from "@/components/ui/drawer";
import { IconBadge } from "@/components/ui/icon-badge";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import type { CreateSurveyInput } from "@/features/surveys/schemas";
import {
  closeSurvey,
  createSurvey,
  deleteSurvey,
  getSurveyResults,
  publishSurvey,
  updateSurvey,
} from "@/features/surveys/services";
import type { Survey, SurveyAnswer, SurveyQuestion, QuestionType } from "@/features/surveys/types";
import { useAdminSurveys } from "@/features/surveys/use-surveys";
import { aggregateResults, canSeeResults } from "@/features/surveys/visibility";

// ─── Types ─────────────────────────────────────────────────────────────────────

type PageView = "list" | "results";

interface DraftQuestion {
  localId: string;
  type: QuestionType;
  text: string;
  options: Array<{ id: string; text: string }>;
  required: boolean;
}

interface FormErrors {
  title?: string;
  questions?: string;
  [key: string]: string | undefined;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function newDraftQuestion(): DraftQuestion {
  return {
    localId: genId(),
    type: "single_choice",
    text: "",
    options: [
      { id: genId(), text: "" },
      { id: genId(), text: "" },
    ],
    required: true,
  };
}

function formatDate(date: Date | undefined): string {
  if (!date || date.getTime() === 0) return "—";
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "Selección única",
  multiple_choice: "Selección múltiple",
  likert: "Escala 1–5",
  text: "Texto libre",
};

// ─── Page component ────────────────────────────────────────────────────────────

export default function AdminSurveysPage() {
  const { user } = useAuth();
  const { surveys, loading } = useAdminSurveys(user?.tenantId);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterText, setFilterText] = useState<string>("");

  const filteredSurveys = surveys.filter((s) => {
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    const matchText = s.title.toLowerCase().includes(filterText.toLowerCase());
    return matchStatus && matchText;
  });

  // ── View state ────────────────────────────────────────────────────────────
  const [view, setView] = useState<PageView>("list");
  const [resultsSurvey, setResultsSurvey] = useState<Survey | null>(null);
  const [resultsData, setResultsData] = useState<SurveyAnswer[][]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  // ── Create drawer ─────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // ── Form fields ───────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audienceType, setAudienceType] = useState<"all" | "tower">("all");
  const [audienceTower, setAudienceTower] = useState("");
  const [minResponses, setMinResponses] = useState(5);
  const [closingDate, setClosingDate] = useState<string>("");
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([newDraftQuestion()]);

  // ── Action states ─────────────────────────────────────────────────────────
  const [actingId, setActingId] = useState<string | null>(null);  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<Survey | null>(null);
  const [deleting, setDeleting] = useState(false);
  // ─────────────────────────────────────────────────────────────────────────
  // Drawer helpers
  // ─────────────────────────────────────────────────────────────────────────

  function openCreateDrawer() {
    setTitle("");
    setDescription("");
    setAudienceType("all");
    setAudienceTower("");
    setMinResponses(5);
    setClosingDate("");
    setDraftQuestions([newDraftQuestion()]);
    setFormErrors({});
    setEditingSurvey(null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    if (submitting) return;
    setDrawerOpen(false);
  }

  function openEditDrawer(survey: Survey) {
    setTitle(survey.title);
    setDescription(survey.description ?? "");
    setAudienceType(survey.targetAudience.type);
    setAudienceTower(survey.targetAudience.tower ?? "");
    setMinResponses(survey.minResponsesForResults);
    setClosingDate(
      survey.closingDate ? survey.closingDate.toISOString().split("T")[0] : "",
    );
    setDraftQuestions(
      survey.questions.map((q) => ({
        localId: q.id,
        type: q.type,
        text: q.text,
        options: q.options?.map((o) => ({ id: genId(), text: o })) ?? [],
        required: q.required,
      })),
    );
    setEditingSurvey(survey);
    setFormErrors({});
    setDrawerOpen(true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Question builder helpers
  // ─────────────────────────────────────────────────────────────────────────

  function addQuestion() {
    if (draftQuestions.length >= 10) return;
    setDraftQuestions((prev) => [...prev, newDraftQuestion()]);
  }

  function removeQuestion(localId: string) {
    setDraftQuestions((prev) => prev.filter((q) => q.localId !== localId));
  }

  function updateQuestion(localId: string, patch: Partial<DraftQuestion>) {
    setDraftQuestions((prev) =>
      prev.map((q) => (q.localId === localId ? { ...q, ...patch } : q)),
    );
  }

  function addOption(localId: string) {
    setDraftQuestions((prev) =>
      prev.map((q) =>
        q.localId === localId
          ? { ...q, options: [...q.options, { id: genId(), text: "" }] }
          : q,
      ),
    );
  }

  function updateOption(localId: string, idx: number, value: string) {
    setDraftQuestions((prev) =>
      prev.map((q) => {
        if (q.localId !== localId) return q;
        const options = q.options.map((opt, i) =>
          i === idx ? { ...opt, text: value } : opt,
        );
        return { ...q, options };
      }),
    );
  }

  function removeOption(localId: string, idx: number) {
    setDraftQuestions((prev) =>
      prev.map((q) => {
        if (q.localId !== localId) return q;
        const options = q.options.filter((_, i) => i !== idx);
        return { ...q, options };
      }),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errors: FormErrors = {};

    if (!title.trim() || title.trim().length < 3) {
      errors.title = "El título debe tener al menos 3 caracteres.";
    }
    if (title.trim().length > 100) {
      errors.title = "El título no puede superar 100 caracteres.";
    }
    if (draftQuestions.length === 0) {
      errors.questions = "Agrega al menos una pregunta.";
    }
    if (audienceType === "tower" && !audienceTower.trim()) {
      errors.tower = "Indica el nombre de la torre.";
    }

    for (const q of draftQuestions) {
      if (!q.text.trim()) {
        errors[`q_text_${q.localId}`] = "El enunciado de la pregunta es obligatorio.";
      }
      if (q.type === "single_choice" || q.type === "multiple_choice") {
        const validOptions = q.options.filter((o) => o.text.trim());
        if (validOptions.length < 2) {
          errors[`q_opts_${q.localId}`] = "Agrega al menos 2 opciones válidas.";
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!user?.tenantId) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      const questions: SurveyQuestion[] = draftQuestions.map((q, idx) => ({
        id: `q${idx + 1}`,
        type: q.type,
        text: q.text.trim(),
        options:
          q.type === "single_choice" || q.type === "multiple_choice"
            ? q.options.map((o) => o.text.trim()).filter(Boolean)
            : undefined,
        required: q.required,
      }));

      const input: CreateSurveyInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        questions,
        targetAudience:
          audienceType === "tower"
            ? { type: "tower", tower: audienceTower.trim() }
            : { type: "all" },
        minResponsesForResults: minResponses,
        closingDate: closingDate ? new Date(closingDate) : undefined,
      };

      if (editingSurvey) {
        await updateSurvey(editingSurvey.id, input);
        toast.success("Encuesta actualizada.");
      } else {
        await createSurvey(user.tenantId, input, user.uid);
        toast.success("Encuesta creada como borrador.");
      }
      setDrawerOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar la encuesta.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Row actions
  // ─────────────────────────────────────────────────────────────────────────

  async function handlePublish(survey: Survey) {
    setActingId(survey.id);
    try {
      await publishSurvey(survey.id);
      toast.success("Encuesta publicada.");
    } catch {
      toast.error("No fue posible publicar la encuesta.");
    } finally {
      setActingId(null);
    }
  }

  async function handleClose(survey: Survey) {
    setActingId(survey.id);
    try {
      await closeSurvey(survey.id);
      toast.success("Encuesta cerrada.");
    } catch {
      toast.error("No fue posible cerrar la encuesta.");
    } finally {
      setActingId(null);
    }
  }

  async function handleViewResults(survey: Survey) {
    setResultsSurvey(survey);
    setResultsLoading(true);
    setView("results");
    try {
      const raw = await getSurveyResults(survey.id);
      setResultsData(raw);
    } catch {
      toast.error("No fue posible cargar los resultados.");
      setResultsData([]);
    } finally {
      setResultsLoading(false);
    }
  }

  async function handleDelete() {
    if (!pendingDeletion) return;
    const target = pendingDeletion;
    setDeleting(true);
    try {
      await deleteSurvey(target.id);
      toast.success("Encuesta eliminada.");
      setPendingDeletion(null);
    } catch {
      toast.error("No fue posible eliminar la encuesta.");
    } finally {
      setDeleting(false);
    }
  }

  function backToList() {
    setView("list");
    setResultsSurvey(null);
    setResultsData([]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DataTable columns
  // ─────────────────────────────────────────────────────────────────────────

  const columns: DataTableColumn<Survey>[] = [
    {
      key: "title",
      header: "Título",
      render: (s) => <span className="font-medium text-[var(--slate-900)]">{s.title}</span>,
    },
    {
      key: "status",
      header: "Estado",
      render: (s) => <StatusBadge status={s.status} />,
    },
    {
      key: "responseCount",
      header: "Respuestas",
      render: (s) => (
        <span className="text-[var(--slate-700)]">
          {s.responseCount} {s.responseCount === 1 ? "respuesta" : "respuestas"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Creada",
      render: (s) => <span className="text-[var(--slate-600)]">{formatDate(s.createdAt)}</span>,
    },
    {
      key: "closingDate",
      header: "Cierre",
      render: (s) =>
        s.closingDate ? (
          <span className="text-[var(--slate-600)]">{formatDate(s.closingDate)}</span>
        ) : (
          <span className="text-[var(--slate-400)] text-sm">Sin fecha</span>
        ),
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // Render: Results view
  // ─────────────────────────────────────────────────────────────────────────

  if (view === "results" && resultsSurvey) {
    const aggregated = aggregateResults(resultsSurvey, resultsData);

    return (
      <Card>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={backToList}
            className="flex items-center gap-1 text-sm text-[var(--brand-700)] hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            Volver
          </button>
        </div>

        <div className="mt-4 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{resultsSurvey.title}</CardTitle>
            <StatusBadge status={resultsSurvey.status} />
          </div>
          {resultsSurvey.closedAt && resultsSurvey.closedAt.getTime() > 0 && (
            <p className="text-sm text-[var(--slate-500)]">
              Cerrada el {formatDate(resultsSurvey.closedAt)}
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-6">
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] px-5 py-3 text-center">
            <p className="text-2xl font-semibold text-[var(--slate-900)]">{aggregated.totalResponded}</p>
            <p className="text-xs text-[var(--slate-500)]">Respuestas totales</p>
          </div>
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] px-5 py-3 text-center">
            <p className="text-2xl font-semibold text-[var(--slate-900)]">—</p>
            <p className="text-xs text-[var(--slate-500)]">Participación</p>
          </div>
        </div>

        {resultsLoading ? (
          <p className="mt-6 text-sm text-[var(--slate-500)]">Cargando resultados…</p>
        ) : resultsData.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--slate-500)]">Sin respuestas aún.</p>
        ) : (
          <div className="mt-6 space-y-6">
            {resultsSurvey.questions.map((question) => {
              const entry = aggregated.byQuestion[question.id];
              if (!entry) return null;

              return (
                <div key={question.id} className="rounded-xl border border-[var(--slate-200)] p-4">
                  <p className="font-medium text-[var(--slate-900)]">{question.text}</p>
                  <p className="mt-0.5 text-xs text-[var(--slate-500)]">{QUESTION_TYPE_LABELS[question.type]}</p>

                  {entry.type === "text" ? (
                    <ul className="mt-3 space-y-1">
                      {(entry.textAnswers ?? []).slice(0, 50).map((answer, idx) => (
                        <li
                          key={idx}
                          className="rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--slate-800)]"
                        >
                          {answer}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {Object.entries(entry.counts ?? {})
                        .sort((a, b) => b[1] - a[1])
                        .map(([option, count]) => {
                          const total = Object.values(entry.counts ?? {}).reduce((s, n) => s + n, 0);
                          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                          return (
                            <div key={option}>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-[var(--slate-800)]">{option}</span>
                                <span className="text-[var(--slate-500)]">
                                  {count} ({pct}%)
                                </span>
                              </div>
                              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--slate-100)]">
                                <div
                                  className="h-full rounded-full bg-[var(--brand-700)]"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render: List view (default)
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle help="Mide la opinión de la comunidad sobre temas del conjunto. Las encuestas activas generan participación y te dan argumentos sólidos para tomar decisiones con el respaldo documentado de los residentes.">Encuestas</CardTitle>
          <CardDescription className="mt-1">Crea y gestiona encuestas para la comunidad.</CardDescription>
        </div>
        <Button className="w-full sm:w-auto" onClick={openCreateDrawer}>
          <IconBadge tone="mint" className="mr-2">
            <Plus className="h-4 w-4" />
          </IconBadge>
          Nueva encuesta
        </Button>
      </div>

      <div className="mt-4">
        {/* ── Filters ─────────────────────────────────────────────────── */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Buscar encuesta…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="h-9 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] placeholder:text-[var(--slate-400)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)] sm:w-56"
          />
          <div className="flex flex-wrap gap-1.5">
            {([
              { value: "all", label: "Todas" },
              { value: "draft", label: "Borrador" },
              { value: "published", label: "Publicadas" },
              { value: "closed", label: "Cerradas" },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilterStatus(value)}
                className={`h-8 rounded-full px-3 text-xs font-medium transition-colors ${
                  filterStatus === value
                    ? "bg-[var(--brand-700)] text-white"
                    : "border border-[var(--slate-300)] bg-white text-[var(--slate-700)] hover:border-[var(--brand-700)] hover:text-[var(--brand-700)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={filteredSurveys}
          getRowKey={(s) => s.id}
          loading={loading}
          loadingText="Cargando encuestas..."
          emptyText="No hay encuestas. Crea la primera."
          actionsHeader="Acciones"
          tableMinWidthClassName="min-w-[640px]"
          renderActions={(s) => {
            const rowItems: RowActionsMenuItem[] = [];

            if (s.status === "draft") {
              rowItems.push({
                key: "publish",
                label: "Publicar",
                disabled: actingId === s.id,
                onSelect: () => void handlePublish(s),
              });
              rowItems.push({
                key: "edit",
                label: "Editar",
                onSelect: () => openEditDrawer(s),
              });
              rowItems.push({
                key: "delete",
                label: "Eliminar",
                danger: true,
                separatorBefore: true,
                onSelect: () => setPendingDeletion(s),
              });
            }

            if (canSeeResults(s)) {
              rowItems.push({
                key: "results",
                label: "Ver resultados",
                onSelect: () => void handleViewResults(s),
              });
            }

            if (s.status === "published") {
              rowItems.push({
                key: "close",
                label: "Cerrar encuesta",
                disabled: actingId === s.id,
                separatorBefore: rowItems.length > 0,
                onSelect: () => void handleClose(s),
              });
            }

            if (rowItems.length === 0) return null;

            return (
              <div className="flex justify-end">
                <RowActionsMenu
                  ariaLabel={`Acciones para ${s.title}`}
                  items={rowItems}
                />
              </div>
            );
          }}
        />
      </div>

      {/* ── Create drawer ───────────────────────────────────────────────── */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editingSurvey ? "Editar encuesta" : "Nueva encuesta"}
        width={560}
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeDrawer} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? "Guardando…" : editingSurvey ? "Guardar cambios" : "Crear borrador"}
            </Button>
          </div>
        }
      >
        <div className="space-y-5 pb-2">
          {/* ── Sección A: Información básica ─────────────────────────── */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--slate-500)]">
              Información básica
            </h3>

            <div>
              <Input
                label="Título"
                placeholder="Ej. Satisfacción con áreas comunes"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
              {formErrors.title && (
                <p className="mt-1 text-xs text-[var(--danger-700)]">{formErrors.title}</p>
              )}
            </div>

            <div>
              <Textarea
                label="Descripción (opcional)"
                placeholder="Contexto adicional para los residentes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                className="min-h-16"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--slate-700)]">
                Dirigida a
              </label>
              <select
                className="h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)]"
                value={audienceType}
                onChange={(e) => setAudienceType(e.target.value as "all" | "tower")}
              >
                <option value="all">Todos los residentes</option>
                <option value="tower">Una torre específica</option>
              </select>
            </div>

            {audienceType === "tower" && (
              <div>
                <Input
                  label="Nombre de la torre"
                  placeholder="Ej. Torre A"
                  value={audienceTower}
                  onChange={(e) => setAudienceTower(e.target.value)}
                />
                {formErrors.tower && (
                  <p className="mt-1 text-xs text-[var(--danger-700)]">{formErrors.tower}</p>
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--slate-700)]">
                Mínimo de respuestas para ver resultados
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={minResponses}
                onChange={(e) => setMinResponses(Math.max(1, Math.min(50, Number(e.target.value))))}
                className="h-10 w-28 rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--slate-700)]">
                Fecha de cierre (opcional)
              </label>
              <input
                type="date"
                value={closingDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setClosingDate(e.target.value)}
                className="h-10 w-48 rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)]"
              />
              <p className="mt-1 text-xs text-[var(--slate-500)]">
                Si se define, los residentes verán hasta cuándo pueden responder.
              </p>
            </div>
          </div>

          {/* ── Sección B: Constructor de preguntas ───────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--slate-500)]">
                Preguntas
              </h3>
              <span className="text-xs text-[var(--slate-400)]">
                {draftQuestions.length}/10
              </span>
            </div>

            {formErrors.questions && (
              <p className="text-xs text-[var(--danger-700)]">{formErrors.questions}</p>
            )}

            {draftQuestions.map((q, qIdx) => (
              <div
                key={q.localId}
                className="space-y-3 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-4"
              >
                {/* Question header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--slate-500)]">
                    Pregunta {qIdx + 1}
                  </span>
                  {draftQuestions.length > 1 && (
                    <button
                      type="button"
                      aria-label="Eliminar pregunta"
                      onClick={() => removeQuestion(q.localId)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--danger-700)] hover:bg-[var(--danger-50)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Type selector */}
                <div>
                  <label className="mb-1 block text-xs text-[var(--slate-600)]">Tipo</label>
                  <select
                    className="h-9 w-full rounded-lg border border-[var(--slate-300)] bg-white px-2 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)]"
                    value={q.type}
                    onChange={(e) =>
                      updateQuestion(q.localId, {
                        type: e.target.value as QuestionType,
                        options:
                          e.target.value === "single_choice" || e.target.value === "multiple_choice"
                            ? q.options.length < 2
                              ? [{ id: genId(), text: "" }, { id: genId(), text: "" }]
                              : q.options
                            : [],
                      })
                    }
                  >
                    {(Object.entries(QUESTION_TYPE_LABELS) as [QuestionType, string][]).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                {/* Question text */}
                <div>
                  <label className="mb-1 block text-xs text-[var(--slate-600)]">
                    Enunciado
                  </label>
                  <input
                    type="text"
                    className="h-9 w-full rounded-lg border border-[var(--slate-300)] bg-white px-2 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-1 focus:ring-[var(--brand-200)]"
                    placeholder="Escribe la pregunta aquí"
                    value={q.text}
                    onChange={(e) => updateQuestion(q.localId, { text: e.target.value })}
                  />
                  {formErrors[`q_text_${q.localId}`] && (
                    <p className="mt-0.5 text-xs text-[var(--danger-700)]">
                      {formErrors[`q_text_${q.localId}`]}
                    </p>
                  )}
                </div>

                {/* Options (single_choice / multiple_choice) */}
                {(q.type === "single_choice" || q.type === "multiple_choice") && (
                  <div className="space-y-2">
                    <label className="block text-xs text-[var(--slate-600)]">Opciones</label>
                    {q.options.map((opt, optIdx) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          className="h-8 flex-1 rounded-lg border border-[var(--slate-300)] bg-white px-2 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)]"
                          placeholder={`Opción ${optIdx + 1}`}
                          value={opt.text}
                          onChange={(e) => updateOption(q.localId, optIdx, e.target.value)}
                        />
                        {q.options.length > 2 && (
                          <button
                            type="button"
                            aria-label="Eliminar opción"
                            onClick={() => removeOption(q.localId, optIdx)}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--slate-400)] hover:text-[var(--danger-700)]"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {formErrors[`q_opts_${q.localId}`] && (
                      <p className="text-xs text-[var(--danger-700)]">
                        {formErrors[`q_opts_${q.localId}`]}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => addOption(q.localId)}
                      className="text-xs text-[var(--brand-700)] hover:underline"
                    >
                      + Agregar opción
                    </button>
                  </div>
                )}

                {/* Likert hint */}
                {q.type === "likert" && (
                  <p className="text-xs text-[var(--slate-400)]">
                    Escala del 1 (muy malo) al 5 (excelente) — generada automáticamente.
                  </p>
                )}

                {/* Required checkbox */}
                <Checkbox
                  checked={q.required}
                  onChange={(checked) => updateQuestion(q.localId, { required: checked })}
                  label="Respuesta requerida"
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={draftQuestions.length >= 10}
              onClick={addQuestion}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar pregunta
              {draftQuestions.length >= 10 && (
                <span className="ml-1 text-xs text-[var(--slate-400)]">(máx. 10)</span>
              )}
            </Button>
          </div>
        </div>
      </Drawer>

      <ConfirmDeleteDialog
        open={Boolean(pendingDeletion)}
        name={pendingDeletion?.title ?? ""}
        description={
          pendingDeletion
            ? "Esta acción eliminará el borrador de la encuesta. No se puede deshacer."
            : null
        }
        loading={deleting}
        onCancel={() => (deleting ? undefined : setPendingDeletion(null))}
        onConfirm={() => void handleDelete()}
      />
    </Card>
  );
}
