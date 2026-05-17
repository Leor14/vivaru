"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, ChevronDown, ChevronUp, Phone, Store } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { useServices } from "@/features/services/use-services";
import type { ServiceItem } from "@/features/admin/services";

const CATEGORY_LABELS: Record<ServiceItem["category"], string> = {
  resident_offer: "Oferta residente",
  third_party: "Servicio externo",
};

const CATEGORY_STYLES: Record<ServiceItem["category"], string> = {
  resident_offer: "border-emerald-200 bg-emerald-50 text-emerald-700",
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
                ? "border-[var(--brand-700)] bg-[var(--brand-700)] text-white"
                : "border-[var(--slate-200)] bg-white text-[var(--slate-600)] hover:bg-[var(--slate-100)]"
            }`}
          >
            {cat === "all" ? "Todos" : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[var(--slate-200)] bg-white p-4 text-sm text-[var(--slate-600)]">
            Cargando servicios...
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-[var(--danger-200)] bg-[var(--danger-50)] p-3 text-sm text-[var(--danger-700)]">
            No se pudieron cargar los servicios: {error}
          </p>
        ) : null}

        {!loading && filteredItems.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--slate-300)] bg-white px-6 py-10 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--slate-100)] text-[var(--slate-500)]">
              <Store className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-[var(--slate-900)]">
              {categoryFilter === "all" ? "No hay servicios disponibles" : `No hay ${CATEGORY_LABELS[categoryFilter].toLowerCase()} disponibles`}
            </h3>
            <p className="mt-1 max-w-md text-sm leading-6 text-[var(--slate-600)]">
              Cuando la administracion publique servicios, apareceran aqui.
            </p>
          </div>
        ) : null}

        {filteredItems.map((item) => {
          const expanded = Boolean(expandedById[item.id]);
          const canCollapse = shouldTruncate(item.description);
          const contact = formatContact(item.providerContact);

          return (
            <article
              key={item.id}
              className="group relative overflow-hidden rounded-2xl border border-[var(--slate-200)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
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
                      className="mt-1.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-medium text-[var(--slate-700)] transition-colors hover:bg-[var(--slate-100)] hover:text-[var(--slate-900)]"
                    >
                      {expanded ? "Ocultar" : "Ver mas"}
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  ) : null}
                </div>

                {/* Attachment */}
                {item.attachmentUrl ? (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--slate-500)]">Información adicional</p>
                    {item.attachmentName?.toLowerCase().endsWith(".pdf") ? (
                      <a
                        href={item.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-2 text-sm font-medium text-[var(--brand-700)] transition-colors hover:bg-[var(--brand-100)]"
                      >
                        📄 {item.attachmentName}
                      </a>
                    ) : (
                      <img
                        src={item.attachmentUrl}
                        alt={item.attachmentName ?? "Información adicional"}
                        className="max-h-64 w-full rounded-xl object-contain"
                      />
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
    </Card>
  );
}
