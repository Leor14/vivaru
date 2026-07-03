import * as React from "react";

export type StatusBadgeContext =
  | "unit"
  | "communication"
  | "pqrs"
  | "package"
  | "reservation"
  | "amenity";

export type StatusBadgeProps = {
  status: string;
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

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const tone = resolveStatusTone(status);
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 500,
        padding: "3px 9px",
        borderRadius: 4,
        background: tone.bg,
        color: tone.text,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
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
