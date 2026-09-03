"use client";

import { useResidentProfile } from "../../../../../features/resident/hooks/useResidentProfile";
import { ResidentProfileCard } from "../../../../../components/features/resident/ResidentProfileCard";
import { ResidentSecuritySection } from "../../../../../components/features/resident/ResidentSecuritySection";
import { ResidentPushDevicesCard } from "../../../../../components/features/resident/ResidentPushDevicesCard";
import { useAuth } from "@/features/auth/auth-context";
import { Skeleton } from "@/components/ui/skeleton";

export default function ResidentProfilePage() {
  const { profile: user, loading, error, refetch } = useResidentProfile();
  const { refreshSessionProfile } = useAuth();

  const handleProfileUpdated = async () => {
    await refetch();
    await refreshSessionProfile({ preferServerReads: true });
  };

  if (loading) {
    return (
      <section className="space-y-4">
        {/* Profile card skeleton */}
        <div className="rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-36 rounded-sm" />
              <Skeleton className="h-4 w-24 rounded-sm" />
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <Skeleton className="h-4 w-24 rounded-sm" />
                <Skeleton className="h-4 w-32 rounded-sm" />
              </div>
            ))}
          </div>
        </div>
        {/* Security section skeleton */}
        <div className="rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-5">
          <Skeleton className="h-5 w-40 rounded-sm" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex items-center justify-center h-40">
        <span className="text-[var(--danger-600)]">Error: {error}</span>
      </section>
    );
  }
  if (!user) {
    return null;
  }

  return (
    <section className="space-y-4">
      <ResidentProfileCard user={user} onProfileUpdated={handleProfileUpdated} />
      <ResidentPushDevicesCard />
      <ResidentSecuritySection uid={user.uid} onPasswordUpdated={handleProfileUpdated} />
    </section>
  );
}
