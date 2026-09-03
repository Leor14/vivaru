"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";

import { AuthProvider } from "@/features/auth/auth-context";
import { ErrorTracker } from "@/components/observability/ErrorTracker";
import { RouteTransitionVeil } from "@/components/shared/route-transition-veil";
import { FeatureFlagsProvider } from "@/lib/feature-flags/provider";
import { TemaProvider } from "@/features/tema/tema-context";
import { setupAppCheck } from "@/lib/firebase/app-check";

export function Providers({ children }: { children: React.ReactNode }) {
  // App Check estaba escrito y no lo llamaba nadie: la función existía desde
  // hacía meses sin un solo invocador, así que no protegía nada. Sin la clave
  // de reCAPTCHA en el entorno esto no hace nada — ver .env.example.
  useEffect(() => {
    setupAppCheck();
  }, []);

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
        {/* Dentro de las dos: necesita el usuario para saber su tema y la
            bandera para saber si el tema existe siquiera. */}
        <TemaProvider>
        <ErrorTracker />
        {children}
        {/* Velo de marca. Va en la raíz y no en el shell del admin: tiene que
            sobrevivir al salto de /login al portal, que cambia de layout. */}
        <RouteTransitionVeil />
        <Toaster richColors position="top-center" />
        </TemaProvider>
      </FeatureFlagsProvider>
    </AuthProvider>
  );
}
