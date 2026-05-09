"use client";

import { GuardPackagesList } from "@/components/securityGuard/GuardPackagesList";
import { useAuth } from "@/features/auth/auth-context";

export default function GuardPackagesPage() {
  const { user } = useAuth();

  return <GuardPackagesList tenantId={user?.tenantId} userId={user?.uid} />;
}
