import { beforeAll, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { findOperation, type OperationDefinition } from "../src/ai/catalog";
import { consumeQuota, counterIds, refundQuota, AI_QUOTA_COLLECTION } from "../src/ai/quota";

/**
 * Cuotas contra el emulador — Paso 1.6 de docs/hoja-de-ruta-ia.md.
 *
 * La afirmación central del paso es que el consumo es ATÓMICO: «si no es
 * atómica, se evade repitiendo la llamada rápido». Eso no se demuestra
 * escribiendo `runTransaction` y confiando; se demuestra lanzando peticiones a
 * la vez y contando cuántas pasaron.
 *
 * Necesita el emulador levantado:
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const REAL = findOperation("comunicaciones-redactar") as OperationDefinition;
let db: Firestore;

/** Operación sintética con topes pequeños: la prueba es rápida y determinista. */
function conCuota(perTenantDay: number, perTenantMonth = 1000, perUserDay = 1000): OperationDefinition {
  return { ...REAL, quota: { perTenantDay, perTenantMonth, perUserDay } };
}

/** Un conjunto distinto por prueba: sin limpieza y sin interferencias. */
let n = 0;
const nuevoConjunto = () => `conjunto-prueba-${Date.now()}-${n++}`;

beforeAll(async () => {
  initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  db = getFirestore();

  try {
    await db.collection("__ping").doc("ping").set({ ok: true });
  } catch (error) {
    throw new Error(
      `No hay emulador de Firestore en ${process.env.FIRESTORE_EMULATOR_HOST}. ` +
        `Levántalo con: firebase emulators:start --only firestore --project hogaru-1-test\n${error}`,
    );
  }
});

describe("consumo secuencial", () => {
  it("deja pasar hasta el tope y rechaza el siguiente", async () => {
    const op = conCuota(3);
    const tenant = nuevoConjunto();

    for (let i = 0; i < 3; i++) {
      const r = await consumeQuota(op, tenant, "admin-1", new Date(), db);
      expect(r.ok).toBe(true);
    }

    const cuarto = await consumeQuota(op, tenant, "admin-1", new Date(), db);
    expect(cuarto.ok).toBe(false);
    expect(cuarto.ok === false && cuarto.excedida).toBe("conjunto_dia");
    expect(cuarto.ok === false && cuarto.message).toContain("proceso manual");
  });

  it("informa de cuánto queda después de consumir", async () => {
    const op = conCuota(5);
    const tenant = nuevoConjunto();

    const primera = await consumeQuota(op, tenant, "admin-1", new Date(), db);
    expect(primera.restante.conjuntoDia).toBe(4);
  });

  it("el mes manda sobre el día: no se dice «vuelve mañana» si el mes se agotó", async () => {
    const op = conCuota(100, 2);
    const tenant = nuevoConjunto();

    await consumeQuota(op, tenant, "admin-1", new Date(), db);
    await consumeQuota(op, tenant, "admin-1", new Date(), db);
    const tercera = await consumeQuota(op, tenant, "admin-1", new Date(), db);

    expect(tercera.ok === false && tercera.excedida).toBe("conjunto_mes");
  });
});

describe("ATOMICIDAD — la afirmación del paso", () => {
  it("veinte peticiones simultáneas contra un tope de cinco dejan pasar exactamente cinco", async () => {
    // Sin transacción, todas leerían «llevas 0 de 5» y pasarían las veinte.
    const op = conCuota(5);
    const tenant = nuevoConjunto();

    const resultados = await Promise.all(
      Array.from({ length: 20 }, () => consumeQuota(op, tenant, "admin-1", new Date(), db)),
    );

    expect(resultados.filter((r) => r.ok)).toHaveLength(5);
    expect(resultados.filter((r) => !r.ok)).toHaveLength(15);
  });

  it("el contador queda cuadrado con lo que se concedió", async () => {
    const op = conCuota(4);
    const tenant = nuevoConjunto();

    await Promise.all(Array.from({ length: 15 }, () => consumeQuota(op, tenant, "admin-1", new Date(), db)));

    const ids = counterIds(op.key, tenant, "admin-1");
    const snap = await db.collection(AI_QUOTA_COLLECTION).doc(ids.conjuntoDia).get();
    expect(snap.data()?.count).toBe(4);
  });

  it("usuarios distintos en paralelo no se saltan el tope del conjunto", async () => {
    // El caso real: dos administradores del mismo conjunto pulsando a la vez.
    const op = conCuota(6);
    const tenant = nuevoConjunto();

    const resultados = await Promise.all([
      ...Array.from({ length: 8 }, () => consumeQuota(op, tenant, "admin-1", new Date(), db)),
      ...Array.from({ length: 8 }, () => consumeQuota(op, tenant, "admin-2", new Date(), db)),
    ]);

    expect(resultados.filter((r) => r.ok)).toHaveLength(6);
  });
});

describe("aislamiento entre conjuntos", () => {
  it("agotar un conjunto no toca al de al lado", async () => {
    // Es la razón de fondo del paso: el tope de Google es de la cuenta entera,
    // así que sin esto el primer conjunto que se desboque deja sin IA al resto.
    const op = conCuota(2);
    const unoA = nuevoConjunto();
    const unoB = nuevoConjunto();

    await consumeQuota(op, unoA, "admin-1", new Date(), db);
    await consumeQuota(op, unoA, "admin-1", new Date(), db);
    expect((await consumeQuota(op, unoA, "admin-1", new Date(), db)).ok).toBe(false);

    expect((await consumeQuota(op, unoB, "admin-1", new Date(), db)).ok).toBe(true);
  });

  it("el tope por usuario no deja que uno se coma lo del conjunto", async () => {
    const op = conCuota(100, 1000, 2);
    const tenant = nuevoConjunto();

    await consumeQuota(op, tenant, "admin-1", new Date(), db);
    await consumeQuota(op, tenant, "admin-1", new Date(), db);

    const tercera = await consumeQuota(op, tenant, "admin-1", new Date(), db);
    expect(tercera.ok === false && tercera.excedida).toBe("usuario_dia");

    // El compañero sigue teniendo la suya.
    expect((await consumeQuota(op, tenant, "admin-2", new Date(), db)).ok).toBe(true);
  });
});

describe("devolución", () => {
  it("devuelve la unidad y vuelve a caber", async () => {
    const op = conCuota(1);
    const tenant = nuevoConjunto();

    await consumeQuota(op, tenant, "admin-1", new Date(), db);
    expect((await consumeQuota(op, tenant, "admin-1", new Date(), db)).ok).toBe(false);

    await refundQuota(op, tenant, "admin-1", new Date(), db);
    expect((await consumeQuota(op, tenant, "admin-1", new Date(), db)).ok).toBe(true);
  });

  it("no baja de cero: un contador negativo regalaría cuota para siempre", async () => {
    const op = conCuota(3);
    const tenant = nuevoConjunto();

    await consumeQuota(op, tenant, "admin-1", new Date(), db);
    await refundQuota(op, tenant, "admin-1", new Date(), db);
    await refundQuota(op, tenant, "admin-1", new Date(), db);
    await refundQuota(op, tenant, "admin-1", new Date(), db);

    const ids = counterIds(op.key, tenant, "admin-1");
    const snap = await db.collection(AI_QUOTA_COLLECTION).doc(ids.conjuntoDia).get();
    expect(snap.data()?.count).toBe(0);
  });
});

describe("los números reales del catálogo", () => {
  it("un conjunto puede pedir 20 borradores seguidos sin rozar su tope", async () => {
    // La línea base del Paso 2 son 10-15 comunicaciones en total: las cuotas
    // están para atrapar un bucle, no para molestar a un administrador.
    const tenant = nuevoConjunto();

    for (let i = 0; i < 20; i++) {
      const r = await consumeQuota(REAL, tenant, "admin-1", new Date(), db);
      expect(r.ok).toBe(true);
    }

    // El 21 choca con el tope por usuario, no con el del conjunto.
    const extra = await consumeQuota(REAL, tenant, "admin-1", new Date(), db);
    expect(extra.ok === false && extra.excedida).toBe("usuario_dia");
  });
});
