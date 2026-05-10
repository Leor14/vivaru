"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import { createTicket, useTickets } from "@/features/pqrs/use-tickets";
import { getStatusLabel } from "@/utils/statusMapper";

export default function ResidentPqrsPage() {
  const { user } = useAuth();
  const { items, loading } = useTickets(user?.tenantId, user?.unitId);
  const [subject, setSubject] = useState("");

  async function handleCreateTicket() {
    if (!user?.tenantId || !subject.trim()) return;
    try {
      await createTicket({
        tenantId: user.tenantId,
        userId: user.uid,
        unitId: user.unitId,
        unitLabel: user.unitLabel ?? "Unidad no definida",
        subject: subject.trim(),
        message: subject.trim(),
        residentName: user.fullName,
        type: "other",
      });
      setSubject("");
      toast.success("Ticket PQRS creado.");
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  return (
    <Card>
      <CardTitle>PQRS</CardTitle>
      <CardDescription className="mt-1">Crea tickets y haz seguimiento a cada respuesta.</CardDescription>
      <div className="mt-4 space-y-2">
        <Textarea placeholder="Describe tu solicitud" value={subject} onChange={(event) => setSubject(event.target.value)} />
        <Button onClick={() => void handleCreateTicket()} disabled={!subject.trim()}>
          Crear ticket
        </Button>
      </div>
      <div className="mt-4 space-y-2 text-sm">
        {loading ? <p className="text-[var(--slate-600)]">Cargando tickets...</p> : null}
        {!loading && items.length === 0 ? (
          <EmptyState
            title="Sin tickets"
            description="No tienes solicitudes activas. Crea tu primera PQRS desde este formulario."
          />
        ) : null}
        {items.map((ticket) => (
          <div key={ticket.id} className="rounded-xl border border-[var(--slate-200)] p-3">
            {ticket.subject} - {getStatusLabel(ticket.status)}
          </div>
        ))}
      </div>
    </Card>
  );
}
