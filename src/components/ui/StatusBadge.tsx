import * as React from "react";

import { cn } from "@/lib/utils/cn";

export type StatusBadgeContext =
  | "unit"
  | "communication"
  | "pqrs"
  | "package"
  | "reservation"
  | "amenity";

export type StatusBadgeProps = {
  status: string;
  /**
   * **Declarada y HOY SIN USAR.** Catorce de las veintiuna llamadas la pasan y
   * no cambia nada: `resolveStatusTone` resuelve solo por el texto del estado.
   * Se conserva porque el día que dos contextos compartan una palabra con
   * significados distintos hará falta — pero mientras tanto **no configura
   * nada**, y conviene no pasarla esperando que sí.
   */
  context?: StatusBadgeContext;
  className?: string;
};

type StatusTone = {
  bg: string;
  text: string;
  dot: string;
  label: string;
};

const FALLBACK: Omit<StatusTone, "label"> = {
  bg: "#F1EFE8",
  text: "#5F5E5A",
  dot: "#888780",
};

const STATUS_TONES: Record<string, StatusTone> = {
  active:       { bg: "#EAF3DE", text: "#3B6D11", dot: "#3B6D11", label: "Activo" },
  activo:       { bg: "#EAF3DE", text: "#3B6D11", dot: "#3B6D11", label: "Activo" },
  inactive:     { bg: "#F1EFE8", text: "#5F5E5A", dot: "#888780", label: "Inactivo" },
  inactivo:     { bg: "#F1EFE8", text: "#5F5E5A", dot: "#888780", label: "Inactivo" },
  expired:      { bg: "#F1EFE8", text: "#5F5E5A", dot: "#888780", label: "Expirado" },
  expirado:     { bg: "#F1EFE8", text: "#5F5E5A", dot: "#888780", label: "Expirado" },
  published:    { bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD", label: "Publicado" },
  publicado:    { bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD", label: "Publicado" },
  draft:        { bg: "#FAEEDA", text: "#633806", dot: "#EF9F27", label: "Borrador" },
  borrador:     { bg: "#FAEEDA", text: "#633806", dot: "#EF9F27", label: "Borrador" },
  open:         { bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD", label: "Abierto" },
  abierto:      { bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD", label: "Abierto" },
  in_progress:  { bg: "#FAEEDA", text: "#633806", dot: "#EF9F27", label: "En proceso" },
  "en proceso": { bg: "#FAEEDA", text: "#633806", dot: "#EF9F27", label: "En proceso" },
  closed:       { bg: "#EAF3DE", text: "#3B6D11", dot: "#3B6D11", label: "Cerrado" },
  cerrado:      { bg: "#EAF3DE", text: "#3B6D11", dot: "#3B6D11", label: "Cerrado" },
  critical:     { bg: "#FCEBEB", text: "#791F1F", dot: "#A32D2D", label: "Crítico" },
  "crítico":    { bg: "#FCEBEB", text: "#791F1F", dot: "#A32D2D", label: "Crítico" },
  critico:      { bg: "#FCEBEB", text: "#791F1F", dot: "#A32D2D", label: "Crítico" },
  pending:      { bg: "#FAEEDA", text: "#633806", dot: "#EF9F27", label: "Pendiente" },
  pendiente:    { bg: "#FAEEDA", text: "#633806", dot: "#EF9F27", label: "Pendiente" },
  delivered:    { bg: "#EAF3DE", text: "#3B6D11", dot: "#3B6D11", label: "Entregado" },
  entregado:    { bg: "#EAF3DE", text: "#3B6D11", dot: "#3B6D11", label: "Entregado" },
  confirmed:    { bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD", label: "Confirmado" },
  confirmado:   { bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD", label: "Confirmado" },
  approved:     { bg: "#EAF3DE", text: "#3B6D11", dot: "#3B6D11", label: "Aprobada" },
  aprobada:     { bg: "#EAF3DE", text: "#3B6D11", dot: "#3B6D11", label: "Aprobada" },
  aprobado:     { bg: "#EAF3DE", text: "#3B6D11", dot: "#3B6D11", label: "Aprobado" },
  rejected:     { bg: "#FCEBEB", text: "#791F1F", dot: "#A32D2D", label: "Rechazada" },
  rechazada:    { bg: "#FCEBEB", text: "#791F1F", dot: "#A32D2D", label: "Rechazada" },
  responded:    { bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD", label: "Respondido" },
  respondido:   { bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD", label: "Respondido" },
  resolved:     { bg: "#EAF3DE", text: "#3B6D11", dot: "#3B6D11", label: "Resuelto" },
  resuelto:     { bg: "#EAF3DE", text: "#3B6D11", dot: "#3B6D11", label: "Resuelto" },
  cancelled:    { bg: "#F1EFE8", text: "#5F5E5A", dot: "#888780", label: "Cancelado" },
  cancelado:    { bg: "#F1EFE8", text: "#5F5E5A", dot: "#888780", label: "Cancelado" },
  urgent:       { bg: "#FCEBEB", text: "#791F1F", dot: "#A32D2D", label: "Urgente" },
  urgente:      { bg: "#FCEBEB", text: "#791F1F", dot: "#A32D2D", label: "Urgente" },
};

function capitalize(value: string): string {
  if (!value) return "Sin estado";
  const trimmed = value.trim();
  if (!trimmed) return "Sin estado";
  const normalized = trimmed.replace(/[_-]+/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

export function resolveStatusTone(status: string): StatusTone {
  const key = (status ?? "").trim().toLowerCase();
  if (key && STATUS_TONES[key]) return STATUS_TONES[key];
  return { ...FALLBACK, label: capitalize(status) };
}

/**
 * **Solo el color va en línea.** El resto de la forma vive en clases para que
 * quien llama pueda ajustarla: un `style` en línea gana a cualquier utilidad de
 * Tailwind, así que con la versión anterior el `text-[10px]` que pasan dos
 * llamadas de `residents/page.tsx` no hacía nada — el `fontSize: 12` lo pisaba
 * en silencio. (Sus otras dos clases, `ml-auto` y `shrink-0`, sí funcionaban:
 * no estaban entre las propiedades del `style`.)
 *
 * `cn` usa `twMerge`, así que una clase de la llamada sustituye a la de la base
 * en vez de sumarse. Los valores son los mismos de antes, al píxel.
 *
 * El fondo y el texto siguen en línea porque salen de la tabla de tonos y
 * cambian con el estado.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const tone = resolveStatusTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] whitespace-nowrap rounded-[4px] px-[9px] py-[3px] text-[12px] font-medium leading-[1.2]",
        className,
      )}
      style={{
        background: tone.bg,
        color: tone.text,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: tone.dot,
          flexShrink: 0,
        }}
      />
      {tone.label}
    </span>
  );
}

export default StatusBadge;
