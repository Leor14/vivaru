"use strict";
/**
 * El metadata de una auditoría, saneado antes de escribirlo.
 *
 * Vive en su propio módulo por una razón práctica: `index.ts` no se puede
 * importar desde una prueba —arranca Firebase y registra treinta y tantas
 * funciones al evaluarse—, así que lo que vive ahí dentro no se puede ejercitar.
 * Y esto **hay que poder ejercitarlo**: ver abajo.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.limpiarMetadata = limpiarMetadata;
/**
 * Quita los `undefined` del metadata de una auditoría.
 *
 * **No es higiene: es lo que evita que una operación de dinero se confirme y la
 * llamada devuelva error.** `initializeApp()` corre sin
 * `ignoreUndefinedProperties`, así que un `undefined` hace que Firestore
 * **rechace la escritura entera**. Y como se audita **fuera** de la
 * transacción, ese rechazo llega cuando el pago o el cruce ya están hechos: en
 * pantalla sale un error sobre algo que sí ocurrió, y quien opera reintenta
 * —con una clave de idempotencia nueva si cerró el formulario— y **cobra dos
 * veces**.
 *
 * **Mordió dos veces el 24 de agosto de 2026**, con dos campos opcionales
 * distintos: el `statementId` que un reparto no manda, y el `reason` que
 * `undoAdvanceApplication` no exige. La primera se diagnosticó mal —se atribuyó
 * a un doble clic— y solo se vio al medir que **faltaba la fila de auditoría**:
 * una auditoría que no se escribió es invisible, no hay error en ningún sitio.
 *
 * **Por qué aquí y no `ignoreUndefinedProperties: true` en `initializeApp()`.**
 * Aquello lo arreglaría de un plumazo y a la vez **escondería el mismo fallo en
 * todas las escrituras del proyecto**, incluidas las que sí quieren que un campo
 * obligatorio ausente reviente. El metadata de una auditoría es descriptivo por
 * naturaleza y sus campos son opcionales por diseño; el resto del proyecto no.
 *
 * **Un campo ausente simplemente no aparece**, que es lo correcto:
 * `reason: undefined` y «no se dio motivo» son la misma cosa. Un `null`
 * explícito **sí se conserva** — ahí alguien decidió decir «vacío», y eso es un
 * dato distinto de no haberlo dicho.
 */
function limpiarMetadata(metadata) {
    const limpio = {};
    for (const [clave, valor] of Object.entries(metadata)) {
        if (valor !== undefined)
            limpio[clave] = valor;
    }
    return limpio;
}
