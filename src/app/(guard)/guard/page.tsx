"use client";

import { GuardDashboard } from "@/components/securityGuard/GuardDashboard";
import { useAuth } from "@/features/auth/auth-context";

export default function GuardHomePage() {
  const { user } = useAuth();

  return <GuardDashboard tenantId={user?.tenantId} />;
}
