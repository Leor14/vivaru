"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { mergeUnitsCallable } from "@/lib/firebase/callables";
import type { PersonItem, UnitItem } from "@/features/admin/services";

type Props = {
  tenantId?: string;
  units: UnitItem[];
  people: PersonItem[];
};

const norm = (value: string) => value.trim().toLowerCase();

export function DuplicateUnitsPanel({ tenantId, units, people }: Props) {
  const countPeople = (unit: UnitItem) =>
    people.filter((p) => p.unitId === unit.id || p.unitId === unit.unitId).length;

  // Agrupa unidades por nombre normalizado; deja solo los grupos con más de una.
  // Dentro de cada grupo, ordena por personas (desc) → la primera es la sugerida a conservar.
  const groups = useMemo(() => {
    const byName = new Map<string, UnitItem[]>();
    for (const unit of units) {
      const key = norm(unit.displayName || unit.id);
      const arr = byName.get(key) ?? [];
      arr.push(unit);
      byName.set(key, arr);
    }
    return Array.from(byName.entries())
      .filter(([, arr]) => arr.length > 1)
      .map(([key, arr]) => ({
        key,
        units: arr
          .slice()
          .sort((a, b) => countPeople(b) - countPeople(a)),
      }))
      .sort((a, b) => a.units[0].displayName.localeCompare(b.units[0].displayName, "es"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, people]);

  const [survivorByKey, setSurvivorByKey] = useState<Record<string, string>>({});
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  if (groups.length === 0) return null;

  async function handleMerge(key: string, groupUnits: UnitItem[]) {
    if (!tenantId) return;
    const survivorId = survivorByKey[key] ?? groupUnits[0].id;
    const duplicateIds = groupUnits.filter((u) => u.id !== survivorId).map((u) => u.id);
    if (duplicateIds.length === 0) return;
    setBusyKey(key);
    try {
      const res = await mergeUnitsCallable({ tenantId, survivorId, duplicateIds });
      toast.success(
        `Unidades fusionadas: ${res.merged} eliminada(s) y ${res.repointed} referencia(s) reasignadas.`,
      );
      setConfirmKey(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron fusionar las unidades.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Card className="soft-panel border border-amber-200 bg-amber-50/40">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
        <CardTitle>Unidades duplicadas</CardTitle>
      </div>
      <CardDescription className="mt-1">
        Hay unidades con el mismo nombre creadas más de una vez. Conserva una y fusiona las demás:
        sus personas, cobros, reservas y visitantes se reasignan a la unidad que conserves y las otras se eliminan.
      </CardDescription>

      <div className="mt-4 space-y-3">
        {groups.map(({ key, units: groupUnits }) => {
          const survivorId = survivorByKey[key] ?? groupUnits[0].id;
          const isConfirming = confirmKey === key;
          const isBusy = busyKey === key;
          return (
            <div key={key} className="rounded-xl border border-[var(--slate-200)] bg-white p-3">
              <p className="text-sm font-semibold text-[var(--slate-900)]">
                {groupUnits[0].displayName} <span className="font-normal text-[var(--slate-500)]">· {groupUnits.length} duplicadas</span>
              </p>
              <ul className="mt-2 space-y-1">
                {groupUnits.map((unit) => {
                  const isSurvivor = survivorId === unit.id;
                  return (
                    <li key={unit.id}>
                      <label className="flex items-center gap-2 text-sm text-[var(--slate-700)]">
                        <input
                          type="radio"
                          name={`survivor-${key}`}
                          checked={isSurvivor}
                          disabled={isBusy}
                          onChange={() => setSurvivorByKey((prev) => ({ ...prev, [key]: unit.id }))}
                        />
                        <span>
                          {unit.tower ? `${unit.tower} · ` : ""}
                          {countPeople(unit)} persona(s)
                        </span>
                        <span className={isSurvivor ? "text-emerald-700" : "text-[var(--danger-700)]"}>
                          {isSurvivor ? "se conserva" : "se elimina"}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              {isConfirming ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-800">
                    Se reasignarán cobros, personas, reservas y visitantes a la unidad conservada y se eliminarán las otras. Esta acción no se puede deshacer.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      className="bg-amber-600 text-white hover:bg-amber-700"
                      disabled={isBusy}
                      onClick={() => void handleMerge(key, groupUnits)}
                    >
                      {isBusy ? "Fusionando..." : "Confirmar fusión"}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => setConfirmKey(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setConfirmKey(key)}>
                  Fusionar
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
