"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { agruparConjuntosPorAdministradora } from "@/features/superadmin/conjuntos-por-administradora";
import type { TenantWorkspaceItem } from "@/features/superadmin/services";

type Props = {
  conjuntos: TenantWorkspaceItem[];
  marcados: string[];
  onChange: (tenantIds: string[]) => void;
  disabled?: boolean;
};

/**
 * `PRD-V-PLAT-002` entrega 2 · «Conjuntos con acceso» de un administrador.
 *
 * Una casilla por conjunto, agrupadas por administradora, con «Marcar los N de …» como
 * **atajo**: solo marca casillas. No crea un vínculo persona–administradora ni da acceso
 * a los conjuntos que se le asocien después (E2-R10, R6 y R7 de la ficha).
 */
export function ConjuntosConAcceso({ conjuntos, marcados, onChange, disabled }: Props) {
  const grupos = useMemo(() => agruparConjuntosPorAdministradora(conjuntos), [conjuntos]);
  const marcadosSet = new Set(marcados);

  function alternar(id: string) {
    onChange(marcadosSet.has(id) ? marcados.filter((m) => m !== id) : [...marcados, id]);
  }

  function marcarGrupo(ids: string[]) {
    onChange([...new Set([...marcados, ...ids])]);
  }

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-1 block text-sm text-[var(--slate-700)]">Conjuntos con acceso</legend>
      <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-[var(--slate-200)] p-3">
        {grupos.length === 0 ? <p className="text-sm text-[var(--slate-500)]">No hay conjuntos.</p> : null}
        {grupos.map((grupo) => {
          const ids = grupo.conjuntos.map((conjunto) => conjunto.id);
          const sinMarcar = ids.filter((id) => !marcadosSet.has(id)).length;
          return (
            <div key={grupo.administradora?.id ?? "_sin-administradora"} className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">
                  {grupo.administradora?.nombre ?? "Sin administradora"}
                </p>
                {grupo.administradora && sinMarcar > 0 ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => marcarGrupo(ids)}>
                    Marcar los {ids.length} de {grupo.administradora.nombre}
                  </Button>
                ) : null}
              </div>
              {grupo.conjuntos.map((conjunto) => (
                <label key={conjunto.id} className="flex items-center gap-2 text-sm text-[var(--slate-800)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={marcadosSet.has(conjunto.id)}
                    onChange={() => alternar(conjunto.id)}
                  />
                  <span>{conjunto.name}</span>
                  {conjunto.status !== "active" ? (
                    <span className="text-xs text-[var(--slate-500)]">({conjunto.status})</span>
                  ) : null}
                </label>
              ))}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-[var(--slate-500)]">
        La administradora solo marca sus conjuntos: no da acceso a los que se le asocien después.
      </p>
    </fieldset>
  );
}
