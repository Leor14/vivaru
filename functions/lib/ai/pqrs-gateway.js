"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.asistirTicketPqrs = void 0;
exports.runAsistirTicketPqrs = runAsistirTicketPqrs;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const http_config_1 = require("../http-config");
const gateway_1 = require("./gateway");
const pqrs_ticket_1 = require("./pqrs-ticket");
/**
 * Puerta de la asistencia de PQRS (Fase 3 de `PRD-VAI-FEAT-002`).
 *
 * **Por qué existe en vez de llamar a `aiInvoke` desde la pantalla.** El esquema
 * de entrada de `pqrs-asistir` lleva escrito desde la Fase 2 que la puebla el
 * servidor. Si el drawer llamara a la puerta genérica, el navegador tendría que
 * afirmar `mensaje`, `historial` y `variante` — y `variante` es lo que decide la
 * puerta dura de `buzon_simple`: nulls siempre. Un cliente que mandara `con_sla`
 * en un conjunto de buzón simple recibiría clasificación donde el contrato de
 * producto dice que no debe haberla. **La puerta dura la estaría decidiendo el
 * navegador**, que es exactamente lo que la PRD §7 evita resolviendo todo en
 * servidor.
 *
 * Aquí el cliente manda `ticketId` y nada más. Todo lo demás —conjunto, texto,
 * historial, variante— lo lee el servidor.
 *
 * No duplica ninguna comprobación: rol, banderas, cuota, validación, proveedor y
 * telemetría siguen viviendo en `runGateway`. Esto es la parte que aquella no
 * puede saber — cómo se llega del `ticketId` a la entrada de la operación.
 */
const OPERACION = "pqrs-asistir";
/**
 * Lee el ticket y arma la entrada. Se le pasa a la puerta como armador, así que
 * corre **después** de que el rol, las banderas y el conjunto ya dijeron que sí.
 */
async function armarEntrada(tenantId, ticketId, recorteRef) {
    const db = (0, firestore_1.getFirestore)();
    const [ticketSnap, settingsSnap] = await Promise.all([
        db.collection("tickets").doc(ticketId).get(),
        db.collection("tenantSettings").doc(tenantId).get(),
    ]);
    // Un ticket de otro conjunto se responde igual que uno que no existe — el
    // porqué está en `ticketPerteneceAlConjunto`, con su prueba negativa al lado.
    const ticket = ticketSnap.exists ? ticketSnap.data() : null;
    if (!(0, pqrs_ticket_1.ticketPerteneceAlConjunto)(ticket, tenantId)) {
        return {
            ok: false,
            code: "permission-denied",
            message: "No encontramos ese ticket.",
            reason: "ticket_fuera_del_conjunto",
        };
    }
    const variante = (0, pqrs_ticket_1.variantePqrsDe)(settingsSnap.exists ? settingsSnap.data() : null);
    const construida = (0, pqrs_ticket_1.construirEntradaPqrs)(ticket, variante);
    if (!construida.ok) {
        return {
            ok: false,
            code: "failed-precondition",
            message: "Este ticket no tiene texto que analizar.",
            reason: construida.reason,
        };
    }
    recorteRef.valor = construida.recorte;
    return { ok: true, input: construida.entrada };
}
async function runAsistirTicketPqrs(request) {
    const ticketId = request.data?.ticketId;
    if (typeof ticketId !== "string" || !ticketId.trim()) {
        return {
            ok: false,
            code: "invalid-argument",
            message: "No sabemos de qué ticket hablas.",
            reason: "ticket_id_ausente",
        };
    }
    // El recorte lo produce el armador y lo necesita la respuesta; la puerta no
    // tiene por qué conocerlo, así que viaja por fuera en vez de ensuciar su
    // contrato con un campo que solo usa una operación.
    const recorteRef = { valor: null };
    // El conjunto ACTIVO sí se reenvía, y la distinción importa: `input` es lo
    // que la IA va a leer —y por eso lo arma el servidor—, mientras que
    // `tenantId` es ENRUTADO: dice sobre qué conjunto se pide trabajar. Desde
    // `PLAT-002` el claim ya no lo dice, así que descartarlo dejaba la asistencia
    // resolviendo el ticket contra el conjunto equivocado — y devolviendo «no
    // encontramos ese ticket» sobre uno que sí se administra.
    //
    // No concede nada: `runGateway` lee la membresía DE ese conjunto.
    const tenantSolicitado = request.data?.tenantId;
    const gatewayRequest = {
        app: request.app,
        auth: request.auth,
        // Sin `input`: lo arma el servidor. Lo que mandara el cliente se descarta.
        data: {
            operationKey: OPERACION,
            ...(typeof tenantSolicitado === "string" && tenantSolicitado ? { tenantId: tenantSolicitado } : {}),
        },
    };
    const outcome = await (0, gateway_1.runGateway)(gatewayRequest, {
        resolveInput: ({ tenantId }) => armarEntrada(tenantId, ticketId.trim(), recorteRef),
    });
    if (!outcome.ok)
        return outcome;
    logger.info("pqrs-asistir: asistencia entregada", {
        ticketId: ticketId.trim(),
        recorte: recorteRef.valor,
    });
    return {
        ...outcome,
        recorte: recorteRef.valor ?? { mensaje: false, historialOmitido: 0 },
    };
}
exports.asistirTicketPqrs = (0, https_1.onCall)({
    cors: http_config_1.callableCorsOrigins,
    // Mismo criterio que `aiInvoke` y que el feedback: lo decide la bandera de
    // modo monitor, para que pasar de observar a exigir no requiera desplegar.
    enforceAppCheck: false,
}, async (request) => {
    const outcome = await runAsistirTicketPqrs({
        app: request.app,
        auth: request.auth ? { uid: request.auth.uid, token: request.auth.token } : undefined,
        data: request.data,
    });
    if (!outcome.ok)
        throw new https_1.HttpsError(outcome.code, outcome.message);
    return {
        operationKey: outcome.operationKey,
        version: outcome.version,
        output: outcome.output,
        cuotaRestante: outcome.cuotaRestante,
        recorte: outcome.recorte,
        // Las frases que la revisión de contrato marcó dentro del borrador, con
        // su posición. Viajan por el SOBRE y no por `output` a propósito: `output`
        // es el esquema de la operación, y ese esquema se le manda al modelo
        // dentro del prompt (`z.toJSONSchema`). Meterlo ahí cambiaría lo que el
        // modelo recibe —obligando a subir la operación a v3 y a volver a medir
        // los 152 casos— para transportar algo que calcula el servidor.
        frasesMarcadas: outcome.frasesMarcadas,
    };
});
