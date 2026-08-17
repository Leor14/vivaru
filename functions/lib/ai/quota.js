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
exports.AI_QUOTA_COLLECTION = void 0;
exports.evaluateQuota = evaluateQuota;
exports.periodKeys = periodKeys;
exports.counterIds = counterIds;
exports.consumeQuota = consumeQuota;
exports.refundQuota = refundQuota;
const firestore_1 = require("firebase-admin/firestore");
const logger = __importStar(require("firebase-functions/logger"));
/**
 * Cuotas por conjunto, usuario y operación (Paso 1.6 de
 * `docs/hoja-de-ruta-ia.md`).
 *
 * **No es solo control de costo.** El límite de inversión de Google es de la
 * cuenta entera: si un conjunto se desboca, se come el presupuesto y deja sin
 * capacidad asistida a todos los demás. Esto es lo que impide que el problema
 * de uno sea el problema de todos — el mismo aislamiento entre conjuntos que
 * sostiene el resto de Vivaru, aplicado al gasto.
 *
 * Y es la única capa que corta **en el momento**: el tope de Google tarda horas
 * en consolidar costos, según su propia letra pequeña.
 */
exports.AI_QUOTA_COLLECTION = "aiQuotaCounters";
const MENSAJE_POR_SCOPE = {
    conjunto_mes: "El conjunto alcanzó el máximo de propuestas asistidas de este mes.",
    conjunto_dia: "El conjunto alcanzó el máximo de propuestas asistidas de hoy.",
    usuario_dia: "Alcanzaste tu máximo de propuestas asistidas por hoy.",
};
/** Todos los mensajes terminan igual: el camino manual nunca se cierra. */
const SEGUIR_A_MANO = "Puedes continuar con el proceso manual.";
/**
 * Decisión pura, sin Firestore. Se prueba entera en milisegundos.
 *
 * El orden importa: **el mes se comprueba antes que el día**. Si un conjunto
 * agotó el mes, decirle «vuelve mañana» sería mentira.
 */
function evaluateQuota(counts, quota, opciones = {}) {
    const topeDeUsuario = opciones.topeDeUsuario ?? true;
    const restante = {
        conjuntoDia: Math.max(0, quota.perTenantDay - counts.conjuntoDia),
        conjuntoMes: Math.max(0, quota.perTenantMonth - counts.conjuntoMes),
        // Sin tope de usuario, el contador ni se leyó: lo honesto es decir que está
        // entero, no restarle un consumo que no ocurrió.
        usuarioDia: topeDeUsuario ? Math.max(0, quota.perUserDay - counts.usuarioDia) : quota.perUserDay,
    };
    const excedida = counts.conjuntoMes >= quota.perTenantMonth
        ? "conjunto_mes"
        : counts.conjuntoDia >= quota.perTenantDay
            ? "conjunto_dia"
            : topeDeUsuario && counts.usuarioDia >= quota.perUserDay
                ? "usuario_dia"
                : null;
    if (excedida) {
        return { ok: false, excedida, message: `${MENSAJE_POR_SCOPE[excedida]} ${SEGUIR_A_MANO}`, restante };
    }
    return { ok: true, restante };
}
/**
 * Claves de periodo en UTC.
 *
 * Colombia va cinco horas por detrás, así que el «día» reinicia a las 19:00
 * locales. Es deliberado: estos topes existen para atrapar un bucle, no para
 * racionar el trabajo de nadie, y el gasto que acotan también se factura en
 * UTC. Cuadrar el reinicio con la medianoche local obligaría a saber la zona de
 * cada conjunto, que hoy no se guarda.
 */
function periodKeys(now = new Date()) {
    const iso = now.toISOString();
    return { dia: iso.slice(0, 10), mes: iso.slice(0, 7) };
}
/** Los tres documentos que gobiernan una llamada. */
function counterIds(operationKey, tenantId, uid, now = new Date()) {
    const { dia, mes } = periodKeys(now);
    return {
        conjuntoDia: `t:${tenantId}:${operationKey}:d:${dia}`,
        conjuntoMes: `t:${tenantId}:${operationKey}:m:${mes}`,
        usuarioDia: `u:${tenantId}:${uid}:${operationKey}:d:${dia}`,
    };
}
function leerCuenta(snap) {
    const valor = snap.exists ? snap.data().count : 0;
    return typeof valor === "number" && Number.isFinite(valor) && valor > 0 ? valor : 0;
}
/**
 * Consume una unidad de cuota, o rechaza. **En una transacción.**
 *
 * La transacción no es ceremonia: sin ella, dos peticiones casi simultáneas
 * leen «llevas 49 de 50», las dos concluyen que hay sitio y las dos escriben
 * 50. Se consumieron dos y el contador dice una — repítelo rápido y la cuota
 * deja de existir. Es literalmente el fallo que el plan nombra en una línea.
 *
 * Y no vale `FieldValue.increment` a secas: es atómico pero incrementa a
 * ciegas, y aquí hay que **decidir** con el valor antes de escribirlo.
 */
async function consumeQuota(operation, tenantId, uid, now = new Date(), db = (0, firestore_1.getFirestore)(), opciones = {}) {
    const topeDeUsuario = opciones.topeDeUsuario ?? true;
    const ids = counterIds(operation.key, tenantId, uid, now);
    const col = db.collection(exports.AI_QUOTA_COLLECTION);
    const refs = {
        conjuntoDia: col.doc(ids.conjuntoDia),
        conjuntoMes: col.doc(ids.conjuntoMes),
        usuarioDia: col.doc(ids.usuarioDia),
    };
    return db.runTransaction(async (tx) => {
        const [dia, mes, usuario] = await Promise.all([
            tx.get(refs.conjuntoDia),
            tx.get(refs.conjuntoMes),
            // Sin tope de usuario no se lee: una lectura cuyo valor no decide nada.
            topeDeUsuario ? tx.get(refs.usuarioDia) : Promise.resolve(null),
        ]);
        const counts = {
            conjuntoDia: leerCuenta(dia),
            conjuntoMes: leerCuenta(mes),
            usuarioDia: usuario ? leerCuenta(usuario) : 0,
        };
        const decision = evaluateQuota(counts, operation.quota, opciones);
        if (!decision.ok)
            return decision;
        const sello = firestore_1.Timestamp.now();
        const base = { tenantId, operationKey: operation.key, updatedAt: sello };
        tx.set(refs.conjuntoDia, { ...base, scope: "conjunto_dia", count: counts.conjuntoDia + 1 }, { merge: true });
        tx.set(refs.conjuntoMes, { ...base, scope: "conjunto_mes", count: counts.conjuntoMes + 1 }, { merge: true });
        // El contador de usuario no se toca cuando no hay usuario. Escribir una fila
        // `u:...:__sombra__:...` daría un contador que nadie evalúa y que al leer la
        // telemetría parecería un tope vivo.
        if (topeDeUsuario) {
            tx.set(refs.usuarioDia, { ...base, scope: "usuario_dia", uid, count: counts.usuarioDia + 1 }, { merge: true });
        }
        // Lo que queda DESPUÉS de consumir: es lo que una pantalla necesita para
        // deshabilitar el botón antes de que el usuario choque contra el tope.
        return {
            ok: true,
            restante: {
                conjuntoDia: decision.restante.conjuntoDia - 1,
                conjuntoMes: decision.restante.conjuntoMes - 1,
                usuarioDia: topeDeUsuario ? decision.restante.usuarioDia - 1 : decision.restante.usuarioDia,
            },
        };
    });
}
/**
 * Devuelve una unidad consumida.
 *
 * Solo cuando **el proveedor no llegó a responder**. Si respondió y su salida
 * incumplió el contrato, los tokens se gastaron y la cuota se queda consumida:
 * devolverla ahí sería mentir sobre el costo, igual que descontar esa llamada
 * de la telemetría.
 *
 * Nunca lanza. Que no se pueda devolver una unidad no es motivo para romperle
 * la sesión a nadie.
 */
async function refundQuota(operation, tenantId, uid, now = new Date(), db = (0, firestore_1.getFirestore)(), opciones = {}) {
    const topeDeUsuario = opciones.topeDeUsuario ?? true;
    const ids = counterIds(operation.key, tenantId, uid, now);
    const col = db.collection(exports.AI_QUOTA_COLLECTION);
    try {
        await db.runTransaction(async (tx) => {
            // Se devuelve exactamente lo que se cobró. Descontar el contador de
            // usuario a quien no lo consumió lo dejaría por debajo del real y
            // regalaría cuota al siguiente administrador que sí sea una persona.
            const refs = [
                col.doc(ids.conjuntoDia),
                col.doc(ids.conjuntoMes),
                ...(topeDeUsuario ? [col.doc(ids.usuarioDia)] : []),
            ];
            const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
            snaps.forEach((snap, i) => {
                if (!snap.exists)
                    return;
                // Suelo en cero: un contador negativo regalaría cuota para siempre.
                tx.update(refs[i], { count: Math.max(0, leerCuenta(snap) - 1), updatedAt: firestore_1.Timestamp.now() });
            });
        });
    }
    catch (error) {
        logger.error("aiQuota: no se pudo devolver la cuota", {
            operationKey: operation.key,
            tenantId,
            detail: error instanceof Error ? error.message : String(error),
        });
    }
}
