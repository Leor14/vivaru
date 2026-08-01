"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Mail, Phone } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { TablePager } from "@/components/shared/table-pager";
import { usePagination } from "@/components/shared/use-pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase/client";

/**
 * Bandeja de leads del landing y de los ambientes de prueba.
 *
 * Hasta la Fase 0 los leads solo se mandaban por correo y se perdían: no había
 * forma de saber cuántos entraron ni de atribuirlos. Ahora se persisten, y esta
 * pantalla es donde el equipo comercial los trabaja.
 */

type Lead = {
  id: string;
  origen?: string;
  nombre?: string;
  email?: string;
  telefono?: string;
  empresa?: string;
  ciudad?: string;
  pais?: string;
  unidadesEstimadas?: string | number;
  timeline?: string;
  status?: string;
  tenantId?: string;
  appEnv?: string;
  createdAt?: string;
  meta?: { score?: number; pilarDolor?: string; tierSugerido?: string };
};

const ORIGIN_META: Record<string, { label: string; className: string }> = {
  trial: { label: "Prueba 15 días", className: "bg-emerald-100 text-emerald-700" },
  demo: { label: "Pidió asesor", className: "bg-sky-100 text-sky-700" },
  diagnostico: { label: "Diagnóstico", className: "bg-amber-100 text-amber-700" },
};

const TIMELINE_LABEL: Record<string, string> = {
  "30dias": "Próximos 30 días",
  trimestre: "Este trimestre",
  anio: "Este año",
  investigando: "Explorando",
};

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SuperadminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [originFilter, setOriginFilter] = useState<"all" | "trial" | "demo" | "diagnostico">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, "leads"), orderBy("createdAt", "desc"), limit(200)),
      (snap) => {
        setLeads(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lead, "id">) })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (originFilter !== "all" && lead.origen !== originFilter) return false;
      if (!q) return true;
      return `${lead.nombre} ${lead.email} ${lead.empresa} ${lead.ciudad}`.toLowerCase().includes(q);
    });
  }, [leads, originFilter, search]);

  const pager = usePagination(filtered);

  // Los leads que levantaron un ambiente son los más calificados: no llenaron
  // un formulario, probaron el producto.
  const conTrial = useMemo(() => leads.filter((l) => l.tenantId).length, [leads]);

  return (
    <Card>
      <CardTitle help="Prospectos capturados por los formularios del landing y por los ambientes de prueba. Los que levantaron una prueba están calificados por uso real, no por un formulario.">
        Leads
      </CardTitle>
      <CardDescription className="mt-1">
        {loading ? "Cargando…" : `${leads.length} lead(s) · ${conTrial} levantaron un ambiente de prueba`}
      </CardDescription>

      <div className="mt-4">
        <MobileFiltersPanel
          title="Filtros de leads"
          collapsibleOnDesktop
          defaultOpen={false}
          activeFiltersCount={(originFilter !== "all" ? 1 : 0) + (search ? 1 : 0)}
          onClear={() => {
            setOriginFilter("all");
            setSearch("");
          }}
        >
          <label className="text-sm text-[var(--slate-700)]">
            Origen
            <select
              className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value as typeof originFilter)}
            >
              <option value="all">Todos</option>
              <option value="trial">Prueba de 15 días</option>
              <option value="demo">Pidió asesor</option>
              <option value="diagnostico">Diagnóstico</option>
            </select>
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Buscar
            <Input className="mt-1" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, correo, conjunto…" />
          </label>
        </MobileFiltersPanel>
      </div>

      {!loading && filtered.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Sin leads"
            description="Aquí aparecerán los prospectos del landing y quienes levanten un ambiente de prueba."
          />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--slate-200)]">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[var(--slate-100)] text-left text-[var(--slate-700)]">
              <tr>
                <th className="px-3 py-2 font-medium">Prospecto</th>
                <th className="px-3 py-2 font-medium">Conjunto</th>
                <th className="px-3 py-2 font-medium">Contacto</th>
                <th className="px-3 py-2 font-medium">Origen</th>
                <th className="px-3 py-2 font-medium">Interés</th>
                <th className="px-3 py-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {pager.pageItems.map((lead) => {
                const origin = ORIGIN_META[lead.origen ?? ""] ?? { label: lead.origen ?? "—", className: "" };
                return (
                  <tr key={lead.id} className="border-t border-[var(--slate-200)] align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium text-[var(--slate-900)]">{lead.nombre ?? "—"}</p>
                      {lead.appEnv && lead.appEnv !== "production" ? (
                        <span className="text-[11px] font-semibold uppercase text-[var(--danger-700)]">
                          {lead.appEnv}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-[var(--slate-700)]">
                      <p>{lead.empresa ?? "—"}</p>
                      <p className="text-[11px] text-[var(--slate-500)]">
                        {[lead.ciudad, lead.unidadesEstimadas ? `${lead.unidadesEstimadas} unidades` : null]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-[var(--slate-700)]">
                      {lead.email ? (
                        <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 text-[var(--brand-700)] hover:underline">
                          <Mail className="h-3 w-3" /> {lead.email}
                        </a>
                      ) : null}
                      {lead.telefono ? (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[var(--slate-500)]">
                          <Phone className="h-3 w-3" /> {lead.telefono}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={origin.className}>{origin.label}</Badge>
                      {lead.tenantId ? (
                        <p className="mt-1 text-[11px] text-[var(--slate-500)]" title={lead.tenantId}>
                          ambiente ···{lead.tenantId.slice(-6)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-[var(--slate-700)]">
                      {lead.timeline ? TIMELINE_LABEL[lead.timeline] ?? lead.timeline : "—"}
                      {lead.meta?.score != null ? (
                        <p className="text-[11px] text-[var(--slate-500)]">Score {lead.meta.score}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-[var(--slate-600)]">{formatDate(lead.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pager.hasPagination ? (
        <TablePager
          page={pager.page}
          totalPages={pager.totalPages}
          total={pager.total}
          start={pager.start}
          pageSize={pager.pageSize}
          onPrev={pager.prev}
          onNext={pager.next}
          onPageSizeChange={pager.setPageSize}
        />
      ) : null}
    </Card>
  );
}
