import { descargarFilas, type FilasDeHoja, type FormatoDeHoja } from "@/lib/export/hoja-de-calculo";
import type { UnitIndex } from "@/utils/unitLabel";
import type { Ticket } from "@/types/domain";

import { personaDelTicket, unidadDelTicket } from "./identidad-del-ticket";
import {
  getTicketCategoryLabel,
  getTicketPriorityLabel,
  getTicketTypeLabel,
} from "./ticket-status";
import { evidenciasDeLaSolucion } from "./evidencia-de-la-solucion";

/**
 * **`L-21` — bajar el detalle de PQRS a una hoja de cálculo.**
 *
 * Lote «Análisis de la plataforma», pág. 9: «Debería poder descargar en Excel el detalle de las
 * PQRS». Exporta **lo que está viendo en pantalla** —la lista ya filtrada—, no la colección entera:
 * si la administradora filtró por estado o por torre, la hoja tiene que coincidir con la tabla, o
 * el número que lleve a su informe no será el que vio.
 *
 * **Las identidades se resuelven con las mismas funciones que la pantalla** (`unidadDelTicket`,
 * `personaDelTicket`, de `L-21d`). No es una comodidad: el defecto que se arregló en la fase 4 era
 * justo ese —un id crudo y «Residente» en vez del nombre—, y un exportador con su propia lógica
 * habría vuelto a meterlo en el Excel sin que nadie lo viera en la tabla.
 *
 * **Las fechas van en `YYYY-MM-DD HH:mm` y no en `es-CO`, a propósito.** Un `18/09/2026` dentro de
 * una hoja de cálculo lo reinterpreta cada Excel según su configuración regional —el 18 de
 * septiembre puede leerse como un mes 18 inválido o como otra fecha—, y además `dd/mm` no ordena.
 * La hora es la LOCAL de quien descarga, como el resto del producto.
 */

export const CABECERA_DE_PQRS = [
  "Radicado",
  "Unidad",
  "Persona",
  "Categoría",
  "Tipo",
  "Prioridad",
  "Asunto",
  "Mensaje",
  "Estado",
  "Radicado el",
  "Respondido el",
  "Respondió",
  "Respuesta",
  "Evidencias",
] as const;

const ESTADOS: Record<string, string> = {
  open: "Abierto",
  in_progress: "En proceso",
  responded: "Respondido",
  resolved: "Resuelto",
  closed: "Cerrado",
};

/** Sin prioridad NO es «media»: el ticket nació sin ese eje y la hoja lo dice vacío. */
function prioridad(ticket: Ticket): string {
  return ticket.priority ? getTicketPriorityLabel(ticket.priority) : "";
}

export function fechaParaLaHoja(valor: unknown): string {
  if (!valor) return "";
  const fecha =
    typeof valor === "object" && valor !== null && "toDate" in valor && typeof (valor as { toDate?: () => Date }).toDate === "function"
      ? (valor as { toDate: () => Date }).toDate()
      : new Date(String(valor));
  if (Number.isNaN(fecha.getTime())) return "";
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())} ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

export function filasDePqrs(
  tickets: readonly Ticket[],
  indiceDeUnidades: UnitIndex,
  nombrePorUid: ReadonlyMap<string, string>,
): FilasDeHoja {
  return [
    [...CABECERA_DE_PQRS],
    ...tickets.map((ticket) => [
      ticket.radicado ?? "",
      unidadDelTicket(ticket, indiceDeUnidades),
      personaDelTicket(ticket, nombrePorUid),
      getTicketCategoryLabel(ticket.category),
      getTicketTypeLabel(ticket.type),
      prioridad(ticket),
      ticket.subject ?? "",
      ticket.message ?? "",
      ESTADOS[ticket.status] ?? ticket.status,
      fechaParaLaHoja(ticket.radicationDate ?? ticket.createdAt),
      fechaParaLaHoja(ticket.respondedAt),
      ticket.respondedByName ?? "",
      ticket.response ?? "",
      // El nombre de cada archivo, no su URL: la URL lleva un token de descarga y una hoja de
      // cálculo se reenvía por correo sin pensarlo.
      evidenciasDeLaSolucion(ticket).map((e) => e.name).join(" · "),
    ]),
  ];
}

/** `pqrs-2026-09-18`, con el día LOCAL. */
export function nombreDelArchivoDePqrs(ahora = new Date()): string {
  return `pqrs-${fechaParaLaHoja(ahora).slice(0, 10)}`;
}

export function descargarPqrs(
  tickets: readonly Ticket[],
  indiceDeUnidades: UnitIndex,
  nombrePorUid: ReadonlyMap<string, string>,
  formato: FormatoDeHoja = "xlsx",
) {
  descargarFilas(filasDePqrs(tickets, indiceDeUnidades, nombrePorUid), nombreDelArchivoDePqrs(), formato, "PQRS");
}
