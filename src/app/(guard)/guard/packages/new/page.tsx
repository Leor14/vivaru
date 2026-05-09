"use client";

import { GuardPackageRegister } from "@/components/securityGuard/GuardPackageRegister";
import { useAuth } from "@/features/auth/auth-context";

export default function GuardPackagesNewPage() {
  const { user } = useAuth();

  return <GuardPackageRegister tenantId={user?.tenantId} userId={user?.uid} guardName={user?.fullName} />;
}
