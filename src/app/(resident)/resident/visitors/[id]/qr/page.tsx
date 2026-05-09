"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { getResidentInvitationById } from "@/features/visitors/invitations";
import type { VisitorInvitation } from "features/visitors/types";
import { formatDateTime } from "features/visitors/utils/formatDateTime";

export default function ResidentVisitorsQrPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [invitation, setInvitation] = useState<VisitorInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError(loadError instanceof Error ? loadError.message : "No fue posible cargar el QR.");
      } finally {
        setLoading(false);
      }
    }

    void loadInvitation();
  }, [id, user?.tenantId, user?.unitId]);

  const isActive = invitation?.status === "active";
  const qrValue = useMemo(() => {
    if (!invitation) return "";
    return isActive ? invitation.qrToken : `inactive:${invitation.id}`;
  }, [invitation, isActive]);

  return (
    <section className="space-y-4">
      <Card>
        <p className="text-xs font-medium tracking-wide text-[var(--slate-500)] uppercase">Visitantes / Paso 3 de 3</p>
        <CardTitle className="mt-1 text-xl">QR final de invitacion</CardTitle>
        <CardDescription className="mt-1">
          Presenta este codigo en porteria para validar el ingreso dentro de la vigencia configurada.
        </CardDescription>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/resident/visitors">
            <Button variant="outline" size="sm">Volver al listado</Button>
          </Link>
          {id ? (
            <Link href={`/resident/visitors/${id}`}>
              <Button variant="outline" size="sm">Volver al detalle</Button>
            </Link>
          ) : null}
        </div>

        {loading ? <p className="text-sm text-[var(--slate-600)]">Cargando QR...</p> : null}
        {error ? <p className="text-sm text-[var(--danger-700)]">{error}</p> : null}

        {!loading && !error && invitation ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-[var(--brand-200)] bg-[linear-gradient(180deg,#ffffff,#f6fbff)] p-4 text-center shadow-[0_12px_24px_rgba(12,33,53,0.08)]">
            <p className="text-sm font-medium text-[var(--slate-700)]">Visitante</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--slate-900)]">{invitation.visitorName}</h2>
            <p className="mt-1 text-sm text-[var(--slate-600)]">ID: {invitation.visitorIdentification}</p>

            <div className="mx-auto mt-4 w-fit rounded-2xl border border-[var(--slate-200)] bg-white p-3">
              <QRCodeCanvas value={qrValue} size={220} level="H" includeMargin />
            </div>

            <p className="mt-3 text-2xl font-semibold tracking-[0.2em] text-[var(--brand-900)]">{invitation.invitationCode}</p>
            <p className="mt-2 text-sm text-[var(--slate-600)]">Vigencia: {formatDateTime(invitation.startAt)} - {formatDateTime(invitation.endAt)}</p>
            <p className="mt-1 text-sm text-[var(--slate-600)]">Usos permitidos: {invitation.allowedUses}</p>

            {!isActive ? (
              <p className="mt-3 rounded-lg bg-[var(--danger-100)] px-3 py-2 text-sm font-medium text-[var(--danger-700)]">
                Esta invitacion no esta activa. Verifica su estado en el detalle.
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>
    </section>
  );
}