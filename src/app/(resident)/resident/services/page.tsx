"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BriefcaseBusiness, ChevronDown, ChevronUp, Expand, FileText, Phone, Store, X } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useServices } from "@/features/services/use-services";
import type { ServiceItem } from "@/features/admin/services";

const CATEGORY_LABELS: Record<ServiceItem["category"], string> = {
  resident_offer: "Oferta residente",
  third_party: "Servicio externo",
};

const CATEGORY_STYLES: Record<ServiceItem["category"], string> = {
  resident_offer: "border-[var(--success-200)] bg-[var(--success-50)] text-[var(--success-700)]",
  third_party: "border-[var(--brand-200)] bg-[var(--brand-50)] text-[var(--brand-700)]",
};

const PREVIEW_LENGTH = 200;

function shouldTruncate(text: string) {
  return text.trim().length > PREVIEW_LENGTH;
}

function formatContact(contact: string) {
  const trimmed = contact.trim();
  if (/^[+\d\s\-()]{7,}$/.test(trimmed)) {
    return { href: `tel:${trimmed.replace(/\s/g, "")}`, label: trimmed };
  }
  if (trimmed.includes("@")) {
    return { href: `mailto:${trimmed}`, label: trimmed };
  }
  return { href: null, label: trimmed };
}

export default function ResidentServicesPage() {
  const { user } = useAuth();
  const { items, loading, error } = useServices(user?.tenantId);
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [categoryFilter, setCategoryFilter] = useState<"all" | ServiceItem["category"]>("all");
  // Lightbox state: `content` holds the last seen item so the exit animation
  // can still render it while fading out. `open` drives the CSS data-open attr.
  const [lightboxContent, setLightboxContent] = useState<{ url: string; name: string } | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openLightbox = useCallback((url: string, name: string) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setLightboxContent({ url, name });
    // Small rAF delay so the browser renders the element before animating in
    requestAnimationFrame(() => setLightboxOpen(true));
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    // Wait for exit animation (180ms backdrop + a bit of margin) then unmount
    closeTimerRef.current = setTimeout(() => setLightboxContent(null), 220);
  }, []);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const filteredItems = useMemo(() => {
    if (categoryFilter === "all") return items;
    return items.filter((item) => item.category === categoryFilter);
  }, [items, categoryFilter]);

  const toggleExpanded = (id: string) => {
    setExpandedById((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <Card className="border border-[var(--slate-200)] bg-[var(--slate-50)]/40 p-4 sm:p-6">
      <div className="border-b border-[var(--slate-200)] pb-4">
        <CardTitle className="text-xl font-semibold tracking-tight text-[var(--slate-900)]">
          Servicios comunitarios
        </CardTitle>
        <CardDescription className="mt-1 text-sm text-[var(--slate-600)]">
          Directorio de servicios disponibles para la comunidad.
        </CardDescription>
      </div>

      {/* Category filter tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "resident_offer", "third_party"] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              categoryFilter === cat
                ? "border-[var(--brand-700)] bg-[var(--brand-700)] text-[var(--on-fill)]"
                : "border-[var(--slate-200)] bg-[var(--surface-strong)] text-[var(--slate-600)] hover:bg-[var(--slate-100)]"
            }`}
          >
            {cat === "all" ? "Todos" : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* key=categoryFilter forces re-mount → CSS stagger animations restart on filter change */}
      <div key={categoryFilter} className="mt-5 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)]">
                <Skeleton className="h-36 w-full rounded-none sm:h-44" />
                <div className="space-y-2 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-20 rounded-full" />
                    <Skeleton className="h-3 w-16 rounded-sm" />
                  </div>
                  <Skeleton className="h-5 w-48 rounded-sm" />
                  <Skeleton className="h-4 w-full rounded-sm" />
                  <Skeleton className="h-4 w-4/5 rounded-sm" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-[var(--danger-200)] bg-[var(--danger-50)] p-3 text-sm text-[var(--danger-700)]">
            No se pudieron cargar los servicios: {error}
          </p>
        ) : null}

        {!loading && filteredItems.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--slate-300)] bg-[var(--surface-strong)] px-6 py-10 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--slate-100)] text-[var(--slate-500)]">
              <Store className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-[var(--slate-900)]">
              {categoryFilter === "all" ? "No hay servicios disponibles" : `No hay ${CATEGORY_LABELS[categoryFilter].toLowerCase()} disponibles`}
            </h3>
            <p className="mt-1 max-w-[28rem] text-sm leading-6 text-[var(--slate-600)]">
              Cuando la administración publique servicios, aparecerán aquí.
            </p>
          </div>
        ) : null}

        {filteredItems.map((item, index) => {
          const expanded = Boolean(expandedById[item.id]);
          const canCollapse = shouldTruncate(item.description);
          const contact = formatContact(item.providerContact);

          return (
            <article
              key={item.id}
              className="service-card service-card-stagger group relative overflow-hidden rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)] shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
              style={{ animationDelay: `${Math.min(index * 50, 200)}ms` }}
            >
              {/* Image */}
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="h-36 w-full object-cover sm:h-44"
                />
              ) : (
                <div className="flex h-20 items-center justify-center bg-[var(--slate-100)]">
                  {item.category === "resident_offer" ? (
                    <BriefcaseBusiness className="h-7 w-7 text-[var(--slate-400)]" />
                  ) : (
                    <Store className="h-7 w-7 text-[var(--slate-400)]" />
                  )}
                </div>
              )}

              <div className="p-4 sm:p-5">
                {/* Category + type */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${CATEGORY_STYLES[item.category]}`}
                  >
                    {CATEGORY_LABELS[item.category]}
                  </span>
                  <span className="text-[11px] text-[var(--slate-500)]">{item.serviceType}</span>
                </div>

                {/* Title */}
                <h3 className="mt-2 text-base font-semibold leading-6 text-[var(--slate-900)] sm:text-lg">
                  {item.title}
                </h3>

                {/* Description */}
                <div className="mt-2">
                  <p
                    className="whitespace-pre-wrap text-sm leading-7 text-[var(--slate-700)]"
                    style={
                      !expanded && canCollapse
                        ? {
                            display: "-webkit-box",
                            WebkitLineClamp: 4,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }
                        : undefined
                    }
                  >
                    {item.description}
                  </p>
                  {canCollapse ? (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(item.id)}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-medium text-[var(--slate-700)] [transition:background-color_150ms_ease-out,transform_120ms_ease-out] active:scale-[0.97] hover:bg-[var(--slate-100)] hover:text-[var(--slate-900)]"
                    >
                      {expanded ? "Ocultar" : "Ver mas"}
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  ) : null}
                </div>

                {/* Attachment — thumbnail chip, expands to lightbox on click */}
                {item.attachmentUrl ? (
                  <div className="mt-3">
                    {item.attachmentName?.toLowerCase().endsWith(".pdf") ? (
                      <a
                        href={item.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--slate-200)] bg-[var(--slate-50)] px-2.5 py-1.5 text-xs font-medium text-[var(--slate-700)] transition-colors hover:bg-[var(--slate-100)]"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--brand-600)]" />
                        <span className="max-w-[160px] truncate">{item.attachmentName}</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openLightbox(item.attachmentUrl!, item.attachmentName ?? "Información adicional")}
                        className="group relative inline-flex items-end overflow-hidden rounded-lg border border-[var(--slate-200)] bg-[var(--slate-50)] transition-shadow hover:shadow-md"
                        aria-label="Ver información adicional"
                      >
                        <img
                          src={item.attachmentUrl}
                          alt={item.attachmentName ?? "Información adicional"}
                          className="h-16 w-24 object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-[var(--overlay)]/0 [transition:background-color_150ms_var(--ease-out,ease)] group-hover:bg-[var(--overlay)]/20">
                          <Expand className="h-4 w-4 text-[var(--on-fill)] opacity-0 drop-shadow-md transition-opacity group-hover:opacity-100" />
                        </span>
                        <span className="absolute bottom-0 left-0 right-0 bg-[var(--overlay)]/40 px-1.5 py-0.5 text-[10px] font-medium text-[var(--on-fill)]">
                          Ver más
                        </span>
                      </button>
                    )}
                  </div>
                ) : null}

                {/* Provider info */}
                <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--slate-100)] pt-3">
                  <div>
                    <p className="text-xs text-[var(--slate-500)]">Proveedor</p>
                    <p className="text-sm font-medium text-[var(--slate-900)]">{item.providerName}</p>
                  </div>
                  {contact.href ? (
                    <a
                      href={contact.href}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-1.5 text-sm font-medium text-[var(--brand-700)] transition-colors hover:bg-[var(--brand-100)]"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {contact.label}
                    </a>
                  ) : (
                    <span className="text-sm text-[var(--slate-700)]">{contact.label}</span>
                  )}
                </footer>
              </div>
            </article>
          );
        })}
      </div>

      {/* Lightbox — animates in on open, fades out before unmounting */}
      {lightboxContent ? (
        <div
          className="lightbox-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
          data-open={lightboxOpen ? "true" : "false"}
          role="dialog"
          aria-modal="true"
          aria-label={lightboxContent.name}
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--on-fill)]/10 text-[var(--on-fill)] backdrop-blur-sm [transition:background-color_150ms_ease-out] hover:bg-[var(--on-fill)]/20"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxContent.url}
            alt={lightboxContent.name}
            className="lightbox-image max-h-[88vh] max-w-full rounded-xl object-contain shadow-2xl"
            data-open={lightboxOpen ? "true" : "false"}
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[var(--overlay)]/50 px-3 py-1 text-xs text-[var(--on-fill)]/80 backdrop-blur-sm">
            {lightboxContent.name}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
