"use client";

import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const notifications = [
  "Nuevo comunicado: mantenimiento de ascensores.",
  "Reserva aprobada: salon social 15 de marzo.",
  "Paquete recibido en porteria.",
  "Ticket PQRS actualizado a En proceso.",
];

export function NotificationCenter() {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>Centro de notificaciones</CardTitle>
          <CardDescription className="mt-1">Eventos relevantes in-app para residentes y admins.</CardDescription>
        </div>
        <Badge className="bg-[var(--brand-50)] text-[var(--brand-900)]">
          <Bell className="mr-1 h-3 w-3" />4 nuevas
        </Badge>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-[var(--slate-700)]">
        {notifications.map((item) => (
          <li key={item} className="rounded-xl border border-[var(--slate-200)] p-2.5">
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}
