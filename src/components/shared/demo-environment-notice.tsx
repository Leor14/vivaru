"use client";

import { Info } from "lucide-react";

import { useAuth } from "@/features/auth/auth-context";
import { useTenantTrial } from "@/features/tenant/use-tenant-trial";

/**
 * Aviso para residentes y portería cuando el conjunto está en prueba.
 *
 * A diferencia del portal del administrador —donde los módulos bloqueados se
 * muestran a propósito para generar deseo— aquí el usuario NO es el comprador.
 * Enseñarle candados solo comunicaría "esta app está incompleta". Lo correcto es
 * una nota discreta que explique por qué hay datos de ejemplo, sin vender nada.
 */
export function DemoEnvironmentNotice() {
  const { user } = useAuth();
  const trial = useTenantTrial(user?.tenantId);

  if (trial.loading) return null;
  if (!trial.isTrial && !trial.isExpired) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2 border-b border-[var(--tinte-verde-borde-4)] bg-[var(--tinte-verde-fondo-4)] px-4 py-2 text-xs text-[var(--tinte-ambar-texto-4)]"
    >
      <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
      <span>
        Tu conjunto está evaluando Vivaru. Parte de lo que ves son <strong>datos de ejemplo</strong>,
        y algunas funciones se activan cuando la administración contrate el servicio.
      </span>
    </div>
  );
}
