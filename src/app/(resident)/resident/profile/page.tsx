"use client";

import { useResidentProfile } from "../../../../../features/resident/hooks/useResidentProfile";
import { ResidentProfileCard } from "../../../../../components/features/resident/ResidentProfileCard";
import { ResidentSecuritySection } from "../../../../../components/features/resident/ResidentSecuritySection";
import { useAuth } from "@/features/auth/auth-context";

export default function ResidentProfilePage() {
  const { profile: user, loading, error, refetch } = useResidentProfile();
  const { refreshSessionProfile } = useAuth();

  const handleProfileUpdated = async () => {
    await refetch();
    await refreshSessionProfile({ preferServerReads: true });
  };

  if (loading) {
    return (
      <section className="flex items-center justify-center h-40">
        <span className="text-muted-foreground">Cargando perfil...</span>
      </section>
    );
  }
  if (error) {
    return (
      <section className="flex items-center justify-center h-40">
        <span className="text-destructive">Error: {error}</span>
      </section>
    );
  }
  if (!user) {
    return null;
  }

  return (
    <section className="space-y-4">
      <ResidentProfileCard user={user} onProfileUpdated={handleProfileUpdated} />
      <ResidentSecuritySection uid={user.uid} onPasswordUpdated={handleProfileUpdated} />
    </section>
  );
}
