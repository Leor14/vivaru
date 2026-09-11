"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MENSAJE_CUENTA_DE_OTRO_ROL = void 0;
exports.planearRevocacion = planearRevocacion;
exports.esResidenteDeEsteConjunto = esResidenteDeEsteConjunto;
exports.revocarAccesoDeResidente = revocarAccesoDeResidente;
exports.cuentaReutilizableParaResidente = cuentaReutilizableParaResidente;
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
/**
 * Revocación del acceso de un residente al borrarlo.
 *
 * **El defecto que cierra.** `deletePerson` (`src/features/admin/services.ts`)
 * borraba **un solo documento**: `people/{id}`. Pero dar acceso a un residente
 * crea **cinco cosas** —cuenta de Auth, custom claim con el `tenantId`,
 * `users/{uid}`, `tenantUsers/{tenantId}_{uid}` y el `authUid` en la ficha—, y
 * las cuatro primeras sobrevivían al borrado.
 *
 * Y no es una ventana hasta que caduque el token: **las reglas conceden
 * pertenencia por la EXISTENCIA del documento de membresía** y nunca miran su
 * campo `status` (`firestore.rules`, `tenantMember()`). Mientras ese documento
 * exista, la persona borrada entra. Agravado por el diálogo de confirmación, que
 * promete «se perderá su acceso a la plataforma».
 *
 * **Por qué vive en el servidor.** Desactivar una cuenta y revocar sus tokens
 * son operaciones del Admin SDK. El cliente no puede hacerlas ni debería: si
 * pudiera, cualquiera con la consola abierta podría desactivar cuentas ajenas.
 *
 * **La decisión de David (19 ago 2026): la cuenta se BORRA, no se desactiva.**
 * Tres motivos: es lo que ya hace `deleteOperationalUser` con administradores y
 * guardas —el sistema queda coherente consigo mismo—; el diálogo ya promete que
 * no se puede deshacer; y borra de verdad el correo y el nombre, que es la misma
 * supresión que le estamos exigiendo a Albert. Si la persona vuelve al conjunto,
 * `provisionResidentTemporaryAccess` le crea la cuenta otra vez.
 *
 * **Dos casos que el patrón de `deleteOperationalUser` no cubría** y que aquí sí
 * pasan, porque un residente no es un usuario operativo:
 *
 * 1. **La misma cuenta en dos conjuntos.** Borrarla dejaría a la persona fuera
 *    del otro. Se le quita la membresía de ESTE conjunto y la cuenta solo se
 *    borra si era la última.
 * 2. **La cuenta resulta ser de un admin o un guarda.** Se rechaza y se manda a
 *    la pantalla de usuarios operativos. Borrar un residente no puede dejar al
 *    conjunto sin administrador por un descuido.
 *
 * **Y un tercero que el patrón tampoco cubría, cerrado por `PRD-V-FIX-004`:**
 *
 * 3. **La ficha apunta a una cuenta que no es de este conjunto.** El `authUid` lo
 *    podía escribir el administrador desde el navegador, y la guarda del punto 2
 *    solo funcionaba si la membresía de AQUÍ existía. Sin ella, la cuenta se
 *    reapuntaba o se borraba según sus OTROS conjuntos — y la del superadmin, que
 *    no tiene ninguno, se borraba entera. Ahora, sin membresía aquí, la cuenta solo
 *    se toca si ella misma dice ser residente de este conjunto.
 */
const db = () => (0, firestore_1.getFirestore)();
const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");
/** Roles que NO se gestionan por esta vía: tienen su propia pantalla y sus propios guardrales. */
const ROLES_OPERATIVOS = new Set(["tenant_admin", "admin_tenant", "security_guard"]);
/**
 * Decide QUÉ hay que hacer, sin hacer nada. Separada a propósito: es la parte
 * que se puede probar sin emulador, y es donde están las decisiones que importan.
 */
function planearRevocacion(input) {
    const uid = texto(input.authUid);
    if (!uid) {
        // La mayoría de residentes nunca pidieron acceso. No es un error: no hay
        // nada que revocar y el borrado de la ficha sigue su camino.
        return { accion: "sin-cuenta", motivo: "la persona no tiene cuenta de acceso" };
    }
    const rol = texto(input.rolEnEsteConjunto);
    if (rol && ROLES_OPERATIVOS.has(rol)) {
        throw new https_1.HttpsError("failed-precondition", "Esa cuenta es de un administrador o un guarda del conjunto. Gestiónala desde Usuarios operativos, no desde Residentes.");
    }
    // `FIX-004` R2: solo se revoca una membresía de RESIDENTE. Un rol que no está en la
    // lista de operativos —el alias viejo `security`, el `committee` que no concede
    // nadie— pasaba de largo y seguía hacia el borrado.
    if (rol && rol !== "resident") {
        throw new https_1.HttpsError("failed-precondition", "Esa cuenta no es de un residente de este conjunto. Gestiónala desde Usuarios operativos, no desde Residentes.");
    }
    // `FIX-004` `D-B`: sin membresía aquí, la cuenta solo es de este conjunto si ella lo
    // dice. La ficha no basta: su `authUid` lo podía escribir el administrador, y así una
    // ficha apuntando al superadmin —que no tiene membresías— le borraba la cuenta.
    if (!rol && !input.cuentaEsResidenteDeEsteConjunto) {
        return {
            accion: "sin-membresia",
            motivo: "la ficha apuntaba a una cuenta que no es residente de este conjunto; la cuenta no se tocó",
        };
    }
    const otras = input.membresiasEnOtrosConjuntos.filter((m) => texto(m.tenantId));
    if (otras.length > 0) {
        const restante = otras[0];
        return {
            accion: "revocar-y-conservar",
            motivo: `la cuenta sigue perteneciendo a ${otras.length} conjunto(s) más`,
            tenantIdRestante: texto(restante.tenantId),
            rolRestante: texto(restante.role) || "resident",
        };
    }
    return { accion: "revocar-y-borrar", motivo: "era su única pertenencia" };
}
/**
 * `PRD-V-FIX-004` · ¿La cuenta es, POR SU PROPIO REGISTRO, residente de este conjunto?
 *
 * Mira las dos fuentes que solo escribe el servidor: `users/{uid}` y el claim. Basta
 * una: un alta a medias deja el claim sin documentos —se escribe antes—, y unos datos
 * viejos pueden traer `users` sin claim. **Lo que no vale es lo que escribe el
 * cliente**, el `authUid` de la ficha, que es justo en lo que se confiaba.
 */
function esResidenteDeEsteConjunto(cuenta, tenantId) {
    const deAqui = (rol, conjunto) => texto(rol) === "resident" && texto(conjunto) === tenantId;
    return deAqui(cuenta.perfil?.role, cuenta.perfil?.tenantId) || deAqui(cuenta.claims?.role, cuenta.claims?.tenantId);
}
/**
 * Ejecuta el plan. El orden importa y no es casual: **primero se cierra la
 * puerta, después se limpia**. Si algo falla a mitad, el peor estado posible es
 * «acceso ya revocado, fichas a medio borrar» —recuperable reintentando—, nunca
 * «ficha borrada, acceso vivo», que es justo el defecto que esto cierra.
 */
async function revocarAccesoDeResidente(input, actorUid) {
    const tenantId = texto(input.tenantId);
    const personId = texto(input.personId);
    if (!tenantId || !personId) {
        throw new https_1.HttpsError("invalid-argument", "Debes indicar el conjunto y la persona.");
    }
    const firestore = db();
    const personSnap = await firestore.collection("people").doc(personId).get();
    if (!personSnap.exists) {
        throw new https_1.HttpsError("not-found", "La persona no existe.");
    }
    const person = personSnap.data();
    if (texto(person.tenantId) !== tenantId) {
        throw new https_1.HttpsError("permission-denied", "La persona no pertenece a este conjunto.");
    }
    const targetUid = texto(person.authUid);
    if (!targetUid) {
        return { revoked: false, accion: "sin-cuenta", motivo: "la persona no tiene cuenta de acceso", uid: null };
    }
    // Nadie se borra a sí mismo por esta vía: dejaría al actor sin sesión a mitad
    // de la operación y sin forma de terminarla.
    if (targetUid === actorUid) {
        throw new https_1.HttpsError("failed-precondition", "No puedes eliminar tu propia cuenta desde aquí.");
    }
    const membershipRef = firestore.collection("tenantUsers").doc(`${tenantId}_${targetUid}`);
    const membershipSnap = await membershipRef.get();
    const rolEnEsteConjunto = membershipSnap.exists
        ? texto(membershipSnap.data().role)
        : null;
    const todas = await firestore.collection("tenantUsers").where("uid", "==", targetUid).get();
    const membresiasEnOtrosConjuntos = todas.docs
        .filter((d) => d.id !== membershipRef.id)
        .map((d) => {
        const data = d.data();
        return { tenantId: texto(data.tenantId), role: texto(data.role) };
    })
        .filter((m) => m.tenantId && m.tenantId !== tenantId);
    const authApi = (0, auth_1.getAuth)();
    // Sin membresía aquí, se le pregunta a la cuenta de quién es (`FIX-004`). Con
    // membresía no hace falta: ese documento solo lo escribe el servidor.
    let cuentaEsResidenteDeEsteConjunto = false;
    if (!membershipSnap.exists) {
        const [perfilSnap, registro] = await Promise.all([
            firestore.collection("users").doc(targetUid).get(),
            authApi.getUser(targetUid).catch((error) => {
                if (codigoDe(error) === "auth/user-not-found")
                    return null;
                throw error;
            }),
        ]);
        cuentaEsResidenteDeEsteConjunto = esResidenteDeEsteConjunto({
            perfil: perfilSnap.exists ? perfilSnap.data() : null,
            claims: registro?.customClaims ?? null,
        }, tenantId);
    }
    const plan = planearRevocacion({
        authUid: targetUid,
        rolEnEsteConjunto,
        membresiasEnOtrosConjuntos,
        cuentaEsResidenteDeEsteConjunto,
    });
    // Una cuenta que no es de este conjunto no se toca: ni membresía, ni sesiones, ni
    // claim. La ficha sigue su camino y se borra.
    if (plan.accion === "sin-membresia") {
        return { revoked: false, accion: plan.accion, motivo: plan.motivo, uid: null };
    }
    // 1. La puerta, primero. Quitar la membresía es lo que de verdad cierra el
    //    acceso, porque la regla concede por existencia de ese documento.
    if (membershipSnap.exists) {
        await membershipRef.delete();
    }
    await authApi.revokeRefreshTokens(targetUid).catch(ignorarSiNoExiste);
    // 2. El claim. Si le queda otro conjunto, se le reapunta ahí; si no, se limpia
    //    —el claim `tenantId` es lo que Storage usa para conceder, así que dejarlo
    //    apuntando a un conjunto del que ya no es miembro sería el mismo defecto
    //    con otra cara.
    if (plan.accion === "revocar-y-conservar") {
        await authApi
            .setCustomUserClaims(targetUid, { role: plan.rolRestante, tenantId: plan.tenantIdRestante })
            .catch(ignorarSiNoExiste);
        return { revoked: true, accion: plan.accion, motivo: plan.motivo, uid: targetUid };
    }
    // 3. Era su única pertenencia: se va entera.
    await authApi.setCustomUserClaims(targetUid, null).catch(ignorarSiNoExiste);
    await firestore.collection("users").doc(targetUid).delete();
    await authApi.deleteUser(targetUid).catch(ignorarSiNoExiste);
    return { revoked: true, accion: plan.accion, motivo: plan.motivo, uid: targetUid };
}
/**
 * Una cuenta que ya no está en Auth no es un fallo de esta operación: es el
 * estado al que queremos llegar. Cualquier otro error sí sube.
 */
function ignorarSiNoExiste(error) {
    if (codigoDe(error) === "auth/user-not-found")
        return;
    throw error;
}
function codigoDe(error) {
    return typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
}
/**
 * `PRD-V-FIX-004` `D-A` — el texto con el que «Enviar acceso» rechaza una cuenta de
 * otro rol.
 *
 * **No dice qué conjunto ni qué rol exacto** (`R5`): quien lo lee es el administrador
 * de OTRO conjunto, y no tiene por qué saber dónde administra otra persona. Sí le dice
 * qué hacer.
 */
exports.MENSAJE_CUENTA_DE_OTRO_ROL = "Ese correo ya tiene una cuenta de administración o portería en Vivaru, y una cuenta no puede ser además residente. Registra al residente con otro correo.";
/**
 * `PRD-V-FIX-004` `D-A` — la cuenta que «Enviar acceso» puede reutilizar para este
 * correo, o `null` si no hay ninguna. **Lanza si existe y es de otro rol**, y lo hace
 * antes de que nadie escriba nada. Hasta el 11 sep 2026 `upsertResidentTemporaryAccess`
 * la reutilizaba sin mirar: le cambiaba la clave y la convertía en residente, y así
 * perdía el panel un administrador de otro conjunto y la consola el superadmin.
 *
 * Mira las DOS fuentes del rol, `users/{uid}.role` y el claim: las dos las escribe solo
 * el servidor, y basta con que una diga «no residente» para que la cuenta sea de otra
 * persona. Una cuenta sin rol en ningún lado —huérfana— se reutiliza, como hoy: es la
 * única forma de recuperarla.
 */
async function cuentaReutilizableParaResidente(email) {
    const existente = await (0, auth_1.getAuth)()
        .getUserByEmail(email)
        .catch((error) => {
        if (codigoDe(error) === "auth/user-not-found")
            return null;
        throw error;
    });
    if (!existente)
        return null;
    const perfil = await db().collection("users").doc(existente.uid).get();
    const roles = [
        perfil.exists ? texto(perfil.data().role) : "",
        texto(existente.customClaims?.role),
    ];
    if (roles.some((rol) => rol && rol !== "resident")) {
        throw new https_1.HttpsError("failed-precondition", exports.MENSAJE_CUENTA_DE_OTRO_ROL);
    }
    return existente;
}
