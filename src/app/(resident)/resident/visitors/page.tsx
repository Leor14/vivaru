"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth/auth-context";
import { cancelResidentInvitation, subscribeResidentInvitations } from "@/features/visitors/invitations";
import type { VisitorInvitation, VisitorInvitationStatus } from "features/visitors/types";
import { formatDateTime } from "features/visitors/utils/formatDateTime";

const statusLabel: Record<VisitorInvitationStatus, string> = {
  active: "Activa",
  cancelled: "Cancelada",
  expired: "Expirada",
  used_up: "Usada",
};

const statusClassName: Record<VisitorInvitationStatus, string> = {
  active: "bg-[var(--brand-50)] text-[var(--brand-900)]",
  cancelled: "bg-[var(--danger-100)] text-[var(--danger-700)]",
  expired: "bg-[var(--slate-200)] text-[var(--slate-700)]",
  used_up: "bg-[var(--warning-100)] text-[var(--warning-800)]",
};

export default function ResidentVisitorsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<VisitorInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.tenantId || !user.unitId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeResidentInvitations(
      user.tenantId,
      user.unitId,
      (invitations) => {
        setItems(invitations);
        setError(null);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.tenantId, user?.unitId]);

  const hasInvitations = useMemo(() => items.length > 0, [items.length]);

  function getDisplayStatus(item: VisitorInvitation): VisitorInvitationStatus {
    if (item.status === "active" && item.endAt && item.endAt < new Date()) {
      return "expired";
    }
    return item.status;
  }

  async function handleCancelInvitation(id: string) {
    setCancellingId(id);
    try {
      await cancelResidentInvitation(id);
      toast.success("Invitacion cancelada correctamente.");
    } catch (cancelError) {
      toastFirebaseError(cancelError);
    } finally {
      setCancellingId(null);
    }
  }


  return (
    <section className="space-y-4">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-[var(--slate-500)] uppercase">Modulo residentes</p>
            <CardTitle className="mt-1 text-xl">Visitantes y autorizaciones</CardTitle>
            <CardDescription className="mt-1">
              Gestióna invitaciones activas, revisa vigencias y comparte el QR final sin salir de tu portal.
            </CardDescription>
          </div>
          <Link href="/resident/visitors/new">
            <Button>Crear invitacion</Button>
          </Link>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Invitaciones recientes</CardTitle>
            <CardDescription className="mt-1">Listado en tiempo real de tus autorizaciones de ingreso.</CardDescription>
          </div>
        </div>

        {loading ? <p className="mt-4 text-sm text-[var(--slate-600)]">Cargando invitaciones...</p> : null}
        {error ? <p className="mt-4 text-sm text-[var(--danger-700)]">{error}</p> : null}

        {!loading && !error && !hasInvitations ? (
          <div className="space-y-3">
            <EmptyState
              title="Aun no tienes invitaciones"
              description="Crea tu primera invitacion para compartir acceso con tus visitantes desde este mismo modulo."
            />
            <div className="text-center">
              <Link href="/resident/visitors/new">
                <Button size="sm">Crear invitacion</Button>
              </Link>
            </div>
          </div>
        ) : null}

        {!loading && !error && hasInvitations ? (
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-xl border border-[var(--slate-200)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-[var(--slate-900)]">{item.visitorName}</h3>
                    <p className="text-sm text-[var(--slate-700)]">ID: {item.visitorIdentification}</p>
                    <p className="text-sm text-[var(--slate-600)]">Vigencia: {formatDateTime(item.startAt)} - {formatDateTime(item.endAt)}</p>
                  </div>
                  <Badge className={statusClassName[getDisplayStatus(item)]}>{statusLabel[getDisplayStatus(item)]}</Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => router.push(`/resident/visitors/${item.id}`)}>
                    Ver detalle
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/resident/visitors/${item.id}/qr`)}
                    disabled={getDisplayStatus(item) !== "active"}
                  >
                    Ver QR
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void handleCancelInvitation(item.id)}
                    disabled={getDisplayStatus(item) !== "active" || cancellingId === item.id}
                  >
                    {cancellingId === item.id ? "Cancelando..." : "Cancelar invitacion"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </Card>
    </section>
  );
}
