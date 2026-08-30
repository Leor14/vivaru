/**
 * Espejo mínimo del vocabulario de país para los MENSAJES DE ERROR.
 *
 * No es duplicación por descuido: los errores de la corrida por coeficiente
 * los lee una persona («No se puede generar por indiviso: sin indiviso Lote
 * 7»), y el servidor es quien los redacta. Si aquí se dijera «coeficiente»
 * mientras la pantalla dice «indiviso», el administrador mexicano leería un
 * error sobre algo que no reconoce.
 *
 * ⚠️ **ESPEJO de `src/lib/config/vocabulario-pais.ts`**, que es el canónico y
 * lleva además los tipos de cuenta y los textos de ayuda. `src/` no puede
 * importar de `functions/` (rompe el build de App Hosting, ver CLAUDE.md).
 * Aquí vive **solo** lo que el servidor necesita para hablar. Si cambias una
 * palabra allí, cámbiala aquí.
 */

/** Solo el término corto: es lo único que aparece en un mensaje de error. */
const POR_PAIS: Record<string, string> = {
  CO: "coeficiente",
  EC: "alícuota",
  MX: "indiviso",
};

/** Término neutro cuando el conjunto no tiene país, igual que en el cliente. */
const NEUTRO = "porcentaje";

export function terminoCoeficiente(country: string | undefined): string {
  if (!country) return NEUTRO;
  return POR_PAIS[country.toUpperCase()] ?? NEUTRO;
}

/**
 * Cómo se llama la cuota ordinaria mensual, por país. Espejo de `cuotaMensual`
 * en `src/lib/config/vocabulario-pais.ts`.
 *
 * **Existe porque el aviso del recibo lo lee un RESIDENTE** (§9 y CA13 de
 * `PRD-V-FLOW-002`), y el servidor es quien lo redacta. Sin esto habría que
 * tirar de `descripcionDeCobro`, que devuelve **«alícuota» para los tres
 * países**: es la palabra ecuatoriana, y un condómino de Ciudad de México no la
 * usa —dice «cuota de mantenimiento»—. Aquello es correcto donde está, en el
 * concepto del asiento del libro, que lo lee la administración; en un correo al
 * residente sería justo el defecto que documenta la decisión del 22 de agosto de
 * 2026.
 *
 * Ecuador dice «alícuota mensual» a propósito: su ley usa la misma palabra para
 * el porcentaje y para la cuota, así que aquí se desambigua.
 */
const CUOTA_MENSUAL_POR_PAIS: Record<string, string> = {
  CO: "cuota de administración",
  EC: "alícuota mensual",
  MX: "cuota de mantenimiento",
};

const CUOTA_MENSUAL_NEUTRO = "cuota mensual";

export function terminoCuotaMensual(country: string | undefined): string {
  if (!country) return CUOTA_MENSUAL_NEUTRO;
  return CUOTA_MENSUAL_POR_PAIS[country.toUpperCase()] ?? CUOTA_MENSUAL_NEUTRO;
}

/**
 * El documento que certifica que la unidad no debe. Espejo de `pazYSalvo` en
 * `src/lib/config/vocabulario-pais.ts` — decidido por David el 30 ago 2026.
 *
 * **Existe porque el «no» del servidor lo lee una persona**: el rechazo de
 * `emitClearanceCertificate` nombra la deuda (CA de `PRD-V-FEAT-004`), y a un
 * condómino de CDMX «paz y salvo» no le dice nada — su notario le pide la
 * «constancia de no adeudo». El artículo viaja junto al nombre porque el
 * género cambia con el país (EL certificado, LA constancia).
 */
const PAZ_Y_SALVO_POR_PAIS: Record<string, { nombre: string; articulo: "el" | "la" }> = {
  CO: { nombre: "paz y salvo", articulo: "el" },
  EC: { nombre: "certificado de expensas", articulo: "el" },
  MX: { nombre: "constancia de no adeudo", articulo: "la" },
};

const PAZ_Y_SALVO_NEUTRO = { nombre: "certificado de no adeudo", articulo: "el" as const };

export function terminoPazYSalvo(country: string | undefined): { nombre: string; articulo: "el" | "la" } {
  if (!country) return PAZ_Y_SALVO_NEUTRO;
  return PAZ_Y_SALVO_POR_PAIS[country.toUpperCase()] ?? PAZ_Y_SALVO_NEUTRO;
}
