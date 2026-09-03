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
  bg: "var(--mapa-neutro-superficie-3)",
  text: "var(--mapa-neutro-texto-1)",
  dot: "var(--mapa-neutro-acento-1)",
};

const STATUS_TONES: Record<string, StatusTone> = {
  active:       { bg: "var(--mapa-verde-superficie-1)", text: "var(--mapa-verde-texto-1)", dot: "var(--mapa-verde-acento-1)", label: "Activo" },
  activo:       { bg: "var(--mapa-verde-superficie-1)", text: "var(--mapa-verde-texto-1)", dot: "var(--mapa-verde-acento-1)", label: "Activo" },
  inactive:     { bg: "var(--mapa-neutro-superficie-3)", text: "var(--mapa-neutro-texto-1)", dot: "var(--mapa-neutro-acento-1)", label: "Inactivo" },
  inactivo:     { bg: "var(--mapa-neutro-superficie-3)", text: "var(--mapa-neutro-texto-1)", dot: "var(--mapa-neutro-acento-1)", label: "Inactivo" },
  expired:      { bg: "var(--mapa-neutro-superficie-3)", text: "var(--mapa-neutro-texto-1)", dot: "var(--mapa-neutro-acento-1)", label: "Expirado" },
  expirado:     { bg: "var(--mapa-neutro-superficie-3)", text: "var(--mapa-neutro-texto-1)", dot: "var(--mapa-neutro-acento-1)", label: "Expirado" },
  published:    { bg: "var(--mapa-neutro-superficie-1)", text: "var(--mapa-azul-texto-1)", dot: "var(--mapa-azul-acento-1)", label: "Publicado" },
  publicado:    { bg: "var(--mapa-neutro-superficie-1)", text: "var(--mapa-azul-texto-1)", dot: "var(--mapa-azul-acento-1)", label: "Publicado" },
  draft:        { bg: "var(--mapa-verde-superficie-2)", text: "var(--mapa-ambar-texto-1)", dot: "var(--mapa-ambar-acento-1)", label: "Borrador" },
  borrador:     { bg: "var(--mapa-verde-superficie-2)", text: "var(--mapa-ambar-texto-1)", dot: "var(--mapa-ambar-acento-1)", label: "Borrador" },
  open:         { bg: "var(--mapa-neutro-superficie-1)", text: "var(--mapa-azul-texto-1)", dot: "var(--mapa-azul-acento-1)", label: "Abierto" },
  abierto:      { bg: "var(--mapa-neutro-superficie-1)", text: "var(--mapa-azul-texto-1)", dot: "var(--mapa-azul-acento-1)", label: "Abierto" },
  in_progress:  { bg: "var(--mapa-verde-superficie-2)", text: "var(--mapa-ambar-texto-1)", dot: "var(--mapa-ambar-acento-1)", label: "En proceso" },
  "en proceso": { bg: "var(--mapa-verde-superficie-2)", text: "var(--mapa-ambar-texto-1)", dot: "var(--mapa-ambar-acento-1)", label: "En proceso" },
  closed:       { bg: "var(--mapa-verde-superficie-1)", text: "var(--mapa-verde-texto-1)", dot: "var(--mapa-verde-acento-1)", label: "Cerrado" },
  cerrado:      { bg: "var(--mapa-verde-superficie-1)", text: "var(--mapa-verde-texto-1)", dot: "var(--mapa-verde-acento-1)", label: "Cerrado" },
  critical:     { bg: "var(--mapa-neutro-superficie-2)", text: "var(--mapa-rojo-texto-1)", dot: "var(--mapa-rojo-acento-1)", label: "Crítico" },
  "crítico":    { bg: "var(--mapa-neutro-superficie-2)", text: "var(--mapa-rojo-texto-1)", dot: "var(--mapa-rojo-acento-1)", label: "Crítico" },
  critico:      { bg: "var(--mapa-neutro-superficie-2)", text: "var(--mapa-rojo-texto-1)", dot: "var(--mapa-rojo-acento-1)", label: "Crítico" },
  pending:      { bg: "var(--mapa-verde-superficie-2)", text: "var(--mapa-ambar-texto-1)", dot: "var(--mapa-ambar-acento-1)", label: "Pendiente" },
  pendiente:    { bg: "var(--mapa-verde-superficie-2)", text: "var(--mapa-ambar-texto-1)", dot: "var(--mapa-ambar-acento-1)", label: "Pendiente" },
  delivered:    { bg: "var(--mapa-verde-superficie-1)", text: "var(--mapa-verde-texto-1)", dot: "var(--mapa-verde-acento-1)", label: "Entregado" },
  entregado:    { bg: "var(--mapa-verde-superficie-1)", text: "var(--mapa-verde-texto-1)", dot: "var(--mapa-verde-acento-1)", label: "Entregado" },
  confirmed:    { bg: "var(--mapa-neutro-superficie-1)", text: "var(--mapa-azul-texto-1)", dot: "var(--mapa-azul-acento-1)", label: "Confirmado" },
  confirmado:   { bg: "var(--mapa-neutro-superficie-1)", text: "var(--mapa-azul-texto-1)", dot: "var(--mapa-azul-acento-1)", label: "Confirmado" },
  approved:     { bg: "var(--mapa-verde-superficie-1)", text: "var(--mapa-verde-texto-1)", dot: "var(--mapa-verde-acento-1)", label: "Aprobada" },
  aprobada:     { bg: "var(--mapa-verde-superficie-1)", text: "var(--mapa-verde-texto-1)", dot: "var(--mapa-verde-acento-1)", label: "Aprobada" },
  aprobado:     { bg: "var(--mapa-verde-superficie-1)", text: "var(--mapa-verde-texto-1)", dot: "var(--mapa-verde-acento-1)", label: "Aprobado" },
  rejected:     { bg: "var(--mapa-neutro-superficie-2)", text: "var(--mapa-rojo-texto-1)", dot: "var(--mapa-rojo-acento-1)", label: "Rechazada" },
  rechazada:    { bg: "var(--mapa-neutro-superficie-2)", text: "var(--mapa-rojo-texto-1)", dot: "var(--mapa-rojo-acento-1)", label: "Rechazada" },
  responded:    { bg: "var(--mapa-neutro-superficie-1)", text: "var(--mapa-azul-texto-1)", dot: "var(--mapa-azul-acento-1)", label: "Respondido" },
  respondido:   { bg: "var(--mapa-neutro-superficie-1)", text: "var(--mapa-azul-texto-1)", dot: "var(--mapa-azul-acento-1)", label: "Respondido" },
  resolved:     { bg: "var(--mapa-verde-superficie-1)", text: "var(--mapa-verde-texto-1)", dot: "var(--mapa-verde-acento-1)", label: "Resuelto" },
  resuelto:     { bg: "var(--mapa-verde-superficie-1)", text: "var(--mapa-verde-texto-1)", dot: "var(--mapa-verde-acento-1)", label: "Resuelto" },
  cancelled:    { bg: "var(--mapa-neutro-superficie-3)", text: "var(--mapa-neutro-texto-1)", dot: "var(--mapa-neutro-acento-1)", label: "Cancelado" },
  cancelado:    { bg: "var(--mapa-neutro-superficie-3)", text: "var(--mapa-neutro-texto-1)", dot: "var(--mapa-neutro-acento-1)", label: "Cancelado" },
  urgent:       { bg: "var(--mapa-neutro-superficie-2)", text: "var(--mapa-rojo-texto-1)", dot: "var(--mapa-rojo-acento-1)", label: "Urgente" },
  urgente:      { bg: "var(--mapa-neutro-superficie-2)", text: "var(--mapa-rojo-texto-1)", dot: "var(--mapa-rojo-acento-1)", label: "Urgente" },
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
 *
 * **La forma es una píldora**, que es lo que dice «esto es un estado» sin
 * leerlo. Era `rounded-[4px]`, un valor a pelo que ningún token alcanzaba. El
 * relleno horizontal sube de 9 a 10 px porque los extremos redondos se comen
 * parte del aire.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const tone = resolveStatusTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[10px] py-[3px] text-[12px] font-medium leading-[1.2]",
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
