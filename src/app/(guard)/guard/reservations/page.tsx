"use client";

import { GuardReservations } from "@/components/securityGuard/GuardReservations";
import { useAuth } from "@/features/auth/auth-context";

export default function GuardReservationsPage() {
  const { user } = useAuth();

  return <GuardReservations tenantId={user?.tenantId} />;
}
