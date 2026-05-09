"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { cancelResidentInvitation, getResidentInvitationById } from "@/features/visitors/invitations";
import type { VisitorInvitation } from "features/visitors/types";
import { VisitorInvitationSummaryCard } from "../../../../../../components/features/visitors/VisitorInvitationSummaryCard";

export default function ResidentVisitorsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [invitation, setInvitation] = useState<VisitorInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    async function loadInvitation() {
      if (!id) return;

      setLoading(true);
      try {
        const loadedInvitation = await getResidentInvitationById(id);
        if (!loadedInvitation) {
          setError("La invitacion no existe o fue eliminada.");
          return;
        }

        if (user?.tenantId && loadedInvitation.tenantId !== user.tenantId) {
          setError("No tienes permisos para ver esta invitacion.");
          return;
        }

        if (user?.unitId && loadedInvitation.unitId !== user.unitId) {
          setError("No tienes permisos para ver esta invitacion.");
          return;
        }

        setInvitation(loadedInvitation);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No fue posible cargar el detalle.");
      } finally {
        setLoading(false);
      }
    }

    void loadInvitation();
  }, [id, user?.tenantId, user?.unitId]);

  async function handleCancel() {
    if (!invitation) return;

    setCancelling(true);
    try {
      await cancelResidentInvitation(invitation.id);
      setInvitation({ ...invitation, status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() });
      toast.success("Invitacion cancelada correctamente.");
    } catch (cancelError) {
      toast.error(cancelError instanceof Error ? cancelError.message : "No fue posible cancelar la invitacion.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="space-y-4">
      <Card>
        <p className="text-xs font-medium tracking-wide text-[var(--slate-500)] uppercase">Visitantes / Paso 2 de 3</p>
        <CardTitle className="mt-1 text-xl">Detalle de invitacion</CardTitle>
        <CardDescription className="mt-1">Revisa la informacion de la invitacion antes de compartir su QR.</CardDescription>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/resident/visitors">
            <Button variant="outline" size="sm">Volver al listado</Button>
          </Link>
          {invitation ? (
            <Button size="sm" onClick={() => router.push(`/resident/visitors/${invitation.id}/qr`)}>
              Ver QR final
            </Button>
          ) : null}
        </div>

        {loading ? <p className="text-sm text-[var(--slate-600)]">Cargando invitacion...</p> : null}
        {error ? <p className="text-sm text-[var(--danger-700)]">{error}</p> : null}

        {!loading && !error && invitation ? (
          <VisitorInvitationSummaryCard
            invitation={invitation}
            showQR
            onShowQR={() => router.push(`/resident/visitors/${invitation.id}/qr`)}
            onCancel={handleCancel}
            cancelling={cancelling}
          />
        ) : null}
      </Card>
    </section>
  );
}