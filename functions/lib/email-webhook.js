"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOLERANCIA_RELOJ_S = exports.resendWebhookSecret = void 0;
exports.verificarFirmaSvix = verificarFirmaSvix;
exports.estadoDesdeEvento = estadoDesdeEvento;
exports.contactoRoto = contactoRoto;
exports.aplicarEventoDeCorreo = aplicarEventoDeCorreo;
const node_crypto_1 = require("node:crypto");
const firestore_1 = require("firebase-admin/firestore");
const params_1 = require("firebase-functions/params");
/**
 * `PRD-V-FLOW-003` §11.1 — la entrada del webhook de entregabilidad.
 *
 * **Es la PRIMERA función HTTP del producto.** Las 81 desplegadas hasta hoy son callables y
 * procesos programados; nada de la maquinaria de `callableCorsOrigins` aplica aquí, porque esto no
 * lo llama un navegador nuestro sino un servidor ajeno.
 *
 * **La firma se verifica a mano, y fue una decisión.** Resend firma con el esquema de Svix, y
 * `svix` no está en este repositorio: `email.ts` habla con Resend por `fetch` crudo, sin SDK.
 * Añadir la dependencia traería su propio árbol para resolver veinte líneas de HMAC que se pueden
 * probar con vectores fijos y sin red. La ficha nombraba «verificación de firma» como si fuera un
 * paso conocido; no lo era.
 *
 * **Sin firma válida no se toca nada.** Es el riesgo nombrado en §12: un webhook falsificado que
 * marque todo como entregado no rompe nada visible — deja la métrica mintiendo, que es peor,
 * porque «100% de entrega conocida» pasaría a ser «100% de lo que alguien quiso declarar».
 */
/**
 * El secreto de firma del webhook. **Lo pone el usuario, no el agente**
 * (`firebase functions:secrets:set RESEND_WEBHOOK_SECRET`), y tiene que existir ANTES de
 * desplegar la función que lo referencia o el despliegue falla.
 */
exports.resendWebhookSecret = (0, params_1.defineSecret)("RESEND_WEBHOOK_SECRET");
/** Ventana de tolerancia del reloj, en segundos. La de Svix. */
exports.TOLERANCIA_RELOJ_S = 5 * 60;
/**
 * Verifica la firma de Svix sobre el cuerpo **crudo**.
 *
 * El contenido firmado es `id.timestamp.cuerpo`, y por eso el cuerpo tiene que llegar tal cual
 * viajó: volver a serializar el JSON cambiaría un espacio y la firma dejaría de casar, con un
 * síntoma que parece un problema de claves.
 *
 * `svix-signature` trae una LISTA separada por espacios (`v1,firma v1,otra`) porque el proveedor
 * rota claves: durante la rotación manda las dos. Aceptar si **alguna** casa es lo correcto; exigir
 * la primera rompería el día de la rotación, que es exactamente el día en que nadie está mirando.
 */
function verificarFirmaSvix(secreto, cab, cuerpoCrudo, ahoraS) {
    if (!cab.id || !cab.timestamp || !cab.signature)
        return { ok: false, motivo: "faltan cabeceras" };
    if (!secreto)
        return { ok: false, motivo: "sin secreto configurado" };
    const ts = Number(cab.timestamp);
    if (!Number.isFinite(ts))
        return { ok: false, motivo: "marca de tiempo no numérica" };
    // Fuera de ventana en CUALQUIERA de los dos sentidos: una firma vieja reproducida y una con el
    // reloj adelantado son el mismo ataque desde el punto de vista de quien la reproduce.
    if (Math.abs(ahoraS - ts) > exports.TOLERANCIA_RELOJ_S)
        return { ok: false, motivo: "fuera de la ventana de tiempo" };
    const clave = Buffer.from(secreto.replace(/^whsec_/, ""), "base64");
    const esperada = (0, node_crypto_1.createHmac)("sha256", clave).update(`${cab.id}.${cab.timestamp}.${cuerpoCrudo}`).digest();
    for (const parte of cab.signature.split(" ")) {
        const [version, firma] = parte.split(",");
        if (version !== "v1" || !firma)
            continue;
        const recibida = Buffer.from(firma, "base64");
        // Longitudes distintas hacen lanzar a `timingSafeEqual`, así que se comprueba antes — y se
        // compara en tiempo constante, que es el punto de usarla.
        if (recibida.length === esperada.length && (0, node_crypto_1.timingSafeEqual)(recibida, esperada))
            return { ok: true };
    }
    return { ok: false, motivo: "ninguna firma casa" };
}
/** Lo que el proveedor llama a cada cosa, traducido a los estados de `emailDeliveries`. */
const ESTADOS = {
    "email.sent": "enviado",
    "email.delivered": "entregado",
    "email.delivery_delayed": "demorado",
    "email.bounced": "rebotado",
    "email.complained": "marcado_spam",
};
/**
 * El estado que corresponde a un evento, o `null` si el evento no nos interesa.
 *
 * **`email.opened` y `email.clicked` devuelven `null` a propósito.** Saber si alguien abrió un
 * correo exige un píxel de seguimiento, y esta colección existe para saber si el aviso LLEGÓ, no
 * para vigilar a quien lo recibe. Es la misma línea que el resto del producto traza con el dato
 * personal del residente.
 */
function estadoDesdeEvento(tipo) {
    return ESTADOS[tipo] ?? null;
}
/** Los dos estados en que el contacto está roto y hay que corregirlo (R7). */
function contactoRoto(estado) {
    if (estado === "rebotado")
        return "bounced";
    if (estado === "marcado_spam")
        return "complained";
    return null;
}
/**
 * Aplica un evento ya verificado. Devuelve qué se hizo, para que el llamador lo registre.
 *
 * **No crea la fila si no existe.** Un `email_id` desconocido puede ser un correo enviado con la
 * bandera apagada, o de otro ambiente que comparte proveedor: inventarle una fila sin `tenantId`
 * metería basura en una colección que alguien lee. Se ignora y se dice.
 */
async function aplicarEventoDeCorreo(db, evento) {
    const tipo = typeof evento.type === "string" ? evento.type : "";
    const estado = estadoDesdeEvento(tipo);
    if (!estado)
        return "evento-ignorado";
    const id = typeof evento.data?.email_id === "string" ? evento.data.email_id.trim() : "";
    if (!id)
        return "sin-id";
    const ref = db.collection("emailDeliveries").doc(id);
    const snap = await ref.get();
    if (!snap.exists)
        return "desconocido";
    await ref.update({ status: estado, updatedAt: firestore_1.Timestamp.now() });
    // El contacto roto se marca en `people`, que es donde el administrador lo corrige. La fila de
    // entrega dice QUÉ pasó; `people` dice a quién hay que perseguir.
    const roto = contactoRoto(estado);
    const recipientUserId = snap.data()?.recipientUserId;
    if (roto && typeof recipientUserId === "string" && recipientUserId) {
        const personas = await db
            .collection("people")
            .where("tenantId", "==", snap.data()?.tenantId)
            .where("userId", "==", recipientUserId)
            .limit(5)
            .get();
        const batch = db.batch();
        personas.forEach((d) => batch.update(d.ref, { emailStatus: roto }));
        if (!personas.empty)
            await batch.commit();
    }
    return "aplicado";
}
