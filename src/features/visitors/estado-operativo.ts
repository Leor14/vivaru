import { combineLocalDateTime } from "@/utils/date";
import { estadoDeAutorizacion } from "./autorizacion";
import type { VisitorPass } from "@/types/domain";

/**
 * **El estado que ve la portería en la píldora de cada visita.**
 *
 * Vivía dentro de `GuardVisitors.tsx` y salió de ahí el 31 de agosto de 2026 para poder probarlo,
 * porque **tenía un defecto que solo se vio abriendo la pantalla**: marcaba «Expirado» en rojo una
 * visita de portería recién capturada, mientras el residente todavía tenía cinco minutos para
 * contestar y el guardia tenía a la persona delante.
 *
 * **La regla no estaba mal: estaba aplicada a un flujo para el que no se escribió.** «Se pasó la
 * hora de la cita» es correcto para un pase de QR, que se emite de antemano; una visita de
 * portería **nace en el instante en que alguien está en la puerta**, así que su hora ya pasó al
 * segundo de crearla. Es el mismo patrón que este repositorio ya conoce con otro nombre: una
 * condición cierta que significa lo contrario en el caso nuevo.
 */

export type EstadoOperativo = "scheduled" | "inside" | "completed" | "expired";

/**
 * Una autorización de larga duración está vigente hasta el fin del día de `validUntil`.
 *
 * **Se exporta porque la usan DOS sitios** —la píldora y el check-out, que decide si el pase queda
 * reentrable—, y tenerla dos veces es la forma más barata de que un día digan cosas distintas.
 */
export function dentroDeVigencia(item: Pick<VisitorPass, "validUntil">, ahoraMs: number): boolean {
  if (!item.validUntil) return true;
  const finDelDia = new Date(`${item.validUntil}T23:59:59`);
  return Number.isNaN(finDelDia.getTime()) ? true : finDelDia.getTime() >= ahoraMs;
}

export function resolverEstadoOperativo(item: VisitorPass, ahoraMs: number): EstadoOperativo {
  if (item.status === "inside") return "inside";
  if (item.status === "completed") return "completed";

  /**
   * **Las visitas de portería NO tienen cita**, así que la regla de la hora no les aplica. Su
   * vigencia la gobierna la autorización, y quien la explica de verdad es el panel de debajo
   * —«Esperando al residente · 4:12», «Nadie contestó»—, que dice mucho más que una píldora.
   *
   * Solo `rechazada` se pinta como muerta: una `expirada` sigue viva porque el guardia puede
   * rescatarla por la vía B sin recapturar los datos (`CA6`).
   */
  if (item.origen === "porteria" || item.authorizationStatus) {
    const autorizacion = estadoDeAutorizacion(
      item.authorizationStatus,
      item.authorizationRequestedAt ? Date.parse(item.authorizationRequestedAt) : null,
      ahoraMs,
    );
    return autorizacion === "rechazada" ? "expired" : "scheduled";
  }

  // Larga duración: vigente mientras no se pase `validUntil` (ingresos repetidos).
  if (item.authorizationType === "larga_duracion" && item.validUntil) {
    return dentroDeVigencia(item, ahoraMs) ? "scheduled" : "expired";
  }

  // Puntual / legado: expira al pasar la fecha-hora programada. **Es la regla de siempre y sigue
  // siendo correcta aquí**: un QR se emite de antemano para una hora concreta.
  const fecha = item.date?.trim() ? combineLocalDateTime(item.date.trim(), item.scheduledTime?.trim()) : null;
  if (!fecha) return "scheduled";
  return fecha.getTime() < ahoraMs ? "expired" : "scheduled";
}
