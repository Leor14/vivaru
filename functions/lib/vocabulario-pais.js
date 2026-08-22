"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.terminoCoeficiente = terminoCoeficiente;
/** Solo el término corto: es lo único que aparece en un mensaje de error. */
const POR_PAIS = {
    CO: "coeficiente",
    EC: "alícuota",
    MX: "indiviso",
};
/** Término neutro cuando el conjunto no tiene país, igual que en el cliente. */
const NEUTRO = "porcentaje";
function terminoCoeficiente(country) {
    if (!country)
        return NEUTRO;
    return POR_PAIS[country.toUpperCase()] ?? NEUTRO;
}
