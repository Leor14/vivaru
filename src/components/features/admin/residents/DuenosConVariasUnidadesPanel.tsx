"use client";

import { useMemo } from "react";
import { Building2, Info } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  duenosConVariasUnidades,
  type PersonaDelPadron,
} from "@/features/residents/duenos-con-varias-unidades";
import { ETIQUETA_DE_TIPO } from "@/lib/units/tipos";
import type { PersonItem, UnitItem } from "@/features/admin/services";

/**
 * **`L-07` — ver juntas las unidades de un mismo dueño.** Lote «Análisis de la plataforma», pág. 3.
 *
 * **Es una lista para MIRAR: no tiene una sola acción, y eso es la decisión, no una carencia.**
 * El producto no modela dueños —cada registro de persona guarda UNA unidad—, así que esto junta
 * registros que *parecen* la misma persona. Ofrecer «fusionar» aquí sería ofrecer perder unidades:
 * es justo lo que hace el panel de duplicados de al lado, y por eso el aviso está en pantalla y no
 * solo en el código.
 */
export function DuenosConVariasUnidadesPanel({ people, units }: { people: PersonItem[]; units: UnitItem[] }) {
  const etiquetaPorUnidad = useMemo(() => {
    const mapa = new Map<string, string>();
    units.forEach((unidad) => {
      const tipo = ETIQUETA_DE_TIPO[unidad.type];
      mapa.set(unidad.id, tipo ? `${unidad.displayName} · ${tipo}` : unidad.displayName);
    });
    return mapa;
  }, [units]);

  const duenos = useMemo(() => {
    const comparables: PersonaDelPadron[] = people.map((persona) => ({
      id: persona.id,
      fullName: persona.fullName,
      documentNumber: persona.documentNumber,
      unitId: persona.unitId,
      unitLabel: etiquetaPorUnidad.get(persona.unitId) ?? persona.unitId,
      fusionadaEn: persona.fusionadaEn,
    }));
    return duenosConVariasUnidades(comparables);
  }, [people, etiquetaPorUnidad]);

  if (duenos.length === 0) return null;

  return (
    <Card>
      <CardTitle help="Junta los registros del padrón que parecen la misma persona y están en unidades distintas: el caso del propietario con apartamento, parqueadero y bodega. Es solo para consultar.">
        Dueños con varias unidades
      </CardTitle>
      <CardDescription className="mt-1">
        {duenos.length === 1
          ? "1 persona aparece en más de una unidad."
          : `${duenos.length} personas aparecen en más de una unidad.`}
      </CardDescription>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--slate-100)] p-3 text-sm text-[var(--slate-700)]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--slate-500)]" aria-hidden="true" />
        <p>
          Cada registro del padrón guarda una sola unidad, así que un dueño de tres unidades está tres
          veces. <strong>No los fusiones</strong> desde «Revisar duplicados»: la fusión conserva un
          registro y con él una sola unidad.
        </p>
      </div>

      <ul className="mt-3 grid gap-2">
        {duenos.map((dueno) => (
          <li key={dueno.clave} className="rounded-xl border border-[var(--slate-200)] p-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[var(--slate-500)]" aria-hidden="true" />
              <p className="font-medium text-[var(--slate-900)]">{dueno.nombre}</p>
              <span className="text-[11px] text-[var(--slate-500)]">
                {dueno.registros.length} unidades · agrupado por {dueno.por === "documento" ? "documento" : "nombre"}
              </span>
            </div>
            <ul className="mt-1 grid gap-0.5 pl-6 text-sm text-[var(--slate-700)]">
              {dueno.registros.map((registro) => (
                <li key={registro.personaId}>{registro.unidad}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  );
}
