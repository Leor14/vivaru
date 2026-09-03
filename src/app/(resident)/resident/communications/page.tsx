"use client";

import { useMemo, useState } from "react";
import { BellOff, CalendarDays, ChevronDown, ChevronUp, Dot, FileText } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useCommunications } from "@/features/communications/use-communications";
import { useModuleVariant } from "@/lib/config/use-module-variant";

const PREVIEW_LINES = 5;

// ─── Attachment helpers ───────────────────────────────────────────────────────

const EXT_CONFIG: Record<string, { colorCls: string; badge: string; badgeCls: string }> = {
  pdf:  { colorCls: "text-[var(--danger-500)]",      badge: "PDF",  badgeCls: "bg-[var(--danger-50)] text-[var(--danger-600)]" },
  doc:  { colorCls: "text-[var(--categoria-blue-600)]",     badge: "DOC",  badgeCls: "bg-[var(--categoria-blue-50)] text-[var(--categoria-blue-700)]" },
  docx: { colorCls: "text-[var(--categoria-blue-600)]",     badge: "DOCX", badgeCls: "bg-[var(--categoria-blue-50)] text-[var(--categoria-blue-700)]" },
  xls:  { colorCls: "text-[var(--success-600)]",  badge: "XLS",  badgeCls: "bg-[var(--success-50)] text-[var(--success-700)]" },
  xlsx: { colorCls: "text-[var(--success-600)]",  badge: "XLSX", badgeCls: "bg-[var(--success-50)] text-[var(--success-700)]" },
  csv:  { colorCls: "text-[var(--success-600)]",  badge: "CSV",  badgeCls: "bg-[var(--success-50)] text-[var(--success-700)]" },
  ppt:  { colorCls: "text-[var(--categoria-orange-500)]",   badge: "PPT",  badgeCls: "bg-[var(--categoria-orange-50)] text-[var(--categoria-orange-700)]" },
  pptx: { colorCls: "text-[var(--categoria-orange-500)]",   badge: "PPTX", badgeCls: "bg-[var(--categoria-orange-50)] text-[var(--categoria-orange-700)]" },
  jpg:  { colorCls: "text-[var(--info-500)]",      badge: "IMG",  badgeCls: "bg-[var(--info-50)] text-[var(--info-700)]" },
  jpeg: { colorCls: "text-[var(--info-500)]",      badge: "IMG",  badgeCls: "bg-[var(--info-50)] text-[var(--info-700)]" },
  png:  { colorCls: "text-[var(--info-500)]",      badge: "PNG",  badgeCls: "bg-[var(--info-50)] text-[var(--info-700)]" },
  gif:  { colorCls: "text-[var(--info-500)]",      badge: "GIF",  badgeCls: "bg-[var(--info-50)] text-[var(--info-700)]" },
  webp: { colorCls: "text-[var(--info-500)]",      badge: "IMG",  badgeCls: "bg-[var(--info-50)] text-[var(--info-700)]" },
  zip:  { colorCls: "text-[var(--amber-600)]",    badge: "ZIP",  badgeCls: "bg-[var(--amber-50)] text-[var(--amber-700)]" },
  rar:  { colorCls: "text-[var(--amber-600)]",    badge: "RAR",  badgeCls: "bg-[var(--amber-50)] text-[var(--amber-700)]" },
};

function getAttachmentMeta(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_CONFIG[ext] ?? {
    colorCls: "text-[var(--slate-500)]",
    badge: ext.toUpperCase() || "DOC",
    badgeCls: "bg-[var(--slate-100)] text-[var(--slate-600)]",
  };
}

function getAttachmentDisplayName(name: string): string {
  if (!name || name === "Adjunto") return "Ver adjunto";
  return name.replace(/\.[^/.]+$/, "");
}

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
  const isSimpleMode = useModuleVariant(user?.tenantId, "communications") === "tablon_simple";
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  // Audiencia segmentada (VIV-401): un comunicado con audienceUnitIds solo lo
  // ve el residente cuya unidad está incluida; sin lista = todo el conjunto.
  const feedItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.audienceUnitIds.length === 0 ||
          (user?.unitId ? item.audienceUnitIds.includes(user.unitId) : false),
      ),
    [items, user?.unitId],
  );

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
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-5 w-40 rounded-sm" />
                    <Skeleton className="h-3 w-24 rounded-sm" />
                  </div>
                  <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                </div>
                <div className="mt-3 space-y-1.5">
                  <Skeleton className="h-4 w-full rounded-sm" />
                  <Skeleton className="h-4 w-4/5 rounded-sm" />
                  <Skeleton className="h-4 w-3/5 rounded-sm" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-[var(--danger-200)] bg-[var(--danger-50)] p-3 text-sm text-[var(--danger-700)]">
            No se pudieron cargar las comunicaciones: {error}
          </p>
        ) : null}

        {!loading && feedItems.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--slate-300)] bg-[var(--surface-strong)] px-6 py-10 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--slate-100)] text-[var(--slate-500)]">
              <BellOff className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-[var(--slate-900)]">No hay comunicados vigentes</h3>
            <p className="mt-1 max-w-[28rem] text-sm leading-6 text-[var(--slate-600)]">
              Cuando la administración publique información, aparecerá aquí.
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
              className="group relative rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4 shadow-[var(--sombra-plana-1)] premium-card-hover sm:p-5"
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
                    {!isSimpleMode && endLabel ? (
                      <>
                        <Dot className="h-3.5 w-3.5" />
                        <span>Vigente hasta {endLabel}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                {isRecent ? (
                  <span className="shrink-0 rounded-full border border-[var(--success-200)] bg-[var(--success-50)] px-2 py-0.5 text-[11px] font-medium text-[var(--success-700)]">
                    Nuevo
                  </span>
                ) : null}
              </header>

              <div className="mt-3">
                <p
                  className="whitespace-pre-wrap text-sm leading-7 text-[var(--slate-700)] sm:text-[15px]"
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
                    {item.attachments.map((attachment) => {
                      const { colorCls, badge, badgeCls } = getAttachmentMeta(attachment.name);
                      const displayName = getAttachmentDisplayName(attachment.name);
                      return (
                        <a
                          key={`${item.id}-${attachment.url}`}
                          className="inline-flex max-w-[200px] items-center gap-2 rounded-lg border border-[var(--slate-200)] bg-[var(--surface-strong)] px-3 py-1.5 text-sm font-medium text-[var(--slate-700)] [transition:background-color_150ms_ease-out] hover:bg-[var(--slate-100)] hover:text-[var(--slate-900)]"
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileText className={`h-4 w-4 shrink-0 ${colorCls}`} aria-hidden="true" />
                          <span className="truncate">{displayName}</span>
                          <span className={`shrink-0 rounded-sm px-1 py-0.5 text-[10px] font-semibold ${badgeCls}`}>
                            {badge}
                          </span>
                        </a>
                      );
                    })}
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
