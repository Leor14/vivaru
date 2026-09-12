/**
 * `PRD-V-FIX-001` entrega 2 — la política de reserva por ÁREA, del lado del cliente.
 *
 * Espejo de `functions/src/reservations.ts`: la interfaz la MUESTRA y el administrador
 * la configura, pero decide el servidor (§12 de la ficha). Las constantes se comparan
 * en `tests/fix-001-e2-cliente.test.ts`.
 */

export const MIN_ANTICIPACION_POR_DEFECTO = 30;
export const MAX_ANTICIPACION_MINUTOS = 10_080;

/** La anticipación del área. Un dato roto no deja reservar sin margen: cae a los 30 de hoy, no a cero. */
export function anticipacionDelArea(amenity: { minAdvanceMinutes?: number }): number {
  const valor = amenity.minAdvanceMinutes;
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= MAX_ANTICIPACION_MINUTOS
    ? valor
    : MIN_ANTICIPACION_POR_DEFECTO;
}

/** R3 — si el área tiene política de mora, manda el área; si no, la del conjunto. */
export function aplicaMora(politicaDelConjunto: boolean | undefined, politicaDelArea: boolean | null | undefined): boolean {
  if (typeof politicaDelArea === "boolean") return politicaDelArea;
  return politicaDelConjunto === true;
}

/** El primer instante reservable: ahora más la anticipación del área. */
export function minimoPermitido(ahora: Date, minutos: number): Date {
  return new Date(ahora.getTime() + minutos * 60_000);
}

export type PoliticaDeMoraDelFormulario = "heredar" | "bloquear" | "permitir";

/** Del formulario al dato: «heredar» no escribe nada, y así el área sigue al conjunto. */
export function politicaDeMoraDesdeFormulario(valor: PoliticaDeMoraDelFormulario): boolean | undefined {
  if (valor === "bloquear") return true;
  if (valor === "permitir") return false;
  return undefined;
}

export function politicaDeMoraAFormulario(valor: boolean | null | undefined): PoliticaDeMoraDelFormulario {
  if (valor === true) return "bloquear";
  if (valor === false) return "permitir";
  return "heredar";
}
