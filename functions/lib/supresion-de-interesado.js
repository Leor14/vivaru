"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizarEmail = normalizarEmail;
exports.inventarioDeSupresion = inventarioDeSupresion;
exports.veredicto = veredicto;
exports.resumenParaConfirmar = resumenParaConfirmar;
/**
 * `PRD-V-PLAT-007` — el barrido que decide si a una persona se la puede suprimir como INTERESADO.
 *
 * **Por qué existe esta pieza y no un `delete` directo.** El barrido de producción del 22 de
 * septiembre de 2026 —hecho sobre los VALORES y no sobre los nombres de campo— encontró dos casos
 * distintos con el mismo aspecto:
 *
 * - **Solo interesado:** su rastro está en UN documento, su ficha de `leads`.
 * - **Interesado que además usa el producto:** su nombre y su correo viven en `people`, `users`,
 *   `tenantUsers`, `accountInvites`, `auditLogs`, `documentFolders`, `documents`, `visitorPasses`…
 *
 * **Y esos rastros NO son del interesado: son del usuario.** Los pases que autorizó, los documentos
 * que subió y la auditoría del conjunto son información de la comunidad. Una supresión comercial no
 * puede tocarlos, así que cuando la persona aparece como usuario **la acción se niega y lo explica**
 * (`CA2`), en vez de borrar media cosa.
 *
 * Aquí solo se MIDE. Quien borra es la callable, y solo si esto dice que se puede.
 */
/** Las colecciones donde vivir significa «es usuario del producto», con el campo que lo dice. */
const COLECCIONES_DE_USUARIO = [
    { coleccion: "users", campo: "email" },
    { coleccion: "tenantUsers", campo: "email" },
    { coleccion: "people", campo: "email" },
    { coleccion: "accountInvites", campo: "email" },
];
function normalizarEmail(valor) {
    return typeof valor === "string" ? valor.trim().toLowerCase() : "";
}
/**
 * Reúne todo lo que se borraría y todo lo que lo impide. **Una sola lectura de la verdad**: la
 * callable decide con esto y no vuelve a consultar, para que lo que se enseña al confirmar y lo que
 * se borra sean lo mismo.
 */
async function inventarioDeSupresion(db, emailCrudo) {
    const email = normalizarEmail(emailCrudo);
    if (!email)
        throw new Error("email_vacio");
    const inventario = { email, leadIds: [], leadIdsEnAlbert: [], entregasDeCorreo: [], comoUsuario: [] };
    const leads = await db.collection("leads").where("email", "==", email).get();
    for (const doc of leads.docs) {
        inventario.leadIds.push(doc.id);
        // `albertEnvio.dealId` solo existe si el lead llegó a Albert. Un `dryRun` NO cuenta: no hay nada
        // que borrar allí, y pedirlo devolvería `not_found`, que es ruido en el registro.
        const envio = doc.get("albertEnvio");
        if (envio?.estado === "enviado")
            inventario.leadIdsEnAlbert.push(doc.id);
    }
    const entregas = await db.collection("emailDeliveries").where("recipientEmail", "==", email).get();
    inventario.entregasDeCorreo = entregas.docs.map((d) => d.id);
    for (const { coleccion, campo } of COLECCIONES_DE_USUARIO) {
        const snap = await db.collection(coleccion).where(campo, "==", email).get();
        if (!snap.empty)
            inventario.comoUsuario.push({ coleccion, documentos: snap.size });
    }
    return inventario;
}
/**
 * La puerta. Dos negativas, y las dos dicen por qué:
 *
 * - **Es usuario del producto** (`CA2`): sus datos sostienen la operación de un conjunto.
 * - **No hay nada que borrar**: sin ficha no hay supresión que hacer aquí, y decirlo evita que
 *   alguien crea que borró algo. Si además hubiera algo en Albert, se vería en el inventario.
 */
function veredicto(inventario) {
    if (inventario.comoUsuario.length > 0) {
        const donde = inventario.comoUsuario.map((c) => `${c.coleccion} (${c.documentos})`).join(", ");
        return {
            sePuede: false,
            motivo: "es_usuario_del_producto",
            detalle: `Esta persona usa el producto y sus datos sostienen la operación de un conjunto: ${donde}. Borrarla es otra decisión, con contrato de por medio.`,
            inventario,
        };
    }
    if (inventario.leadIds.length === 0) {
        return { sePuede: false, motivo: "sin_rastro", detalle: "No hay ninguna ficha de interesado con ese correo.", inventario };
    }
    return { sePuede: true, inventario };
}
/** Lo que se le enseña a quien va a confirmar. Sin esto, «confirmar» es firmar a ciegas. */
function resumenParaConfirmar(inventario) {
    return [
        `${inventario.leadIds.length} ficha(s) de interesado, con su diagnóstico y su atribución`,
        inventario.leadIdsEnAlbert.length > 0
            ? `${inventario.leadIdsEnAlbert.length} contacto(s) y oportunidad(es) en el CRM`
            : "nada en el CRM (nunca llegó a enviarse)",
        inventario.entregasDeCorreo.length > 0
            ? `${inventario.entregasDeCorreo.length} registro(s) de correos enviados`
            : "ningún registro de correo",
    ];
}
