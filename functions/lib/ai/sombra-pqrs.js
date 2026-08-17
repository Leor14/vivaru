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
exports.ACTOR_SOMBRA = exports.AI_ASSISTANCE_COLLECTION = void 0;
exports.decisionDelTicket = decisionDelTicket;
exports.esEstadoTerminal = esEstadoTerminal;
exports.planificarSombra = planificarSombra;
exports.hayQueRegistrarDecision = hayQueRegistrarDecision;
exports.clasificarTicketEnSombra = clasificarTicketEnSombra;
exports.registrarDecisionEnSombra = registrarDecisionEnSombra;
const firestore_1 = require("firebase-admin/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const feature_flags_1 = require("../feature-flags");
const catalog_1 = require("./catalog");
const ejecucion_1 = require("./ejecucion");
const pqrs_ticket_1 = require("./pqrs-ticket");
/**
 * Modo sombra de PQRS — Fase 4 de `PRD-VAI-FEAT-002`.
 *
 * Clasifica **en silencio** cada ticket nuevo y guarda la sugerencia completa
 * junto a la decisión que acabe tomando el administrador. Nadie ve nada: ni el
 * residente, ni el administrador, ni el comité.
 *
 * ## Para qué, si no se muestra
 *
 * Las dos puertas de G7 —recall de `high` ≥95% y exactitud de `category` ≥90%—
 * se cobran «contra la decisión real del administrador», y esa referencia **hoy
 * no existe**. El gold set dice si el modelo coincide con un anotador; lo que
 * hace falta saber es si coincide con quien atiende el ticket. Las dos
 * decisiones rectoras del 15 de agosto movieron los dos criterios a esta puerta
 * justamente porque la referencia se fabrica aquí, y desde el primer ticket
 * real: sin sombra, G7 llegaría sin nada contra qué medirse.
 *
 * ## Lo que esto NO hace, y conviene que siga sin hacer
 *
 * **No escribe una sola letra en el ticket.** Ni `category`, ni `type`, ni
 * `priority`, ni `classifiedAt`. El ticket se lee y no se toca. Si algún día
 * esto escribiera en el ticket, dejaría de ser una sombra y pasaría a ser una
 * clasificación automática sin que nadie lo hubiera decidido — y toda la PRD
 * está construida sobre que el administrador decide.
 *
 * **Y por eso la sugerencia no vive dentro del ticket** (PRD §7: «objeto
 * `aiAssistance` separado del `Ticket`»). El motivo es concreto: `firestore.rules`
 * deja al RESIDENTE leer su propio ticket. Un campo ahí dentro sería visible
 * para quien lo escribió, y la sombra dejaría de serlo el día que se encienda.
 *
 * ## Gasto
 *
 * USD 0,0009 por ticket con la v2 de `pqrs-asistir`. **Es la primera vez en el
 * programa que el sistema gasta sin que nadie pulse nada**: hasta ahora toda
 * llamada salía de un administrador abriendo el drawer o de una corrida
 * lanzada a mano. Por eso hay bandera propia, apagada de nacimiento, y por eso
 * la reserva de más abajo protege contra pagar dos veces por el mismo ticket.
 */
/** Un documento por ticket, con el `ticketId` de identificador. */
exports.AI_ASSISTANCE_COLLECTION = "aiAssistance";
/**
 * El `uid` con el que la sombra aparece en la cuota y en `aiUsage`.
 *
 * No es un usuario y no existe en `tenantUsers`: es la etiqueta que permite
 * separar el gasto de la sombra del de los administradores al leer la factura.
 * Los dos guiones bajos lo hacen imposible de confundir con un uid de Firebase.
 */
exports.ACTOR_SOMBRA = "__sombra__";
const OPERACION = "pqrs-asistir";
/** Estados en los que el ticket ya se considera cerrado para medir. */
const ESTADOS_TERMINALES = new Set(["resolved", "closed"]);
function cadena(valor) {
    return typeof valor === "string" && valor.trim() ? valor.trim() : undefined;
}
/** Función pura: lo que el administrador dejó escrito, sin inventar campos. */
function decisionDelTicket(ticket) {
    const decision = {};
    const category = cadena(ticket.category);
    const type = cadena(ticket.type);
    const priority = cadena(ticket.priority);
    const classifiedAt = cadena(ticket.classifiedAt);
    const classifiedBy = cadena(ticket.classifiedBy);
    const status = cadena(ticket.status);
    if (category)
        decision.category = category;
    if (type)
        decision.type = type;
    if (priority)
        decision.priority = priority;
    if (classifiedAt)
        decision.classifiedAt = classifiedAt;
    if (classifiedBy)
        decision.classifiedBy = classifiedBy;
    if (status)
        decision.status = status;
    return decision;
}
function esEstadoTerminal(status) {
    return typeof status === "string" && ESTADOS_TERMINALES.has(status);
}
function planificarSombra(ticket, tenantId, contexto) {
    // **Lo sembrado no entra en el conjunto de evaluación de G7.** Va primero
    // porque es la razón más fuerte: un ticket de ejemplo no es un caso real
    // aunque su conjunto tenga SLA y su texto sea perfecto.
    //
    // Este repo ya pagó dos veces por no descontarlo —la volumetría dio 20
    // tickets que eran 0, y 26 comunicaciones que eran 2—, y aquí saldría más
    // caro: es el conjunto contra el que se cobran las DOS puertas de escala. Un
    // gold set envenenado se detecta; una referencia de despliegue envenenada
    // parece que funciona.
    //
    // Y de paso no se paga por ello: resembrar el piloto con la sombra encendida
    // costaba USD 0,014 en clasificar tickets inventados.
    // Va antes que todo: da igual lo bueno que sea el caso si lo va a contestar el
    // simulador. Y se anota, para que «la sombra no acumula nada» tenga respuesta
    // en la propia colección en vez de acabar en una tarde de depuración.
    if (!contexto.proveedorReal)
        return { accion: "omitir", motivo: "proveedor_simulado" };
    if (ticket.isExample === true || contexto.conjuntoDeEjemplo) {
        return { accion: "omitir", motivo: "sembrado" };
    }
    // **En buzón simple no se corre, y no es por ahorrar.** Ahí el contrato de
    // producto obliga a `suggestedCategory` y `suggestedType` en null, y la
    // pantalla no pinta el editor de clasificación —el esquema de `aiFeedback` lo
    // tiene escrito como invariante—. Es decir: no existe la decisión del
    // administrador. Y sin decisión no hay par, que es lo único que la sombra
    // viene a fabricar.
    if (contexto.variante === "buzon_simple")
        return { accion: "omitir", motivo: "buzon_simple" };
    // Un ticket de otro conjunto se trata como uno sin texto: no se clasifica y
    // no se paga. Aquí el `tenantId` sale del propio documento, así que esto es
    // una red contra un documento incoherente, no contra un cliente mentiroso.
    if (!(0, pqrs_ticket_1.ticketPerteneceAlConjunto)(ticket, tenantId))
        return { accion: "omitir", motivo: "ticket_sin_texto" };
    const construida = (0, pqrs_ticket_1.construirEntradaPqrs)(ticket, contexto.variante);
    if (!construida.ok)
        return { accion: "omitir", motivo: "ticket_sin_texto" };
    return { accion: "clasificar", entrada: construida.entrada, recorte: construida.recorte };
}
/**
 * ¿Este cambio del ticket toca algo que la sombra deba anotar?
 *
 * Función pura y con guardia deliberadamente estrecha: `onDocumentUpdated`
 * dispara con CUALQUIER escritura sobre el ticket —responder, cambiar estado,
 * adjuntar—, y sin este filtro la sombra reescribiría su fila en todas ellas.
 * No costaría dinero de modelo, pero sí escrituras, y sobre todo dejaría un
 * `decisionActualizadaEn` que se mueve cuando la decisión no se movió.
 */
function hayQueRegistrarDecision(antes, despues) {
    const ejes = ["category", "type", "priority", "classifiedAt"];
    if (ejes.some((eje) => antes[eje] !== despues[eje]))
        return true;
    // El cruce a terminal importa aunque la clasificación no se haya tocado: es
    // lo que congela la fila para G7.
    return !esEstadoTerminal(antes.status) && esEstadoTerminal(despues.status);
}
/**
 * Clasifica un ticket recién creado y guarda la sugerencia.
 *
 * Nunca lanza: un fallo aquí no puede afectar al ticket del residente, que ya
 * está escrito y notificado por otro trigger.
 */
async function clasificarTicketEnSombra(ticketId, ticket, db = (0, firestore_1.getFirestore)()) {
    const tenantId = cadena(ticket.tenantId);
    // Un documento sin conjunto no se puede afirmar de nadie — mismo criterio que
    // `ticketPerteneceAlConjunto`, y aquí además no habría a quién cobrarle.
    if (!tenantId)
        return;
    // Las dos banderas, y solo estas dos. **No se comprueba
    // `ai-pqrs-suggestions`**, que es la bandera de la operación en el catálogo:
    // esa hace VISIBLE la sugerencia al administrador, y exigirla aquí ataría la
    // sombra a la sugerencia visible. F4 es exactamente lo contrario — sombra
    // global, visible solo en los conjuntos piloto.
    //
    // `ai-gateway` sí, porque el kill switch maestro tiene que poder apagar esto
    // como apaga todo lo demás; `resolveFeatureFlag` falla cerrado si no puede
    // leer, así que una lectura rota no gasta dinero.
    const [gateway, sombra, proveedorReal] = await Promise.all([
        (0, feature_flags_1.resolveFeatureFlag)("ai-gateway", tenantId),
        (0, feature_flags_1.resolveFeatureFlag)("ai-pqrs-shadow", tenantId),
        // Se lee aquí y no dentro de la ejecución porque decide si esto se hace, no
        // solo cómo: con el simulador no hay nada que valga la pena guardar.
        (0, feature_flags_1.resolveFeatureFlag)("ia-proveedor-real", tenantId),
    ]);
    // Apagada no deja rastro a propósito: una fila «no corrí porque estaba
    // apagada» por cada ticket de cada conjunto sería ruido, y la ausencia de
    // fila ya dice lo mismo.
    if (!gateway.enabled || !sombra.enabled)
        return;
    const operation = (0, catalog_1.findOperation)(OPERACION);
    if (!operation)
        return;
    const ref = db.collection(exports.AI_ASSISTANCE_COLLECTION).doc(ticketId);
    const ahora = firestore_1.Timestamp.now();
    // **La reserva es lo que protege el dinero.** Los triggers de Firestore son
    // «al menos una vez»: la misma creación puede entregarse dos veces aunque no
    // haya reintentos. `create` falla si el documento ya existe, así que la
    // segunda entrega se cae aquí —antes de llamar al modelo— en vez de pagar
    // dos veces por el mismo ticket.
    //
    // El precio de esto es que una función que muera a mitad deja la fila en
    // `en_curso` para siempre, y ese ticket no se reintenta. Se acepta a
    // sabiendas: pagar dos veces en silencio es peor que no clasificar uno y que
    // se vea al contar por estado. `en_curso` no es un estado normal en reposo —
    // si aparece al leer la colección, es que algo se cayó.
    try {
        await ref.create({
            ticketId,
            tenantId,
            estado: "en_curso",
            operationKey: operation.key,
            operationVersion: operation.version,
            creadoEn: ahora,
            actualizadoEn: ahora,
        });
    }
    catch {
        logger.info("sombra-pqrs: el ticket ya tenía fila, no se repite la llamada", { ticketId, tenantId });
        return;
    }
    // Las dos lecturas a la vez: la variante decide la puerta dura de nulls, y el
    // conjunto dice si todo lo suyo es de ejemplo. No dependen la una de la otra.
    const [settingsSnap, tenantSnap] = await Promise.all([
        db.collection("tenantSettings").doc(tenantId).get(),
        db.collection("tenants").doc(tenantId).get(),
    ]);
    const variante = (0, pqrs_ticket_1.variantePqrsDe)(settingsSnap.exists ? settingsSnap.data() : null);
    const plan = planificarSombra(ticket, tenantId, {
        variante,
        conjuntoDeEjemplo: tenantSnap.data()?.isExample === true,
        proveedorReal: proveedorReal.enabled,
    });
    if (plan.accion === "omitir") {
        // El motivo se guarda: el día que alguien cuente cuántos tickets tienen
        // sombra, la diferencia tiene que estar explicada en la colección y no
        // deducirse mirando la variante de cada conjunto.
        await ref.set({ estado: "omitida", motivo: plan.motivo, variante, actualizadoEn: firestore_1.Timestamp.now() }, { merge: true });
        return;
    }
    const outcome = await (0, ejecucion_1.ejecutarOperacionAutorizada)({
        operation,
        // Resuelto del propio documento del ticket, no de una sesión: aquí no hay
        // ninguna. El contrato de `ejecutarOperacionAutorizada` es que quien llama
        // ya se hizo responsable del conjunto, y esto es hacerse responsable.
        tenantId,
        actor: { uid: exports.ACTOR_SOMBRA, topeDeUsuario: false },
        entradaCruda: plan.entrada,
        now: new Date(),
    });
    if (!outcome.ok) {
        await ref.set({
            estado: "fallo",
            motivo: outcome.reason,
            variante,
            actualizadoEn: firestore_1.Timestamp.now(),
        }, { merge: true });
        logger.warn("sombra-pqrs: no se pudo clasificar", { ticketId, tenantId, reason: outcome.reason });
        return;
    }
    await ref.set({
        estado: "sugerida",
        variante,
        // La salida completa, que es lo que pide la PRD §7. **Esta colección sí
        // guarda contenido del conjunto**, a diferencia de `aiUsage` y
        // `aiFeedback`, donde la regla del Paso 0 es que no haya dónde meterlo:
        // aquí el resumen y el borrador SON el dato que G7 necesita. Lo que la
        // protege es la regla de Firestore —solo la lee el superadministrador, que
        // ya puede leer el ticket— y que nadie del conjunto la ve.
        sugerencia: outcome.output,
        // Con qué proveedor se generó DE VERDAD, no con cuál creíamos. La guardia
        // de arriba debería impedir que aquí llegue nunca el simulador; esto es
        // por si la guardia falla, porque un dataset envenenado no da síntomas.
        proveedor: outcome.proveedor,
        recorte: plan.recorte,
        // Solo el vocabulario cerrado, como en `aiUsage`. Las posiciones de las
        // frases sirven para pintarlas en pantalla, y aquí no hay pantalla.
        marcasDeRevision: [...new Set(outcome.frasesMarcadas.map((f) => f.marca))],
        // Se anota aunque el ticket todavía no tenga decisión: lo que aún no pasó
        // se distingue por `decisionActualizadaEn` ausente.
        decision: decisionDelTicket(ticket),
        actualizadoEn: firestore_1.Timestamp.now(),
    }, { merge: true });
    logger.info("sombra-pqrs: ticket clasificado en sombra", { ticketId, tenantId, variante });
}
/**
 * Anota la decisión del administrador junto a la sugerencia.
 *
 * **Se guarda en cada cambio y se congela al resolverse**, en vez de solo al
 * cierre como dice la letra de la PRD. Un ticket con SLA puede vivir semanas
 * abierto: esperar al cierre dejaría fuera del conjunto de evaluación todo lo
 * que se clasifica y no se cierra, que en un piloto es la mayoría. G7 mide
 * contra las congeladas; las demás dejan ver el ritmo sin esperar.
 *
 * **No comprueba la bandera de sombra, y es deliberado.** Esta fila ya se pagó
 * al crearse. Apagar la bandera tiene que dejar de gastar en tickets nuevos, no
 * tirar a la basura los pares que ya estaban a medio construir.
 */
async function registrarDecisionEnSombra(ticketId, antes, despues, db = (0, firestore_1.getFirestore)()) {
    if (!hayQueRegistrarDecision(antes, despues))
        return;
    const ref = db.collection(exports.AI_ASSISTANCE_COLLECTION).doc(ticketId);
    // En transacción porque dos escrituras seguidas sobre el ticket —clasificar y
    // resolver, que es la secuencia normal— disparan dos veces esto, y `congelada`
    // se decide leyendo lo que ya hay.
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        // Sin fila no hay nada que completar: la colección es exactamente el
        // conjunto de tickets que la sombra llegó a ver. Crear una aquí llenaría
        // `aiAssistance` de decisiones sin sugerencia, que para G7 no valen y al
        // contar mentirían sobre la cobertura.
        if (!snap.exists)
            return;
        const yaCongelada = snap.get("decisionCongeladaEn");
        const terminal = esEstadoTerminal(despues.status);
        tx.set(ref, {
            decision: decisionDelTicket(despues),
            decisionActualizadaEn: firestore_1.Timestamp.now(),
            // Se pone una sola vez: marca cuándo el ticket llegó por primera vez a
            // un estado cerrado. Si después se reabre y se reclasifica, `decision`
            // sigue actualizándose y esta fecha no se mueve.
            ...(terminal && !yaCongelada ? { decisionCongeladaEn: firestore_1.Timestamp.now() } : {}),
        }, { merge: true });
    });
}
