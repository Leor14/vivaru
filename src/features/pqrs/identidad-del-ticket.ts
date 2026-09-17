import { resolveUnitName, UNRESOLVED_UNIT_LABEL, type UnitIndex } from "@/utils/unitLabel";

/**
 * **`L-21d` — de quién y de qué unidad es un PQRS, en palabras.**
 *
 * Lote «Análisis de la plataforma», plan `docs/plan-lote-analisis-plataforma.md` (T4.1). En la
 * captura de la administradora una fila decía `torre1-G1bWNzZJuakw9KRoAx7p` y «Residente»: la
 * pantalla pintaba `unitLabel` tal cual, y esa etiqueta la fabricó un `createTicket` antiguo
 * pegando la torre a un id de Firestore. Medido el 17 sep 2026 en producción: **6 de 54 tickets**
 * traen esa etiqueta, **los 6 se resuelven** por su `unitId`, y **4 no tienen nombre de residente**
 * y los 4 se recuperan por su membresía. En staging no hay ninguno sucio.
 *
 * **No arregla el dato, arregla lo que se enseña.** Corregir los tickets es aparte y con permiso;
 * el gemelo que ya lo hacía bien es `/admin/visitors`, que resuelve con el índice de unidades.
 */

export const PERSONA_SIN_NOMBRE = "Residente";

export type ReferenciasDelTicket = {
  unitId?: string | null;
  unitLabel?: string | null;
  residentId?: string | null;
  residentName?: string | null;
};

/**
 * El `unitId` manda y la etiqueta es el segundo intento: al revés, una etiqueta con un id dentro
 * se llevaría por delante un `unitId` que sí resuelve —que es exactamente el caso de los seis—.
 * Si ninguna resuelve y la etiqueta es texto humano, `resolveUnitName` la devuelve tal cual; y si
 * parece un id que no existe, cae en «Unidad no vinculada» y nunca en el id crudo.
 */
export function unidadDelTicket(ticket: ReferenciasDelTicket, indice: UnitIndex): string {
  const porId = ticket.unitId ? resolveUnitName(ticket.unitId, indice) : UNRESOLVED_UNIT_LABEL;
  if (porId !== UNRESOLVED_UNIT_LABEL) return porId;
  return ticket.unitLabel ? resolveUnitName(ticket.unitLabel, indice) : UNRESOLVED_UNIT_LABEL;
}

/**
 * El nombre guardado manda, salvo cuando es el relleno «Residente»: entonces se busca por el uid
 * de quien abrió el ticket. Si tampoco hay, se queda el relleno — no se inventa una persona.
 */
export function personaDelTicket(
  ticket: ReferenciasDelTicket,
  nombrePorUid: ReadonlyMap<string, string>,
): string {
  const guardado = (ticket.residentName ?? "").trim();
  if (guardado && guardado !== PERSONA_SIN_NOMBRE) return guardado;
  const recuperado = ticket.residentId ? (nombrePorUid.get(ticket.residentId) ?? "").trim() : "";
  return recuperado || PERSONA_SIN_NOMBRE;
}
