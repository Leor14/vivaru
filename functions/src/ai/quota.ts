import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

import type { OperationDefinition, OperationQuota } from "./catalog";

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

export const AI_QUOTA_COLLECTION = "aiQuotaCounters";

/** Cuál de los tres topes se agotó. */
export type QuotaScope = "conjunto_dia" | "conjunto_mes" | "usuario_dia";

export interface QuotaCounts {
  conjuntoDia: number;
  conjuntoMes: number;
  usuarioDia: number;
}

export interface QuotaRemaining {
  conjuntoDia: number;
  conjuntoMes: number;
  usuarioDia: number;
}

export type QuotaDecision =
  | { ok: true; restante: QuotaRemaining }
  | { ok: false; excedida: QuotaScope; message: string; restante: QuotaRemaining };

const MENSAJE_POR_SCOPE: Record<QuotaScope, string> = {
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
export function evaluateQuota(counts: QuotaCounts, quota: OperationQuota): QuotaDecision {
  const restante: QuotaRemaining = {
    conjuntoDia: Math.max(0, quota.perTenantDay - counts.conjuntoDia),
    conjuntoMes: Math.max(0, quota.perTenantMonth - counts.conjuntoMes),
    usuarioDia: Math.max(0, quota.perUserDay - counts.usuarioDia),
  };

  const excedida: QuotaScope | null =
    counts.conjuntoMes >= quota.perTenantMonth
      ? "conjunto_mes"
      : counts.conjuntoDia >= quota.perTenantDay
        ? "conjunto_dia"
        : counts.usuarioDia >= quota.perUserDay
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
export function periodKeys(now: Date = new Date()): { dia: string; mes: string } {
  const iso = now.toISOString();
  return { dia: iso.slice(0, 10), mes: iso.slice(0, 7) };
}

interface CounterRefs {
  conjuntoDia: string;
  conjuntoMes: string;
  usuarioDia: string;
}

/** Los tres documentos que gobiernan una llamada. */
export function counterIds(
  operationKey: string,
  tenantId: string,
  uid: string,
  now: Date = new Date(),
): CounterRefs {
  const { dia, mes } = periodKeys(now);
  return {
    conjuntoDia: `t:${tenantId}:${operationKey}:d:${dia}`,
    conjuntoMes: `t:${tenantId}:${operationKey}:m:${mes}`,
    usuarioDia: `u:${tenantId}:${uid}:${operationKey}:d:${dia}`,
  };
}

function leerCuenta(snap: FirebaseFirestore.DocumentSnapshot): number {
  const valor = snap.exists ? (snap.data() as { count?: unknown }).count : 0;
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
export async function consumeQuota(
  operation: OperationDefinition,
  tenantId: string,
  uid: string,
  now: Date = new Date(),
  db: Firestore = getFirestore(),
): Promise<QuotaDecision> {
  const ids = counterIds(operation.key, tenantId, uid, now);
  const col = db.collection(AI_QUOTA_COLLECTION);
  const refs = {
    conjuntoDia: col.doc(ids.conjuntoDia),
    conjuntoMes: col.doc(ids.conjuntoMes),
    usuarioDia: col.doc(ids.usuarioDia),
  };

  return db.runTransaction(async (tx) => {
    const [dia, mes, usuario] = await Promise.all([
      tx.get(refs.conjuntoDia),
      tx.get(refs.conjuntoMes),
      tx.get(refs.usuarioDia),
    ]);

    const counts: QuotaCounts = {
      conjuntoDia: leerCuenta(dia),
      conjuntoMes: leerCuenta(mes),
      usuarioDia: leerCuenta(usuario),
    };

    const decision = evaluateQuota(counts, operation.quota);
    if (!decision.ok) return decision;

    const sello = Timestamp.now();
    const base = { tenantId, operationKey: operation.key, updatedAt: sello };
    tx.set(refs.conjuntoDia, { ...base, scope: "conjunto_dia", count: counts.conjuntoDia + 1 }, { merge: true });
    tx.set(refs.conjuntoMes, { ...base, scope: "conjunto_mes", count: counts.conjuntoMes + 1 }, { merge: true });
    tx.set(refs.usuarioDia, { ...base, scope: "usuario_dia", uid, count: counts.usuarioDia + 1 }, { merge: true });

    // Lo que queda DESPUÉS de consumir: es lo que una pantalla necesita para
    // deshabilitar el botón antes de que el usuario choque contra el tope.
    return {
      ok: true,
      restante: {
        conjuntoDia: decision.restante.conjuntoDia - 1,
        conjuntoMes: decision.restante.conjuntoMes - 1,
        usuarioDia: decision.restante.usuarioDia - 1,
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
export async function refundQuota(
  operation: OperationDefinition,
  tenantId: string,
  uid: string,
  now: Date = new Date(),
  db: Firestore = getFirestore(),
): Promise<void> {
  const ids = counterIds(operation.key, tenantId, uid, now);
  const col = db.collection(AI_QUOTA_COLLECTION);

  try {
    await db.runTransaction(async (tx) => {
      const refs = [col.doc(ids.conjuntoDia), col.doc(ids.conjuntoMes), col.doc(ids.usuarioDia)];
      const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

      snaps.forEach((snap, i) => {
        if (!snap.exists) return;
        // Suelo en cero: un contador negativo regalaría cuota para siempre.
        tx.update(refs[i], { count: Math.max(0, leerCuenta(snap) - 1), updatedAt: Timestamp.now() });
      });
    });
  } catch (error) {
    logger.error("aiQuota: no se pudo devolver la cuota", {
      operationKey: operation.key,
      tenantId,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
