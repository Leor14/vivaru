"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "sonner";

import { AuthProvider } from "@/features/auth/auth-context";
import { ErrorTracker } from "@/components/observability/ErrorTracker";
import { RouteTransitionVeil } from "@/components/shared/route-transition-veil";
import { FeatureFlagsProvider } from "@/lib/feature-flags/provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const safePathname = typeof pathname === "string" ? pathname : "";
  const isResilientPublicRoute =
    safePathname.startsWith("/setup-error") || safePathname.startsWith("/unauthorized");

  if (isResilientPublicRoute) {
    return (
      <>
        <ErrorTracker />
        {children}
        <Toaster richColors position="top-center" />
      </>
    );
  }

  return (
    <AuthProvider>
      {/* Dentro de AuthProvider porque resuelve el conjunto desde la sesión, y
          nunca desde la ruta ni desde nada que mande el cliente. */}
      <FeatureFlagsProvider>
        <ErrorTracker />
        {children}
        {/* Velo de marca. Va en la raíz y no en el shell del admin: tiene que
            sobrevivir al salto de /login al portal, que cambia de layout. */}
        <RouteTransitionVeil />
        <Toaster richColors position="top-center" />
      </FeatureFlagsProvider>
    </AuthProvider>
  );
}
