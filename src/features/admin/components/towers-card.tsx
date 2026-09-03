"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  saveAgrupaciones,
  watchTenantSettings,
  watchUnits,
  type UnitItem,
} from "@/features/admin/services";
import { useAuth } from "@/features/auth/auth-context";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import { DEFAULT_TOWER, distinctTowers, normalizeTower } from "@/utils/tower";

/**
 * CRUD de la lista canónica de agrupaciones (torres / bloques / manzanas).
 *
 * La lista vive en `tenantSettings.agrupaciones` y es la fuente de verdad del
 * selector "Agrupación" al crear/editar unidades — el campo dejó de ser texto
 * libre porque las variantes (`T1` / `torre 1` / `torre1`) fragmentaban KPIs
 * y filtros. Eliminar una agrupación de la lista NO modifica las unidades
 * existentes; solo deja de ofrecerse para nuevas.
 */
export function TowersCard() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const [agrupaciones, setAgrupaciones] = useState<string[] | null>(null);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const unsubSettings = watchTenantSettings(
      tenantId,
      (item) => setAgrupaciones(item?.agrupaciones ?? null),
      () => {},
    );
    const unsubUnits = watchUnits(tenantId, setUnits, () => {});
    return () => {
      unsubSettings();
      unsubUnits();
    };
  }, [tenantId]);

  /** Cuántas unidades usan cada agrupación (comparando en forma canónica). */
  const usageByTower = useMemo(() => {
    const map = new Map<string, number>();
    for (const unit of units) {
      const canonical = normalizeTower(unit.tower);
      if (canonical) map.set(canonical, (map.get(canonical) ?? 0) + 1);
    }
    return map;
  }, [units]);

  const fromUnits = useMemo(() => distinctTowers(units.map((u) => u.tower)), [units]);
  const list = agrupaciones ?? [];

  async function persist(next: string[]) {
    if (!tenantId || !user) return;
    setSaving(true);
    try {
      await saveAgrupaciones(tenantId, user.uid, next);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    const canonical = normalizeTower(newValue);
    if (!canonical) {
      toast.error("Escribe un nombre de agrupación.");
      return;
    }
    if (list.includes(canonical)) {
      toast.error(`"${canonical}" ya está en la lista.`);
      return;
    }
    await persist([...list, canonical].sort((a, b) => a.localeCompare(b, "es-CO", { numeric: true })));
    setNewValue("");
    toast.success(`Agrupación "${canonical}" agregada.`);
  }

  async function handleRemove(value: string) {
    const inUse = usageByTower.get(value) ?? 0;
    if (inUse > 0) {
      toast.error(`"${value}" está en uso por ${inUse} unidad(es). Reasígnalas antes de quitarla.`);
      return;
    }
    await persist(list.filter((item) => item !== value));
    toast.success(`Agrupación "${value}" eliminada de la lista.`);
  }

  async function handleImportFromUnits() {
    const seed = fromUnits.length > 0 ? fromUnits : [DEFAULT_TOWER];
    await persist(seed);
    toast.success(`Se importaron ${seed.length} agrupación(es) desde las unidades existentes.`);
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[var(--success-600)]" aria-hidden />
            Torres y agrupaciones
          </CardTitle>
          <CardDescription className="mt-1">
            Lista oficial de torres, bloques o manzanas del conjunto. Al crear una unidad se elige de
            esta lista, para que los filtros y reportes no se fragmenten por variantes del mismo nombre.
          </CardDescription>
        </div>
      </div>

      {agrupaciones === null ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--slate-300)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--slate-600)]">
          <p>
            Aún no hay una lista definida.{" "}
            {fromUnits.length > 0
              ? `Detectamos ${fromUnits.length} agrupación(es) en las unidades existentes.`
              : `Puedes empezar con "${DEFAULT_TOWER}" si el conjunto tiene un solo bloque.`}
          </p>
          <Button className="mt-3" type="button" variant="outline" onClick={handleImportFromUnits} disabled={saving}>
            {fromUnits.length > 0 ? "Importar desde unidades existentes" : `Crear "${DEFAULT_TOWER}"`}
          </Button>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {list.length === 0 ? (
            <li className="text-sm text-[var(--slate-500)]">La lista está vacía. Agrega la primera agrupación abajo.</li>
          ) : (
            list.map((item) => {
              const count = usageByTower.get(item) ?? 0;
              return (
                <li
                  key={item}
                  className="flex items-center justify-between rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] px-3 py-2"
                >
                  <span className="text-sm font-medium text-[var(--slate-900)]">
                    {item}
                    <span className="ml-2 text-xs font-normal text-[var(--slate-500)]">
                      {count === 1 ? "1 unidad" : `${count} unidades`}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-2 text-[var(--slate-500)] hover:text-[var(--danger-700)]"
                    onClick={() => handleRemove(item)}
                    disabled={saving}
                    aria-label={`Quitar ${item} de la lista`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })
          )}
        </ul>
      )}

      <div className="mt-4 flex gap-2">
        <Input
          value={newValue}
          onChange={(event) => setNewValue(event.target.value)}
          placeholder="Ej: Torre 3, Bloque B, Manzana 5…"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleAdd();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={handleAdd} disabled={saving || !newValue.trim()}>
          <Plus className="mr-1 h-4 w-4" />
          Agregar
        </Button>
      </div>
    </Card>
  );
}
