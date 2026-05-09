"use client";
import { useAuth } from "@/features/auth/auth-context";
import { AppShell } from "@/components/shared/app-shell";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { ResidentHeader } from "../../../../components/shared/ResidentHeader";


export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  const { user, status, error } = useAuth();

  // Fallback visual para errores críticos de Auth
  if (status === "misconfigured" || status === "profile_error") {
    console.error("[resident-layout] Error crítico de Auth:", status, error);
    return (
      <section className="flex flex-col items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardTitle>Problema de configuración</CardTitle>
          <CardDescription className="mt-2 text-[var(--red-700)]">
            {status === "misconfigured"
              ? "Firebase no está configurado correctamente. Verifica variables de entorno y configuración."
              : error || "No fue posible resolver el perfil de usuario. Contacta al administrador."}
          </CardDescription>
        </Card>
      </section>
    );
  }

  return (
    <AppShell role="resident" title="Portal del Residente">
      {user?.tenantId && (
        <ResidentHeader tenantId={user.tenantId} tenantName={user.tenantName} />
      )}
      {children}
    </AppShell>
  );
}
