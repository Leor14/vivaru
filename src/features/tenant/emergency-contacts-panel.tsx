"use client";

import { PhoneCall } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { enlaceParaLlamar } from "@/features/tenant/contactos-de-emergencia";
import { useContactosDeEmergencia } from "@/features/tenant/use-contactos-de-emergencia";

/**
 * **Los números de emergencia del conjunto, tal como los ven el residente y la portería** (`L-32`).
 *
 * Una sola tarjeta para los dos portales: es la misma lista y la misma pregunta —a quién llamo
 * ahora—, y tenerla dos veces es la forma más barata de que un día digan cosas distintas.
 *
 * **Sin números, no se pinta nada.** Mientras la administración no los escriba, una tarjeta vacía
 * en el inicio solo dice que algo falta.
 */
export function EmergencyContactsPanel({ tenantId }: { tenantId?: string }) {
  const contactos = useContactosDeEmergencia(tenantId);
  if (contactos.length === 0) return null;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <PhoneCall className="mt-1 h-5 w-5 text-[var(--brand-700)]" />
        <div>
          <CardTitle>Números de emergencia</CardTitle>
          <CardDescription className="mt-1">A quién llamar cuando pasa algo en el conjunto.</CardDescription>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {contactos.map((contacto) => (
          <li
            key={`${contacto.nombre}-${contacto.telefono}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] px-3 py-2"
          >
            <span className="text-sm">
              <span className="font-medium text-[var(--slate-900)]">{contacto.nombre}</span>
              {contacto.nota ? (
                <span className="ml-2 text-xs text-[var(--slate-500)]">{contacto.nota}</span>
              ) : null}
            </span>
            {/* Un número que no se puede marcar de un toque no sirve en una emergencia. */}
            <a
              className="text-sm font-semibold text-[var(--brand-700)] underline-offset-2 hover:underline"
              href={enlaceParaLlamar(contacto.telefono)}
            >
              {contacto.telefono}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
