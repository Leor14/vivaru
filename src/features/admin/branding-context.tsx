"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type TenantBrandingSnapshot = {
  brandColor?: string;
  tenantDisplayName?: string;
  tenantName?: string;
  logoUrl?: string;
};

type TenantBrandingContextValue = {
  optimistic: TenantBrandingSnapshot | null;
  setOptimisticBranding: (next: TenantBrandingSnapshot) => void;
  clearOptimisticBranding: () => void;
};

const TenantBrandingContext = createContext<TenantBrandingContextValue | undefined>(undefined);

/**
 * Provider rendered by AppShell. Carries an optimistic branding snapshot that
 * the settings form can push immediately after a successful save so the
 * sidebar reflects the new color/logo without waiting for the Firestore
 * onSnapshot to round-trip. The snapshot is cleared once the upstream
 * onSnapshot delivers the persisted value, avoiding any drift.
 */
export function TenantBrandingProvider({ children }: { children: React.ReactNode }) {
  const [optimistic, setOptimistic] = useState<TenantBrandingSnapshot | null>(null);

  const setOptimisticBranding = useCallback((next: TenantBrandingSnapshot) => {
    setOptimistic(next);
  }, []);

  const clearOptimisticBranding = useCallback(() => {
    setOptimistic(null);
  }, []);

  const value = useMemo(
    () => ({ optimistic, setOptimisticBranding, clearOptimisticBranding }),
    [optimistic, setOptimisticBranding, clearOptimisticBranding],
  );

  return <TenantBrandingContext.Provider value={value}>{children}</TenantBrandingContext.Provider>;
}

export function useTenantBrandingContext() {
  return useContext(TenantBrandingContext);
}
