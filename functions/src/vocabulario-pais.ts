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
 * Cómo se llama **el inmueble entero**. Espejo de `copropiedad` en
 * `src/lib/config/vocabulario-pais.ts`.
 *
 * ⚠️ **HOY NO LO LLAMA NADIE EN EL SERVIDOR, y está aquí a propósito.** Rompe
 * la regla de la cabecera —«aquí vive solo lo que el servidor necesita para
 * hablar»— porque el consumidor ya existe, solo que todavía dice la palabra a
 * mano: `advances.ts` («Ese anticipo pertenece a otro conjunto»),
 * `coefficient-billing.ts` («El conjunto no tiene unidades activas»),
 * `management-companies.ts`, `clearance-certificates.ts` e `index.ts` le dicen
 * «conjunto» a un administrador mexicano que su ley llama «condominio». Son
 * ~15 cadenas y no se tocaron en la pasada del 27 de agosto de 2026, que iba
 * del pie de pantalla.
 *
 * Puesto de otro modo: esto no es un espejo vacío, es **la mitad servidor de
 * un arreglo a medio hacer**. Si al adoptarlo en esos mensajes resulta que
 * sobra, se borra; lo que no se puede es dejar que las dos listas se separen
 * mientras tanto, que es justo para lo que existe este archivo.
 */
const COPROPIEDAD_POR_PAIS: Record<string, string> = {
  CO: "conjunto",
  EC: "condominio",
  MX: "condominio",
};

const COPROPIEDAD_NEUTRO = "copropiedad";

export function terminoCopropiedad(country: string | undefined): string {
  if (!country) return COPROPIEDAD_NEUTRO;
  return COPROPIEDAD_POR_PAIS[country.toUpperCase()] ?? COPROPIEDAD_NEUTRO;
}
