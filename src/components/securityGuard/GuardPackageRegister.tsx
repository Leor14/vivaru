"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { createGuardPackage } from "@/features/packages/use-packages";
import { CONDICIONES_DE_LLEGADA, type CondicionDeLlegada } from "@/features/packages/llegada-del-paquete";
import { usePackageDirectory } from "@/features/security-guard/use-package-directory";

export function GuardPackageRegister({ tenantId, userId, guardName }: { tenantId?: string; userId?: string; guardName?: string }) {
  const { towers, units, residentsByUnitId, loading: loadingDirectory, error: directoryError } = usePackageDirectory(tenantId);
  const [towerId, setTowerId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [residentId, setResidentId] = useState("");
  const [description, setDescription] = useState("");
  // `L-20`: la empresa es texto libre —la lista de transportadoras cambia por ciudad— y el estado de
  // llegada es vocabulario cerrado. **El estado es obligatorio y la empresa no**: es lo que la
  // administradora necesita para reclamar, es un toque, y preseleccionarlo «En buen estado» sería
  // afirmar por el guardia algo que no miró.
  const [carrier, setCarrier] = useState("");
  const [condition, setCondition] = useState<CondicionDeLlegada | "">("");
  const [saving, setSaving] = useState(false);

  const unitsByTower = useMemo(
    () => units.filter((item) => item.towerId === towerId),
    [towerId, units],
  );

  const residentsByUnit = useMemo(
    () => residentsByUnitId.get(unitId) ?? [],
    [residentsByUnitId, unitId],
  );

  const selectedUnit = useMemo(() => units.find((item) => item.id === unitId) ?? null, [units, unitId]);
  const selectedResident = useMemo(() => residentsByUnit.find((item) => item.id === residentId) ?? null, [residentsByUnit, residentId]);

  const canSubmit =
    Boolean(towerId && unitId && residentId && description.trim() && condition) &&
    !saving &&
    !loadingDirectory;

  function handleTowerChange(value: string) {
    setTowerId(value);
    setUnitId("");
    setResidentId("");
  }

  function handleUnitChange(value: string) {
    setUnitId(value);
    setResidentId("");
  }

  async function handleSubmit() {
    if (!tenantId || !userId) {
      toast.error("No se pudo identificar tu sesion para registrar paquetes.");
      return;
    }

    if (!selectedUnit || !selectedResident || !description.trim() || !towerId || !condition) {
      toast.error("Completa torre, unidad, residente, descripcion y estado de llegada.");
      return;
    }

    try {
      setSaving(true);
      await createGuardPackage({
        tenantId,
        userId,
        guardName,
        towerId,
        unitId: selectedUnit.id,
        unitLabel: selectedUnit.displayName,
        residentId: selectedResident.id,
        residentName: selectedResident.fullName,
        description,
        carrier,
        condition,
      });
      setTowerId("");
      setUnitId("");
      setResidentId("");
      setDescription("");
      setCarrier("");
      setCondition("");
      toast.success("Paquete registrado correctamente.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardTitle>Registrar paquete</CardTitle>
      <CardDescription className="mt-1">Flujo guiado para registrar paquetes sin errores operativos.</CardDescription>

      {directoryError ? <p className="mt-3 text-sm text-[var(--danger-700)]">{directoryError}</p> : null}

      <div className="mt-4 grid gap-3">
        <select
          value={towerId}
          onChange={(event) => handleTowerChange(event.target.value)}
          className="h-12 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)]"
          disabled={loadingDirectory || saving}
        >
          <option value="">Selecciona torre</option>
          {towers.map((towerOption) => (
            <option key={towerOption} value={towerOption}>{towerOption}</option>
          ))}
        </select>

        <select
          value={unitId}
          onChange={(event) => handleUnitChange(event.target.value)}
          className="h-12 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)] disabled:bg-[var(--slate-100)]"
          disabled={!towerId || saving}
        >
          <option value="">Selecciona unidad</option>
          {unitsByTower.map((unitOption) => (
            <option key={unitOption.id} value={unitOption.id}>{unitOption.displayName}</option>
          ))}
        </select>

        <select
          value={residentId}
          onChange={(event) => setResidentId(event.target.value)}
          className="h-12 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)] disabled:bg-[var(--slate-100)]"
          disabled={!unitId || saving}
        >
          <option value="">Selecciona residente</option>
          {residentsByUnit.map((residentOption) => (
            <option key={residentOption.id} value={residentOption.id}>{residentOption.fullName}</option>
          ))}
        </select>

        <input
          value={carrier}
          onChange={(event) => setCarrier(event.target.value)}
          placeholder="Empresa que lo deja (opcional): Servientrega, Rappi..."
          maxLength={60}
          disabled={saving}
          className="h-12 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)]"
        />

        <select
          value={condition}
          onChange={(event) => setCondition(event.target.value as CondicionDeLlegada | "")}
          className="h-12 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)]"
          disabled={saving}
        >
          <option value="">Estado en que llega</option>
          {CONDICIONES_DE_LLEGADA.map((opcion) => (
            <option key={opcion.clave} value={opcion.clave}>{opcion.etiqueta}</option>
          ))}
        </select>

        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ej: Caja Amazon, sobre, documento, etc."
          rows={3}
          maxLength={220}
        />
      </div>

      <Button className="mt-4 h-12 w-full px-6 text-base" onClick={() => void handleSubmit()} disabled={!canSubmit}>
        {saving ? "Registrando..." : "Registrar paquete"}
      </Button>
    </Card>
  );
}
