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
 * Orden de lectura del plan: por código y **numéricamente**, no como texto.
 *
 * Ordenar `["1.10", "1.2"]` como cadenas pone la 1.10 antes que la 1.2, que es
 * exactamente el desorden que un contador nota al primer vistazo.
 */
export function compararCodigos(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  return (pa[0] - pb[0]) || ((pa[1] ?? 0) - (pb[1] ?? 0));
}
