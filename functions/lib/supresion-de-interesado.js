"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERASE_LEAD_URL = void 0;
exports.normalizarEmail = normalizarEmail;
exports.inventarioDeSupresion = inventarioDeSupresion;
exports.veredicto = veredicto;
exports.resumenParaConfirmar = resumenParaConfirmar;
exports.puedeEjecutar = puedeEjecutar;
exports.ejecutarSupresion = ejecutarSupresion;
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
/* ────────────────────────────────────────────────────────────────────────────
 * La ejecución. Todo lo de arriba solo mide; de aquí abajo se borra.
 * ──────────────────────────────────────────────────────────────────────────── */
exports.ERASE_LEAD_URL = "https://vivarueraselead-winvdvwn6q-uc.a.run.app";
/**
 * **Solo producción borra.** El endpoint de Albert responde 403 a la cuenta de staging —borrar es
 * destructivo y su tenant tiene datos reales—, así que allí la acción se queda en vista previa.
 */
function puedeEjecutar(proyecto = process.env.GCLOUD_PROJECT ?? "") {
    return proyecto === "hogaru-1";
}
/**
 * Orden deliberado: **Albert primero, Vivaru después** (`CA5`).
 *
 * Si Albert falla, aquí no se borra nada y se puede reintentar. Al revés —borrar la ficha y que
 * falle el CRM— deja el dato vivo allí y **sin hilo para encontrarlo**, que es el peor estado
 * posible: nadie sabría ya a quién pertenece ese deal.
 *
 * Y reintentar es seguro porque las dos mitades son idempotentes: Albert responde `not_found` y
 * borrar un documento que ya no está no falla.
 */
async function ejecutarSupresion(inventario, quien, dep) {
    const albert = inventario.leadIdsEnAlbert.length > 0 ? await dep.pedirABorrarEnAlbert(inventario.leadIdsEnAlbert) : [];
    // Regla de Albert (22 sep): un deal ganado no se borra sin decirlo explícitamente. Si aparece,
    // esta operación NO sigue: se deja constancia del intento y se devuelve para que lo decida quien
    // pueda decidirlo. `not_found` no bloquea: significa que allí ya no había nada.
    const bloqueadaPorGanado = albert.filter((r) => r.reason === "won_not_deleted");
    if (bloqueadaPorGanado.length > 0) {
        await dep.registrar({
            dominio: inventario.email.split("@")[1] ?? "",
            resultado: "bloqueada_por_ganado",
            leads: bloqueadaPorGanado.map((r) => r.leadId),
            dealsGanados: bloqueadaPorGanado.flatMap((r) => r.dealIds ?? []),
            ejecutadaPor: quien,
        });
        return { albert, leadsBorrados: [], correosBorrados: [], bloqueadaPorGanado };
    }
    const leadsBorrados = [];
    for (const leadId of inventario.leadIds) {
        await dep.borrarLead(leadId);
        leadsBorrados.push(leadId);
    }
    const correosBorrados = [];
    for (const id of inventario.entregasDeCorreo) {
        await dep.borrarEntregaDeCorreo(id);
        correosBorrados.push(id);
    }
    await dep.registrar({
        // Ni el correo ni el nombre: el dominio basta para entender el caso sin reidentificar.
        dominio: inventario.email.split("@")[1] ?? "",
        leadsBorrados,
        correosBorrados,
        resultado: "suprimida",
        albert: albert.map((r) => ({ leadId: r.leadId, erased: r.erased, reason: r.reason, dealIds: r.dealIds ?? [] })),
        ejecutadaPor: quien,
    });
    return { albert, leadsBorrados, correosBorrados, bloqueadaPorGanado: [] };
}
