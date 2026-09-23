"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEAD_DE_PRUEBA = exports.ERASE_LEAD_URL = void 0;
exports.normalizarEmail = normalizarEmail;
exports.inventarioDeSupresion = inventarioDeSupresion;
exports.veredicto = veredicto;
exports.resumenParaConfirmar = resumenParaConfirmar;
exports.puedeEjecutar = puedeEjecutar;
exports.ejecutarSupresion = ejecutarSupresion;
exports.pedirABorrarEnAlbertReal = pedirABorrarEnAlbertReal;
exports.pruebaDeConexion = pruebaDeConexion;
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
/** La llamada real a Albert. `incluirGanados` solo se manda cuando alguien lo decide a mano. */
async function pedirABorrarEnAlbertReal(leadIds, incluirGanados, token) {
    const t = await token(exports.ERASE_LEAD_URL);
    const r = await fetch(exports.ERASE_LEAD_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify(incluirGanados ? { leadIds, includeWon: true } : { leadIds }),
    });
    if (!r.ok)
        throw new Error(`erase_lead_${r.status}:${(await r.text()).slice(0, 200)}`);
    const cuerpo = (await r.json());
    if (cuerpo?.ok !== true || !Array.isArray(cuerpo.results))
        throw new Error("erase_lead_respuesta_invalida");
    return cuerpo.results;
}
/**
 * El identificador de la prueba de conexión. **No puede existir**: nuestros `leadId` son UUID, y
 * este no lo es. Albert responde `not_found`, que es exactamente lo que se quiere comprobar — que
 * el circuito de borrado responde— sin tocar el dato de nadie.
 */
exports.LEAD_DE_PRUEBA = "vivaru-prueba-de-conexion";
/**
 * Comprueba de punta a punta el camino de supresión sin borrar nada. Existe porque el endpoint de
 * borrado **solo admite a la cuenta de producción**, así que la primera llamada real no se puede
 * ensayar en staging; sin esto, el estreno del borrado sería la supresión de una persona de verdad.
 * Queda además como comprobación permanente: el día que algo se rompa, esto lo dice sin esperar a
 * que alguien pida que lo borren.
 */
async function pruebaDeConexion(pedir) {
    try {
        const [resultado] = await pedir([exports.LEAD_DE_PRUEBA]);
        if (resultado?.reason === "not_found" && resultado.erased === false) {
            return { ok: true, reason: "not_found", detalle: "El CRM respondió: no existe ese interesado. El camino de borrado funciona y no se tocó ningún dato." };
        }
        // Cualquier otra cosa es una sorpresa y se enseña tal cual: un `deleted` aquí significaría que
        // el identificador de prueba SÍ existía, que es justo lo que no puede pasar.
        return { ok: false, reason: resultado?.reason ?? "sin_respuesta", detalle: `Respuesta inesperada del CRM: ${JSON.stringify(resultado ?? null)}` };
    }
    catch (error) {
        return { ok: false, reason: "error", detalle: error instanceof Error ? error.message.slice(0, 300) : String(error) };
    }
}
