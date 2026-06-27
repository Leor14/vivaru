"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { toast } from "sonner";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase/client";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import {
  DEFAULT_MODULE_VARIANTS,
  MODULE_VARIANT_META,
  VARIANT_EDITABILITY,
  withVariantDefaults,
  type ModuleVariantKey,
  type ModuleVariants,
} from "@/lib/config/module-variants";

type PendingChange = { key: ModuleVariantKey; value: string; label: string };

export function ModuleVariantsCard({ tenantId }: { tenantId?: string }) {
  const [variants, setVariants] = useState<ModuleVariants>(DEFAULT_MODULE_VARIANTS);
  const [saving, setSaving] = useState<ModuleVariantKey | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(null);

  useEffect(() => {
    if (!tenantId || !db) return;

    const unsub = onSnapshot(doc(db, "tenantSettings", tenantId), (snap) => {
      if (!snap.exists()) {
        setVariants(DEFAULT_MODULE_VARIANTS);
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      const raw =
        typeof data.moduleVariants === "object" && data.moduleVariants
          ? (data.moduleVariants as Partial<ModuleVariants>)
          : null;
      setVariants(withVariantDefaults(raw));
    });

    return unsub;
  }, [tenantId]);

  async function applyChange(key: ModuleVariantKey, value: string) {
    if (!tenantId || !db) return;
    setSaving(key);
    try {
      // setDoc con merge: el doc puede no existir aún en conjuntos creados antes de esta función.
      await setDoc(doc(db, "tenantSettings", tenantId), { moduleVariants: { [key]: value } }, { merge: true });
      const label = MODULE_VARIANT_META.find((m) => m.key === key)?.label ?? key;
      toast.success(`Modo de "${label}" actualizado.`);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(null);
    }
  }

  function handleSelect(key: ModuleVariantKey, value: string) {
    if (value === variants[key]) return;
    const editability = VARIANT_EDITABILITY[key];
    if (editability === "locked") return; // no debería llegar (select deshabilitado)
    if (editability === "warn") {
      const label = MODULE_VARIANT_META.find((m) => m.key === key)?.label ?? key;
      setPending({ key, value, label });
      return;
    }
    void applyChange(key, value);
  }

  return (
    <>
      <Card>
        <CardTitle help="Define el modo de operación de cada módulo para este conjunto. Cambiar de modo altera el flujo (portería, residente, admin), no solo la visibilidad. Finanzas y Gobernanza se fijan al crear el conjunto.">
          Modos de operación
        </CardTitle>
        <CardDescription className="mt-1">
          Elige cómo opera cada módulo. Algunos modos solo pueden definirse al crear el conjunto.
        </CardDescription>

        <div className="mt-4 space-y-4">
          {MODULE_VARIANT_META.map((mod) => {
            const editability = VARIANT_EDITABILITY[mod.key];
            const locked = editability === "locked";
            const current = variants[mod.key];
            const currentMeta = mod.options.find((opt) => opt.value === current);
            const isSaving = saving === mod.key;
            return (
              <div key={mod.key}>
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--slate-900)]">{mod.label}</p>
                  {locked ? (
                    <span className="rounded-full bg-[var(--slate-200)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--slate-600)]">
                      se fija al crear
                    </span>
                  ) : editability === "warn" ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                      cambio con aviso
                    </span>
                  ) : null}
                </div>
                <select
                  className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-[var(--slate-50)] disabled:text-[var(--slate-500)]"
                  value={current}
                  disabled={locked || isSaving}
                  onChange={(e) => handleSelect(mod.key, e.target.value)}
                >
                  {mod.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {currentMeta ? (
                  <p className="mt-1 text-xs text-[var(--slate-500)]">{currentMeta.description}</p>
                ) : null}
                {locked ? (
                  <p className="mt-1 text-xs text-[var(--slate-400)]">
                    Para cambiar este modo, contacta a soporte.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Modal
        open={pending !== null}
        title={`Cambiar el modo de "${pending?.label ?? ""}"`}
        onClose={() => setPending(null)}
      >
        <p className="text-sm text-[var(--slate-600)]">
          Cambiar el modo altera cómo opera el módulo de aquí en adelante. Los registros ya
          existentes en el modo anterior (por ejemplo, autorizaciones o códigos QR activos) podrían
          quedar sin uso. ¿Quieres continuar?
        </p>
        <div className="mobile-action-group mt-4">
          <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setPending(null)}>
            Cancelar
          </Button>
          <Button
            className="w-full sm:w-auto"
            type="button"
            onClick={() => {
              if (pending) void applyChange(pending.key, pending.value);
              setPending(null);
            }}
          >
            Sí, cambiar modo
          </Button>
        </div>
      </Modal>
    </>
  );
}
