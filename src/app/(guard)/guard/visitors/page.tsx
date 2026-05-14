"use client";

import { GuardVisitors } from "@/components/securityGuard/GuardVisitors";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";

export default function GuardVisitorsPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <section className="space-y-3">
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </section>
    );
  }

  if (!user?.tenantId) {
    return (
      <p className="rounded-xl border border-[var(--danger-600)]/20 bg-white p-4 text-sm text-[var(--danger-700)]">
        No fue posible resolver el tenant del usuario autenticado para cargar visitantes.
      </p>
    );
  }

  return <GuardVisitors tenantId={user.tenantId} guardId={user.uid} guardName={user.fullName} />;
}
