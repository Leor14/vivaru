"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { toast } from "sonner";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/shared/modal";
import { VariantOptionPicker } from "@/components/shared/variant-option-picker";
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

        <div className="mt-4 space-y-5">
          {MODULE_VARIANT_META.map((mod) => {
            const editability = VARIANT_EDITABILITY[mod.key];
            const isSaving = saving === mod.key;
            return (
              <VariantOptionPicker
                key={mod.key}
                meta={mod}
                value={variants[mod.key]}
                editability={editability}
                context="edit"
                disabled={isSaving}
                onSelect={(value) => handleSelect(mod.key, value)}
              />
            );
          })}
        </div>
      </Card>

      <Modal
        open={pending !== null}
        title={`Cambiar el modo de "${pending?.label ?? ""}"`}
        onClose={() => setPending(null)}
      >
        {(() => {
          const mod = MODULE_VARIANT_META.find((m) => m.key === pending?.key);
          const target = mod?.options.find((o) => o.value === pending?.value);
          return (
            <div className="space-y-3 text-sm text-[var(--slate-600)]">
              {target ? (
                <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] p-3">
                  <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Vas a cambiar a</p>
                  <p className="mt-0.5 text-sm font-semibold text-[var(--slate-900)]">{target.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--slate-600)]">{target.description}</p>
                </div>
              ) : null}
              <p>
                {mod?.changeNote ??
                  "Cambiar el modo altera cómo opera el módulo de aquí en adelante."}{" "}
                ¿Quieres continuar?
              </p>
            </div>
          );
        })()}
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
