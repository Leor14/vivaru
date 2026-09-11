"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MENSAJE_SIN_CONJUNTOS = exports.MENSAJE_PORTERIA = exports.MENSAJE_SUPERADMIN = void 0;
exports.planearAccesoDeAdministrador = planearAccesoDeAdministrador;
exports.aplicarAccesoDeAdministrador = aplicarAccesoDeAdministrador;
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
/**
 * `PRD-V-PLAT-002` entrega 2 (§16) — **el superadmin da y quita acceso de
 * administrador a varios conjuntos, por persona.**
 *
 * **Lo que había.** El modelo ya aguantaba N conjuntos desde el MVP —la membresía
 * `tenantUsers/{conjunto}_{uid}` es la autoridad, y las reglas, las callables y el
 * selector ya la leen—, pero ninguna vía del producto daba un segundo conjunto:
 * `createTenantAdmin` rechazaba cualquier correo con cuenta y `updateTenantAdmin`
 * MUDABA al admin, borrando la membresía del conjunto anterior. Lo único que lo hacía
 * era un script (`sembrar-membresias-multiconjunto.mjs`).
 *
 * **Dos capas**, como en `resident-access.ts`: `planearAccesoDeAdministrador` decide
 * sin escribir, y es donde viven las reglas E2-R1…R7; `aplicarAccesoDeAdministrador`
 * lee, planea y ejecuta. El modo `simular` devuelve el plan sin tocar nada: es lo que
 * la consola pinta como aviso antes de confirmar, para que **el texto que ve el
 * superadmin salga del mismo sitio que decide**.
 *
 * **El residente que pasa a admin (E2-D3).** La cuenta tiene un solo rol
 * (`users.role`) y la sesión solo carga las membresías de ese rol, así que un
 * residente que recibe acceso de admin deja de ver su portal de residente. Su lado de
 * residente **se guarda** sin campos nuevos:
 *   - en otro conjunto, su membresía de residente no se toca;
 *   - en el mismo conjunto, la membresía es el MISMO documento y cambia de rol
 *     conservando `unitId` y `unitLabel`; lo que prueba que tiene lado de residente ahí
 *     es su ficha en `people` con su `authUid`, que desde `FIX-004` solo escribe el
 *     servidor.
 * Al quitarle su último conjunto de admin, vuelve a ser residente.
 */
const db = () => (0, firestore_1.getFirestore)();
const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");
const ROLES_DE_ADMIN = new Set(["tenant_admin", "admin_tenant"]);
const ROLES_DE_PORTERIA = new Set(["security_guard", "security"]);
exports.MENSAJE_SUPERADMIN = "Esa cuenta es de Vivaru (superadmin): no recibe acceso de administrador de un conjunto.";
exports.MENSAJE_PORTERIA = "Esa cuenta es de portería. Suele ser la del dispositivo de la puerta, a menudo compartido, y no recibe acceso de administrador: crea el administrador con otro correo.";
exports.MENSAJE_SIN_CONJUNTOS = "Un administrador conserva al menos un conjunto. Para quitarle todo el acceso, desactívalo.";
/**
 * Decide qué hacer con las membresías de una persona para que sus conjuntos de admin
 * sean exactamente `pedidosCrudos`. **No escribe nada.** `conjuntos` son los que
 * existen, con su nombre.
 */
function planearAccesoDeAdministrador(estado, pedidosCrudos, conjuntos) {
    const pedidos = [...new Set(pedidosCrudos.map(texto).filter(Boolean))];
    for (const id of pedidos) {
        if (!(id in conjuntos))
            throw new https_1.HttpsError("not-found", `El conjunto ${id} no existe.`);
    }
    // E2-R3: ni el superadmin ni la portería. La portería es cuenta de dispositivo.
    const rol = texto(estado.rol);
    if (rol === "superadmin")
        throw new https_1.HttpsError("failed-precondition", exports.MENSAJE_SUPERADMIN);
    if (ROLES_DE_PORTERIA.has(rol))
        throw new https_1.HttpsError("failed-precondition", exports.MENSAJE_PORTERIA);
    if (!ROLES_DE_ADMIN.has(rol) && rol !== "resident") {
        throw new https_1.HttpsError("failed-precondition", "Esa cuenta no tiene un rol que admita acceso de administrador.");
    }
    const rolEn = (id) => texto(estado.membresias.find((m) => texto(m.tenantId) === id)?.role);
    for (const id of pedidos) {
        if (ROLES_DE_PORTERIA.has(rolEn(id))) {
            throw new https_1.HttpsError("failed-precondition", `En ${conjuntos[id]} esa persona es portería, y una cuenta de portería no recibe acceso de administrador: crea el administrador con otro correo.`);
        }
    }
    const deAdmin = new Set(estado.membresias.filter((m) => ROLES_DE_ADMIN.has(texto(m.role))).map((m) => texto(m.tenantId)).filter(Boolean));
    const deResidente = new Set(estado.membresias.filter((m) => texto(m.role) === "resident").map((m) => texto(m.tenantId)).filter(Boolean));
    const conFicha = new Set(estado.fichasDeResidente.map((f) => texto(f.tenantId)).filter(Boolean));
    const crear = pedidos.filter((id) => !deAdmin.has(id) && !deResidente.has(id));
    const convertir = pedidos.filter((id) => deResidente.has(id));
    const salen = [...deAdmin].filter((id) => !pedidos.includes(id));
    const devolverAResidente = salen.filter((id) => conFicha.has(id));
    const quitar = salen.filter((id) => !conFicha.has(id));
    // Donde seguirá siendo residente si deja de ser admin.
    const ladoDeResidente = [...[...deResidente].filter((id) => !convertir.includes(id)), ...devolverAResidente];
    let rolFinal;
    if (pedidos.length > 0)
        rolFinal = "tenant_admin";
    else if (ladoDeResidente.length > 0)
        rolFinal = "resident";
    else
        throw new https_1.HttpsError("failed-precondition", exports.MENSAJE_SIN_CONJUNTOS); // E2-R6
    const rolActual = ROLES_DE_ADMIN.has(rol) ? "tenant_admin" : "resident";
    const cambiaRol = rolFinal !== rolActual;
    const requiereConfirmacion = cambiaRol || convertir.length > 0;
    const espejo = texto(estado.conjuntoEspejo);
    const candidatos = rolFinal === "tenant_admin" ? pedidos : ladoDeResidente;
    const conjuntoActivo = candidatos.includes(espejo) ? espejo : candidatos[0];
    const plan = {
        crear,
        convertir,
        quitar,
        devolverAResidente,
        conjuntosDeAdmin: pedidos,
        rolFinal,
        cambiaRol,
        requiereConfirmacion,
        conjuntoActivo,
        aviso: null,
    };
    plan.aviso = redactarAviso(plan, estado, conjuntos, rolActual, [...deResidente], ladoDeResidente);
    return plan;
}
/**
 * El texto que ve el superadmin ANTES de confirmar (§16.5). Nombra el conjunto y la
 * unidad, dice qué pierde mientras sea admin, y ofrece la salida del otro correo.
 */
function redactarAviso(plan, estado, conjuntos, rolActual, dondeEsResidente, ladoDeResidente) {
    const dondeVive = (ids) => ids
        .map((id) => {
        const unidad = texto(estado.membresias.find((m) => texto(m.tenantId) === id)?.unitLabel);
        return unidad ? `${conjuntos[id] ?? id}, unidad ${unidad}` : conjuntos[id] ?? id;
    })
        .join(" y de ");
    if (rolActual === "resident" && plan.rolFinal === "tenant_admin") {
        return (`Esta cuenta es residente de ${dondeVive(dondeEsResidente)}. Si le das acceso de administrador, entrará ` +
            "como administrador y no verá su portal de residente mientras lo sea. Su ficha, su unidad y sus cargos no " +
            "cambian. Si le quitas todos sus conjuntos de administrador, vuelve a ser residente como antes. Si necesita " +
            "las dos cosas a la vez, dale el acceso de administrador con otro correo.");
    }
    if (rolActual === "tenant_admin" && plan.rolFinal === "resident") {
        return `Volverá a ser residente de ${dondeVive(ladoDeResidente)} y dejará de entrar como administrador.`;
    }
    if (plan.convertir.length > 0) {
        return (`En ${dondeVive(plan.convertir)} esta persona es residente: su acceso ahí pasa a ser de administrador, ` +
            "y no verá su portal de residente mientras lo sea. Si se lo quitas, vuelve a ser residente.");
    }
    return null;
}
/**
 * Lee la cuenta, planea y aplica. **El orden es el de `revocarAccesoDeResidente`:**
 * primero las membresías y `users` —la autoridad—, después el claim y las sesiones.
 */
async function aplicarAccesoDeAdministrador(pedido) {
    const uid = texto(pedido.uid);
    const firestore = db();
    const authApi = (0, auth_1.getAuth)();
    const [perfilSnap, registro, membresiasSnap, fichasSnap] = await Promise.all([
        firestore.collection("users").doc(uid || "_").get(),
        authApi.getUser(uid || "_").catch((error) => {
            if (codigoDe(error) === "auth/user-not-found")
                return null;
            throw error;
        }),
        firestore.collection("tenantUsers").where("uid", "==", uid).get(),
        firestore.collection("people").where("authUid", "==", uid).get(),
    ]);
    if (!uid || !perfilSnap.exists)
        throw new https_1.HttpsError("not-found", "Esa cuenta no existe.");
    const perfil = perfilSnap.data();
    const claims = (registro?.customClaims ?? {});
    const crudas = new Map();
    for (const d of membresiasSnap.docs) {
        const data = d.data();
        if (texto(data.tenantId))
            crudas.set(texto(data.tenantId), data);
    }
    const membresias = [...crudas.entries()].map(([tenantId, m]) => ({
        tenantId,
        role: texto(m.role),
        unitId: texto(m.unitId) || undefined,
        unitLabel: texto(m.unitLabel) || undefined,
    }));
    const fichasDeResidente = fichasSnap.docs
        .map((d) => d.data())
        .map((f) => ({ tenantId: texto(f.tenantId), unitId: texto(f.unitId) }))
        .filter((f) => f.tenantId);
    const pedidos = [...new Set(pedido.tenantIds.map(texto).filter(Boolean))];
    const ids = [...new Set([...pedidos, ...crudas.keys()])];
    const conjuntosSnap = ids.length ? await firestore.getAll(...ids.map((id) => firestore.collection("tenants").doc(id))) : [];
    const conjuntos = {};
    for (const snap of conjuntosSnap) {
        if (snap.exists)
            conjuntos[snap.id] = texto(snap.data().name) || snap.id;
    }
    const plan = planearAccesoDeAdministrador({
        uid,
        rol: texto(perfil.role) || texto(claims.role),
        membresias,
        fichasDeResidente,
        conjuntoEspejo: texto(perfil.tenantId) || null,
        lastActiveTenantId: texto(perfil.lastActiveTenantId) || null,
    }, pedidos, conjuntos);
    if (pedido.simular)
        return { plan, aplicado: false };
    if (plan.requiereConfirmacion && pedido.confirmarCambioDeRol !== true) {
        throw new https_1.HttpsError("failed-precondition", plan.aviso ?? "Este cambio necesita confirmación.");
    }
    const now = firestore_1.Timestamp.now();
    const compartida = plan.conjuntosDeAdmin.length > 1;
    const ref = (tenantId) => firestore.collection("tenantUsers").doc(`${tenantId}_${uid}`);
    const batch = firestore.batch();
    let escrituras = 0;
    for (const tenantId of plan.crear) {
        batch.set(ref(tenantId), {
            uid,
            tenantId,
            role: "tenant_admin",
            fullName: texto(perfil.fullName),
            email: texto(perfil.email),
            status: "active",
            compartida,
            createdAt: now,
            updatedAt: now,
        });
        escrituras += 1;
    }
    for (const tenantId of plan.convertir) {
        // `merge`: conserva `unitId` y `unitLabel`, que es lo que la devolverá a residente.
        batch.set(ref(tenantId), { role: "tenant_admin", status: "active", compartida, updatedAt: now }, { merge: true });
        escrituras += 1;
    }
    for (const tenantId of plan.quitar) {
        batch.delete(ref(tenantId));
        escrituras += 1;
    }
    for (const tenantId of plan.devolverAResidente) {
        batch.set(ref(tenantId), { role: "resident", compartida: firestore_1.FieldValue.delete(), updatedAt: now }, { merge: true });
        escrituras += 1;
    }
    // La marca de compartida de las que se quedan. Es de SOLO presentación —la lista de
    // `/admin/users` no puede leer las membresías de otros conjuntos—: lo que decide
    // (E2-R8) consulta las membresías reales.
    for (const tenantId of plan.conjuntosDeAdmin) {
        if (plan.crear.includes(tenantId) || plan.convertir.includes(tenantId))
            continue;
        if (crudas.get(tenantId)?.compartida !== compartida) {
            batch.set(ref(tenantId), { compartida, updatedAt: now }, { merge: true });
            escrituras += 1;
        }
    }
    const deseado = { role: plan.rolFinal, tenantId: plan.conjuntoActivo };
    if (plan.rolFinal === "resident") {
        const membresia = membresias.find((m) => m.tenantId === plan.conjuntoActivo);
        const ficha = fichasDeResidente.find((f) => f.tenantId === plan.conjuntoActivo);
        const unitId = membresia?.unitId || ficha?.unitId;
        if (unitId)
            deseado.unitId = unitId;
        if (membresia?.unitLabel)
            deseado.unitLabel = membresia.unitLabel;
    }
    const ultimoUsado = texto(perfil.lastActiveTenantId);
    if (ultimoUsado && !plan.conjuntosDeAdmin.includes(ultimoUsado))
        deseado.lastActiveTenantId = plan.conjuntoActivo;
    const cambiosDeUsuario = Object.entries(deseado).filter(([campo, valor]) => perfil[campo] !== valor);
    if (cambiosDeUsuario.length > 0) {
        batch.set(firestore.collection("users").doc(uid), { ...Object.fromEntries(cambiosDeUsuario), updatedAt: now }, { merge: true });
        escrituras += 1;
    }
    if (escrituras > 0)
        await batch.commit();
    // E2-R7: el claim sigue al conjunto activo —Storage concede por él— y las sesiones se
    // cierran para que el nuevo se aplique. Solo si cambia.
    const claimCambia = texto(claims.role) !== plan.rolFinal || texto(claims.tenantId) !== plan.conjuntoActivo;
    if (claimCambia) {
        await authApi.setCustomUserClaims(uid, { role: plan.rolFinal, tenantId: plan.conjuntoActivo });
        await authApi.revokeRefreshTokens(uid);
    }
    return { plan, aplicado: escrituras > 0 || claimCambia };
}
function codigoDe(error) {
    return typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
}
