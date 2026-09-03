/**
 * El gobierno del código de cuenta, del lado del navegador
 * (`PRD-V-PLAT-003` §11.1, D1 opción A).
 *
 * **Es un ESPEJO de `functions/src/plan-de-cuentas.ts`.** No se puede importar
 * de ahí: `src/` no puede depender de `functions/` sin romper el build de App
 * Hosting (CLAUDE.md). La propia PRD lo anticipó — «cuando la entrega 2
 * construya el formulario, `validarCodigoDeCuenta` habrá que espejarlo».
 *
 * Copiar a mano es el error que este repositorio ya cometió tres veces, así que
 * igual que el mapa de conceptos, esto lo vigila `tests/plan-de-cuentas-espejo.test.ts`
 * leyendo el fichero de `functions/` como texto.
 *
 * ## Por qué el formulario valida aunque las reglas también
 *
 * No es cinturón y tirantes por gusto: **las reglas no pueden decir POR QUÉ**.
 * Un `permission-denied` es indistinguible de «no eres administrador», y CF5
 * pide que un código mal formado se rechace **diciendo qué falla**. El servidor
 * es quien impide; esta capa es quien explica.
 */

/**
 * Numérico jerárquico de **dos niveles**: `N` o `N.M`, sin ceros a la izquierda.
 *
 * El defecto que previene está medido en Habitanto y la PRD lo dice sin rodeos:
 * **no fue elegir el formato, fue no validarlo**. Allí convivían dos rubros
 * `3.9` distintos y códigos con puntos de más. Lo primero lo impide el id
 * derivado del código; lo segundo, esta expresión.
 */
const CODIGO_PATTERN = /^[1-9]\d{0,2}(\.[1-9]\d{0,2})?$/;

export type ValidacionCodigo = { ok: true; code: string } | { ok: false; error: string };

export function validarCodigoDeCuenta(raw: string): ValidacionCodigo {
  const code = raw.trim();
  if (!code) return { ok: false, error: "El código de la cuenta es obligatorio." };
  if (!CODIGO_PATTERN.test(code)) {
    return {
      ok: false,
      error:
        "El código va como 1 o 1.2 — un nivel o dos, solo dígitos, sin ceros a la izquierda " +
        "y sin un tercer nivel.",
    };
  }
  return { ok: true, code };
}

/**
 * `true` si el código es de segundo nivel; su padre es lo que va antes del punto.
 *
 * **El padre no se elige: se deduce.** La jerarquía vive en el propio código
 * (D1, opción A), así que ofrecer un selector de cuenta padre permitiría colgar
 * la `1.3` de la `2` y dejar el código mintiendo sobre su sitio en el árbol.
 */
export function codigoPadreDe(code: string): string | undefined {
  const punto = code.indexOf(".");
  return punto === -1 ? undefined : code.slice(0, punto);
}

/**
 * **El rango reservado para las cuentas de sistema.**
 *
 * Las cuentas de la semilla viven en `N.1`–`N.49`; lo que crea un administrador
 * empieza en `N.50`. Y no es burocracia: es lo que impide una clase entera de
 * defecto que se descubrió el 23 de agosto de 2026 al añadir la vigilancia.
 *
 * ## Qué pasa sin esto
 *
 * La siembra **no pisa lo que existe** —correcto, para no borrar un renombre—,
 * así que si un administrador ya usó la `1.9` para su «Cuota de piscina» y
 * mañana la semilla reclama esa `1.9` para la vigilancia, el sembrador **la
 * salta en silencio**. Ese conjunto se queda con un `1.9` que significa otra
 * cosa que el `1.9` de todos los demás. Pasó de verdad, en staging, el mismo día.
 *
 * Y tiene dos consecuencias que no se ven hasta que duelen:
 *
 * 1. **El mapa concepto→código apuesta a que todos los conjuntos son iguales.**
 *    `CUENTA_POR_CONCEPTO` dice «vigilancia es la 1.9» para todo el mundo, así
 *    que en ese conjunto el cargo de vigilancia caería en la cuenta de piscina.
 * 2. **El consolidado entre conjuntos** de `PRD-V-PLAT-002` Fase 3 agrupa por
 *    código: sumar dos `1.9` que significan cosas distintas da una cifra falsa,
 *    que es exactamente el defecto que esta PRD existe para impedir.
 *
 * ## Por qué un rango y no una comprobación
 *
 * Es la misma decisión que el id derivado del código (§11.1): **que lo garantice
 * la construcción, no un chequeo que alguien puede olvidar**. Con el rango, la
 * semilla puede crecer para siempre sin pisar a nadie. La regla de Firestore lo
 * exige también, así que no depende de que el formulario se acuerde.
 *
 * El precio es que un administrador escriba `1.50` en vez de `1.9`. Barato.
 */
export const PRIMER_CODIGO_LIBRE = 50;

/**
 * Si un código de segundo nivel cae en el rango que se reserva la semilla.
 *
 * **Ojo: esto NO se comprueba en `validarCodigoDeCuenta`.** Aquella función dice
 * si el código está bien FORMADO, y las cuentas de la semilla —`1.1`, `2.8`—
 * están perfectamente formadas. Lo que esta responde es otra cosa: quién tiene
 * derecho a usarlo. Mezclarlas haría que la propia semilla no pasara su
 * validador.
 */
export function esCodigoReservado(code: string): boolean {
  const punto = code.indexOf(".");
  if (punto === -1) return true; // el primer nivel es estructura: «Ingresos» y «Egresos»
  return Number(code.slice(punto + 1)) < PRIMER_CODIGO_LIBRE;
}

/**
 * Id del documento, **derivado del código** (§11.1).
 *
 * Es lo que hace que la unicidad por conjunto la garantice la base y no una
 * comprobación previa del cliente, que dos pestañas abiertas ganan a la vez. La
 * regla de Firestore exige además que `code` coincida con el id.
 */
export function docIdDeCuenta(tenantId: string, code: string): string {
  return `${tenantId}_${code}`;
}

/**
 * Orden de lectura del plan: por código y numéricamente.
 *
 * **Vive en el núcleo del estado financiero y se reexporta aquí**, no se copia:
 * el informe ordena sus líneas con esta misma función y el núcleo tiene que ser
 * autocontenido para poder espejarse byte a byte en `functions/`
 * (`PRD-V-FLOW-007` entrega 1). Reexportar deja una sola definición en `src/`.
 */
export { compararCodigos } from "./nucleo-estado-financiero";
