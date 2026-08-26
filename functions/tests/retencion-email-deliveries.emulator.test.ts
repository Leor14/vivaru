import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";

import { anonymizeExpiredEmailDeliveries } from "../src/data-retention";

/**
 * `PRD-V-FLOW-003` §7.4 — la retención del rastro de entrega.
 *
 * **Se prueba porque el bucle tiene un riesgo que las otras retenciones no tienen.** Las tres que
 * ya existían —`anonymizeExpiredVouchers`, `purgeExpiredAiUsage`, `purgeExpiredAiFeedback`— no
 * tienen prueba, y las dos últimas pueden permitírselo: BORRAN, así que la propia consulta se
 * queda sin filas y el bucle termina solo.
 *
 * Ésta **anonimiza y no borra**, y ahí está la trampa: la fila sigue casando con
 * `sentAt < corte` después de tocarla. Sin cursor, la misma consulta devolvería para siempre las
 * mismas 400 filas y el proceso nocturno **no terminaría nunca** — sin error, sin rojo, solo un
 * cron que se cuelga. Por eso el cursor no es una optimización: es la condición de que el bucle
 * acabe, y es lo que estas pruebas vigilan.
 *
 * Necesita el emulador:
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const TENANT = "conjunto-retencion";
const AHORA = new Date("2026-08-26T12:00:00Z");

/** Hace `meses` que salió. */
function haceMeses(meses: number): Timestamp {
  const d = new Date(AHORA);
  d.setMonth(d.getMonth() - meses);
  return Timestamp.fromDate(d);
}

let db: Firestore;

beforeAll(() => {
  if (getApps().length === 0) initializeApp({ projectId: "hogaru-1-test" });
  db = getFirestore();
});

beforeEach(async () => {
  const viejas = await db.collection("emailDeliveries").get();
  const batch = db.batch();
  viejas.forEach((d) => batch.delete(d.ref));
  await batch.commit();
});

async function sembrar(id: string, meses: number, extra: Record<string, unknown> = {}) {
  await db.collection("emailDeliveries").doc(id).set({
    tenantId: TENANT,
    providerMessageId: id,
    recipientEmail: `${id}@ejemplo.co`,
    recipientUserId: `uid-${id}`,
    notificationKey: "billing_new",
    subject: "Tu cuota",
    status: "entregado",
    sentAt: haceMeses(meses),
    ...extra,
  });
}

describe("FLOW-003 · retención del rastro de entrega", () => {
  it("vacía la dirección de lo vencido y NO toca lo reciente", async () => {
    await sembrar("vieja", 13);
    await sembrar("reciente", 2);

    const n = await anonymizeExpiredEmailDeliveries(db, AHORA);
    expect(n).toBe(1);

    const vieja = (await db.collection("emailDeliveries").doc("vieja").get()).data();
    expect(vieja?.recipientEmail).toBeNull();
    expect(vieja?.recipientUserId).toBeNull();
    expect(vieja?.anonymizedAt).toBeDefined();

    const reciente = (await db.collection("emailDeliveries").doc("reciente").get()).data();
    expect(reciente?.recipientEmail).toBe("reciente@ejemplo.co");
  });

  /**
   * **El criterio va sobre lo que SOBREVIVE, no sobre lo que se borra.** Anonimizar cumpliría la
   * retención igual borrando la fila entera; lo que separa las dos opciones es que aquí la
   * métrica de entregabilidad tiene que seguir en pie. Si algún día alguien cambia esto por un
   * `delete`, esta prueba es la que lo caza.
   */
  it("conserva la métrica: estado, fecha y aviso siguen ahí", async () => {
    await sembrar("vieja", 13);
    await anonymizeExpiredEmailDeliveries(db, AHORA);

    const d = (await db.collection("emailDeliveries").doc("vieja").get()).data();
    expect(d).toBeDefined();
    expect(d?.status).toBe("entregado");
    expect(d?.notificationKey).toBe("billing_new");
    expect(d?.sentAt).toBeDefined();
    expect(d?.tenantId).toBe(TENANT);
  });

  it("es idempotente: la segunda pasada no cuenta nada", async () => {
    await sembrar("vieja", 13);

    expect(await anonymizeExpiredEmailDeliveries(db, AHORA)).toBe(1);
    expect(await anonymizeExpiredEmailDeliveries(db, AHORA)).toBe(0);
  });

  /**
   * **La prueba que justifica el cursor.** Con más filas que el tamaño del lote y sin cursor, la
   * consulta devolvería siempre las mismas primeras 400 —ya anonimizadas, así que `ops` sería 0—
   * y el bucle giraría para siempre. Que esto TERMINE es el resultado.
   */
  it("con más filas que el lote, termina y las alcanza todas", async () => {
    const total = 30;
    for (let i = 0; i < total; i++) await sembrar(`v${String(i).padStart(3, "0")}`, 13 + i);

    // **Lote de 7 a propósito.** Con el de producción (400) estas 30 filas caben en una sola
    // página y el cursor NUNCA se ejercita: la prueba pasaría igual sin él, que es justo la
    // forma de tener un guardián que no guarda nada. Con 7 hacen falta cinco vueltas.
    const n = await anonymizeExpiredEmailDeliveries(db, AHORA, undefined, 7);
    expect(n).toBe(total);

    const quedan = await db.collection("emailDeliveries").where("recipientEmail", "!=", null).get();
    expect(quedan.size).toBe(0);
  });

  it("no vuelve a tocar una fila ya anonimizada aunque le quede la marca sola", async () => {
    await sembrar("ya", 13, { recipientEmail: null, recipientUserId: null, anonymizedAt: Timestamp.now() });
    expect(await anonymizeExpiredEmailDeliveries(db, AHORA)).toBe(0);
  });
});
