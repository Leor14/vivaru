"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIVO_RECHAZO = exports.RUTA_CORREOS_DEL_EQUIPO = exports.DOMINIOS_INERTES = void 0;
exports.dominioDe = dominioDe;
exports.esDominioInerte = esDominioInerte;
exports.buzonAdmisible = buzonAdmisible;
exports.normalizarCorreosDelEquipo = normalizarCorreosDelEquipo;
exports.leerCorreosDelEquipo = leerCorreosDelEquipo;
exports.conjuntoSinClienteDetras = conjuntoSinClienteDetras;
exports.buzonAdmisibleEnConjunto = buzonAdmisibleEnConjunto;
const firestore_1 = require("firebase-admin/firestore");
/**
 * `PRD-V-PLAT-006` · el predicado único de «esta dirección se puede tocar en este conjunto».
 *
 * **Por qué existe.** Los conjuntos que no tienen cliente detrás son el escaparate del equipo, y
 * dentro de ellos han acabado direcciones de personas que nadie sabe de quién son: `DATO-001`
 * limpió siete el 27 ago 2026 por su FORMA y dejó once que el patrón no cazaba. La limpieza
 * arregla el pasado; esto cierra la puerta.
 *
 * **Lo que este módulo NO hace, y es deliberado.** No decide qué conjunto está marcado por su
 * `status`, su `isExample` ni su `trialEndsAt`. `isExample` lo llevan los NUEVE conjuntos de
 * producción —los dos del trial incluidos, cuyo administrador es un prospecto con su correo
 * real por diseño—, así que derivar la marca de él rechazaría al primer cliente que llegue.
 * La marca es un campo explícito con dueño (`RN-1`). Cf. `la-suite-no-encadena`: un valor no
 * sirve de sustituto de un hecho.
 *
 * **El gemelo que ya existía.** `assertCanInviteRealPeople` (`trial-modules.ts`) resuelve la
 * mitad de este problema desde el trial: bloquea invitar residentes reales cuando el conjunto
 * está en `trial` o `expired`. Su criterio es el estado, no la marca, y se aplica en un solo
 * punto de los cuatro por los que sale correo a una persona. Este módulo sigue su forma
 * —`assert…(tenantId)` que lee `tenants/{id}` y lanza `failed-precondition` legible— y no la
 * reemplaza: las dos puertas conviven y protegen cosas distintas.
 */
/**
 * Dominios que no alcanzan a nadie: los de las semillas y el de las cuentas de prueba.
 *
 * **Esta es la copia canónica.** Existen otras dos, en `functions/scripts/`
 * (`informe-correos-en-conjuntos-de-ejemplo.mjs` y `sanear-correos-de-prueba.mjs`), porque los
 * scripts corren con Node suelto y no importan de `src`. `tests/catalogo-de-dominios-inertes.test.ts`
 * vigila que no diverjan: cinco copias del mismo mapa fue la trampa de `UX-004`.
 */
exports.DOMINIOS_INERTES = [
    "ejemplo.vivaru.app",
    "demo.grupovivaru.com",
    "hogaru.test",
    "demo.co",
    "example.com",
];
exports.RUTA_CORREOS_DEL_EQUIPO = "config/correosDelEquipo";
const EQUIPO_VACIO = { dominios: [], direcciones: [] };
/** El dominio de una dirección, en minúsculas, o `null` si no es una dirección. */
function dominioDe(email) {
    if (typeof email !== "string")
        return null;
    const arroba = email.lastIndexOf("@");
    if (arroba <= 0 || arroba === email.length - 1)
        return null;
    return email.slice(arroba + 1).trim().toLowerCase();
}
/** Un dominio es inerte si está en el catálogo o es un subdominio suyo. */
function esDominioInerte(dominio) {
    if (!dominio)
        return false;
    return exports.DOMINIOS_INERTES.some((d) => dominio === d || dominio.endsWith(`.${d}`));
}
/**
 * `RN-2` · la decisión pura, sin base de datos, para poder probarla y para que la puerta de
 * salida no dependa de una lectura cuando ya tiene la lista.
 *
 * **La comparación NO normaliza el `+alias`** a propósito: `david+res1@gmail.com` se admite solo
 * si está listada tal cual o si su dominio entero está en la lista del equipo. Quitar el alias
 * convertiría una dirección listada en una familia infinita de direcciones admitidas, que es
 * justo lo que la puerta viene a impedir.
 */
function buzonAdmisible(email, equipo) {
    const limpio = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!limpio)
        return false;
    const dominio = dominioDe(limpio);
    if (!dominio)
        return false;
    if (esDominioInerte(dominio))
        return true;
    if (equipo.dominios.includes(dominio))
        return true;
    return equipo.direcciones.includes(limpio);
}
/** Normaliza lo que haya en `config/correosDelEquipo`, que lo edita una persona a mano. */
function normalizarCorreosDelEquipo(data) {
    const d = (data ?? {});
    const lista = (v) => Array.isArray(v)
        ? v.filter((x) => typeof x === "string").map((x) => x.trim().toLowerCase()).filter(Boolean)
        : [];
    return { dominios: lista(d.dominios), direcciones: lista(d.direcciones) };
}
/**
 * Lee la lista del equipo. **Es global, no del conjunto**: el equipo es el mismo en los nueve.
 *
 * Si el documento no existe devuelve listas vacías, y entonces solo pasan los dominios inertes.
 * Es el borde seguro: la puerta se cierra de más, nunca de menos, y el síntoma es visible
 * (`rechazado-puerta` con motivo) en vez de silencioso.
 */
async function leerCorreosDelEquipo() {
    try {
        const [coleccion, documento] = exports.RUTA_CORREOS_DEL_EQUIPO.split("/");
        const snap = await (0, firestore_1.getFirestore)().collection(coleccion).doc(documento).get();
        if (!snap.exists)
            return EQUIPO_VACIO;
        return normalizarCorreosDelEquipo(snap.data());
    }
    catch (e) {
        console.error("[buzones] no se pudo leer la lista del equipo", e);
        return EQUIPO_VACIO;
    }
}
/**
 * `RN-1` · si el conjunto lleva la marca del superadmin.
 *
 * Un conjunto que no existe **no está marcado**: la puerta no inventa restricciones sobre lo que
 * no puede leer.
 */
async function conjuntoSinClienteDetras(tenantId) {
    if (!tenantId)
        return false;
    try {
        const snap = await (0, firestore_1.getFirestore)().collection("tenants").doc(tenantId).get();
        if (!snap.exists)
            return false;
        return snap.data()?.sinClienteDetras === true;
    }
    catch (e) {
        console.error("[buzones] no se pudo leer la marca del conjunto", tenantId, e);
        return false;
    }
}
/**
 * El predicado completo: en ESTE conjunto, ¿se puede escribir o escribir A esta dirección?
 *
 * Devuelve `true` cuando el conjunto no está marcado — que es el caso de todo conjunto con
 * cliente y de los dos del trial.
 */
async function buzonAdmisibleEnConjunto(tenantId, email) {
    if (!(await conjuntoSinClienteDetras(tenantId)))
        return true;
    return buzonAdmisible(email, await leerCorreosDelEquipo());
}
/** El motivo legible, uno solo, para que el rechazo diga lo mismo en la entrada y en la salida. */
exports.MOTIVO_RECHAZO = "En un conjunto de demostración solo se admiten direcciones de prueba o del equipo.";
