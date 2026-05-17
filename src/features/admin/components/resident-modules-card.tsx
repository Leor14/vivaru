"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { CalendarCheck, ClipboardList, ScrollText, Store } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase/client";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import { DEFAULT_RESIDENT_MODULES, type ResidentModules } from "@/features/admin/services";

type ModuleKey = keyof ResidentModules;

const MODULE_META: Array<{
  key: ModuleKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}> = [
  {
    key: "reservations",
    label: "Reservas",
    description: "El residente puede reservar zonas comunes desde su portal.",
    icon: CalendarCheck,
  },
  {
    key: "services",
    label: "Servicios",
    description: "El residente puede ver los servicios disponibles en el conjunto.",
    icon: Store,
  },
  {
    key: "surveys",
    label: "Encuestas",
    description: "El residente puede responder encuestas de la administración.",
    icon: ClipboardList,
  },
  {
    key: "regulations",
    label: "Reglamento",
    description: "El residente puede consultar el reglamento del conjunto.",
    icon: ScrollText,
  },
];

export function ResidentModulesCard({ tenantId }: { tenantId?: string }) {
  const [modules, setModules] = useState<ResidentModules>(DEFAULT_RESIDENT_MODULES);
  const [saving, setSaving] = useState<ModuleKey | null>(null);

  useEffect(() => {
    if (!tenantId || !db) return;

    const unsub = onSnapshot(doc(db, "tenantSettings", tenantId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as Record<string, unknown>;
      const raw =
        typeof data.residentModules === "object" && data.residentModules
          ? (data.residentModules as Record<string, unknown>)
          : null;
      setModules({
        reservations: raw?.reservations !== false,
        services: raw?.services !== false,
        surveys: raw?.surveys !== false,
        regulations: raw?.regulations !== false,
      });
    });

    return unsub;
  }, [tenantId]);

  async function handleToggle(key: ModuleKey, value: boolean) {
    if (!tenantId || !db) return;
    setSaving(key);
    try {
      await updateDoc(doc(db, "tenantSettings", tenantId), {
        [`residentModules.${key}`]: value,
      });
      toast.success(`Módulo "${MODULE_META.find((m) => m.key === key)?.label}" ${value ? "activado" : "desactivado"}.`);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardTitle help="Activa o desactiva los módulos visibles para los residentes en su portal. Los módulos desactivados desaparecen del menú del residente de forma inmediata, sin necesidad de recargar la app.">
        Módulos del portal residente
      </CardTitle>
      <CardDescription className="mt-1">
        Controla qué funcionalidades están disponibles para los residentes de este conjunto.
      </CardDescription>

      <div className="mt-4 divide-y divide-[var(--slate-100)]">
        {MODULE_META.map(({ key, label, description, icon: Icon }) => {
          const enabled = modules[key];
          const isSaving = saving === key;
          return (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-4 py-3 first:pt-0 last:pb-0"
            >
              {/* Toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                disabled={isSaving}
                onClick={() => void handleToggle(key, !enabled)}
                className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-700)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: enabled ? "var(--brand-700)" : "var(--slate-200)",
                }}
              >
                <span
                  className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform"
                  style={{ transform: enabled ? "translateX(20px)" : "translateX(0px)" }}
                />
              </button>

              {/* Icon + text */}
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: enabled ? "color-mix(in srgb, var(--brand-700) 10%, transparent)" : "var(--slate-100)",
                  }}
                >
                  <Icon
                    className={enabled ? "h-4 w-4 text-[var(--brand-700)]" : "h-4 w-4 text-[var(--slate-400)]"}
                    strokeWidth={2}
                  />
                </span>
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium"
                    style={{ color: enabled ? "var(--slate-900)" : "var(--slate-500)" }}
                  >
                    {label}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--slate-500)]">{description}</p>
                </div>
              </div>

              {/* Status pill */}
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: enabled
                    ? "color-mix(in srgb, var(--brand-700) 10%, transparent)"
                    : "var(--slate-100)",
                  color: enabled ? "var(--brand-700)" : "var(--slate-400)",
                }}
              >
                {isSaving ? "..." : enabled ? "Activo" : "Inactivo"}
              </span>
            </label>
          );
        })}
      </div>
    </Card>
  );
}
