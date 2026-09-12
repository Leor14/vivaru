"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLECCION_DE_LIMITES = void 0;
exports.decidirIntento = decidirIntento;
exports.claveDeLimite = claveDeLimite;
exports.consumirIntento = consumirIntento;
const node_crypto_1 = require("node:crypto");
const firestore_1 = require("firebase-admin/firestore");
/**
 * `PRD-V-FIX-005` · R2 / R8 / `CF2` / `CF4` — cuántas veces se ha intentado algo, por clave.
 *
 * Lo usan las dos puertas que no pueden servir de oráculo: el alta de prueba (por correo, y por
 * IP cuando H5 diga cuál es la de verdad) y el alta de usuarios operativos en una prueba. Vive en
 * `limitesDeIntentos`, que ninguna regla abre: solo lo escribe el servidor.
 *
 * **La clave va con hash** (sha-256): contar los intentos de un correo no es motivo para guardarlo
 * en claro. `expiraEn` es para una política de TTL de Firestore sobre la colección; sin ella los
 * documentos se quedan —son diminutos—, pero la ventana se respeta igual, porque se decide
 * comparando `reiniciaEn` con la hora.
 */
exports.COLECCION_DE_LIMITES = "limitesDeIntentos";
/** Pura: dado lo guardado, ¿pasa este intento, y cómo queda el contador? El rechazo no suma. */
function decidirIntento(actual, max, ventanaMs, ahora) {
    if (!actual || actual.reiniciaEn <= ahora) {
        return { permitido: true, siguiente: { conteo: 1, reiniciaEn: ahora + ventanaMs } };
    }
    if (actual.conteo >= max)
        return { permitido: false, siguiente: actual };
    return { permitido: true, siguiente: { conteo: actual.conteo + 1, reiniciaEn: actual.reiniciaEn } };
}
function claveDeLimite(clave) {
    return (0, node_crypto_1.createHash)("sha256").update(clave).digest("hex");
}
/** Cuenta un intento y dice si pasa. En transacción: dos intentos a la vez no se pisan. */
async function consumirIntento(clave, max, ventanaMs) {
    const db = (0, firestore_1.getFirestore)();
    const ref = db.collection(exports.COLECCION_DE_LIMITES).doc(claveDeLimite(clave));
    return db.runTransaction(async (tx) => {
        const datos = (await tx.get(ref)).data();
        const actual = typeof datos?.conteo === "number" && typeof datos?.reiniciaEn === "number"
            ? { conteo: datos.conteo, reiniciaEn: datos.reiniciaEn }
            : undefined;
        const { permitido, siguiente } = decidirIntento(actual, max, ventanaMs, Date.now());
        if (permitido)
            tx.set(ref, { ...siguiente, expiraEn: firestore_1.Timestamp.fromMillis(siguiente.reiniciaEn) });
        return permitido;
    });
}
