"use client";

import type { ReactNode } from "react";

import type { FeatureFlagKey } from "@/lib/feature-flags/catalog";
import { useFeatureFlag } from "@/lib/feature-flags/provider";

/**
 * Envuelve lo que solo debe existir con la bandera encendida.
 *
 * OJO — esto es la capa de presentación, no el candado. Igual que con el gate
 * de módulos del trial, lo que protege de verdad es la comprobación del
 * servidor (`assertFeatureEnabled` en `functions/src/feature-flags.ts`): esto se
 * salta con las herramientas de desarrollo del navegador.
 */
export function FeatureGate({
  flag,
  children,
  fallback = null,
}: {
  flag: FeatureFlagKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return useFeatureFlag(flag) ? <>{children}</> : <>{fallback}</>;
}
