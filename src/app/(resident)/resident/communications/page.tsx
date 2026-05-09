"use client";

import { useMemo, useState } from "react";
import { BellOff, CalendarDays, ChevronDown, ChevronUp, Dot, FileText } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { useCommunications } from "@/features/communications/use-communications";

const PREVIEW_LINES = 5;

function formatDateLabel(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatRelativeDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, "day");

  return formatDateLabel(value);
}

function shouldTruncateBody(body: string) {
  return body.trim().length > 340;
}

export default function ResidentCommunicationsPage() {
  const { user } = useAuth();
  const { items, loading, error } = useCommunications(user?.tenantId);
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  const feedItems = useMemo(() => items, [items]);

  const toggleExpanded = (id: string) => {
    setExpandedById((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <Card className="border border-[var(--slate-200)] bg-[var(--slate-50)]/40 p-4 sm:p-6">
      <div className="border-b border-[var(--slate-200)] pb-4">
        <CardTitle className="text-xl font-semibold tracking-tight text-[var(--slate-900)]">Comunicaciones</CardTitle>
        <CardDescription className="mt-1 text-sm text-[var(--slate-600)]">
          Feed de comunicados vigentes de la administración del conjunto.
        </CardDescription>
      </div>

      <div className="mt-5 space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[var(--slate-200)] bg-white p-4 text-sm text-[var(--slate-600)]">
            Cargando comunicados...
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-[var(--danger-200)] bg-[var(--danger-50)] p-3 text-sm text-[var(--danger-700)]">
            No se pudieron cargar las comunicaciones: {error}
          </p>
        ) : null}

        {!loading && feedItems.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--slate-300)] bg-white px-6 py-10 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--slate-100)] text-[var(--slate-500)]">
              <BellOff className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-[var(--slate-900)]">No hay comunicados vigentes</h3>
            <p className="mt-1 max-w-md text-sm leading-6 text-[var(--slate-600)]">
              Cuando la administración publique informacion, aparecera aqui.
            </p>
          </div>
        ) : null}

        {feedItems.map((item, index) => {
          const expanded = Boolean(expandedById[item.id]);
          const canCollapse = shouldTruncateBody(item.body);
          const relativeLabel = formatRelativeDate(item.publishedAt);
          const publishedLabel = formatDateLabel(item.publishedAt);
          const endLabel = formatDateLabel(item.endsAt);
          const isRecent = (() => {
            if (!item.publishedAt) return false;
            const date = new Date(item.publishedAt);
            if (Number.isNaN(date.getTime())) return false;
            return Date.now() - date.getTime() <= 1000 * 60 * 60 * 48;
          })();

          return (
            <article
              key={item.id}
              className="group relative rounded-2xl border border-[var(--slate-200)] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] sm:p-5"
            >
              {index < feedItems.length - 1 ? (
                <span className="pointer-events-none absolute -bottom-4 left-7 hidden h-4 w-px bg-[var(--slate-200)] sm:block" />
              ) : null}

              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold leading-6 text-[var(--slate-900)] sm:text-lg">{item.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--slate-500)]">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {relativeLabel ? `Publicado ${relativeLabel}` : "Publicado recientemente"}
                    </span>
                    {publishedLabel ? (
                      <>
                        <Dot className="h-3.5 w-3.5" />
                        <span>{publishedLabel}</span>
                      </>
                    ) : null}
                    {endLabel ? (
                      <>
                        <Dot className="h-3.5 w-3.5" />
                        <span>Vigente hasta {endLabel}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                {isRecent ? (
                  <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    Nuevo
                  </span>
                ) : null}
              </header>

              <div className="mt-3">
                <p
                  className="whitespace-pre-wrap text-sm leading-7 text-[var(--slate-700)] transition-all duration-200 sm:text-[15px]"
                  style={
                    !expanded && canCollapse
                      ? {
                          display: "-webkit-box",
                          WebkitLineClamp: PREVIEW_LINES,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }
                      : undefined
                  }
                >
                  {item.body}
                </p>

                {canCollapse ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.id)}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-medium text-[var(--slate-700)] transition-colors hover:bg-[var(--slate-100)] hover:text-[var(--slate-900)]"
                  >
                    {expanded ? "Ocultar comunicado" : "Ver comunicado completo"}
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                ) : null}
              </div>

              {item.attachments.length > 0 ? (
                <footer className="mt-4 border-t border-[var(--slate-200)] pt-3">
                  <div className="flex flex-wrap gap-2">
                    {item.attachments.map((attachment) => (
                      <a
                        key={`${item.id}-${attachment.url}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-[var(--slate-200)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--slate-700)] transition-colors hover:bg-[var(--slate-100)] hover:text-[var(--slate-900)]"
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText className="h-4 w-4" />
                        Ver documento
                      </a>
                    ))}
                  </div>
                </footer>
              ) : null}
            </article>
          );
        })}
      </div>
    </Card>
  );
}
