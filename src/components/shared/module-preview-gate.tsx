"use client";

import { useState } from "react";
import { Lock } from "lucide-react";

import { AdvisorRequestDialog } from "@/components/shared/advisor-request-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { useTenantTrial } from "@/features/tenant/use-tenant-trial";
import { isModuleLocked, PREVIEW_COPY, type TrialModuleKey } from "@/lib/config/trial-modules";

/**
 * Envoltura de los módulos en VISTA PREVIA durante la prueba.
 *
 * Deliberadamente **no oculta el contenido**: lo muestra debajo, poblado con
 * los datos de ejemplo que sembró el trial. Esa es la decisión comercial del
 * plan — lo que el prospecto ve pero no puede usar es lo que genera el deseo
 * de pagar; un módulo financiero vacío no vende nada.
 *
 * Lo que impide operar de verdad es el backend (`assertModuleAllowed` en
 * functions y `previewModuleWritable` en las reglas). Esto es la capa de
 * comunicación, no de seguridad.
 */
export function ModulePreviewGate({
  module,
  children,
}: {
  module: TrialModuleKey;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const trial = useTenantTrial(user?.tenantId);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (trial.loading || !isModuleLocked(trial.status, module)) {
    return <>{children}</>;
  }

  const copy = PREVIEW_COPY[module];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--brand-200,#bcd9f2)] bg-[var(--brand-50,#E6F1FB)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white text-[#0C447C]">
              <Lock className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0C447C]">
                Vista previa
              </p>
              <h2 className="mt-0.5 text-lg font-semibold text-[var(--slate-900)]">
                {copy?.title ?? "Disponible con tu plan"}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-[var(--slate-700)]">
                {copy?.body ??
                  "Este módulo está disponible al contratar Vivaru. Abajo puedes explorarlo con datos de ejemplo."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex shrink-0 items-center rounded-xl bg-[#0C447C] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Activar este módulo
          </button>
        </div>
      </div>

      <AdvisorRequestDialog open={dialogOpen} onClose={() => setDialogOpen(false)} motivoInicial="modulo" />

      {/* El contenido queda visible pero inerte: se explora, no se opera. */}
      <div aria-hidden className="pointer-events-none select-none opacity-95">
        {children}
      </div>
    </div>
  );
}
