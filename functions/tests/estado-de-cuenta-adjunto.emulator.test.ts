import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { adjuntoEsDelDestinatario, unidadDelDestinatario } from "../src/estado-de-cuenta-adjunto";

/**
 * `PRD-V-FLOW-003` R9 / CF7 — el adjunto es el de la unidad del destinatario.
 *
 * **Lo que estas pruebas vigilan es una fuga, no un cálculo.** §12 lo llama «el peor error posible
 * de esta PRD». Y su forma es traicionera: no lanza, no enrojece, no deja rastro en ningún log.
 * Sale un correo correcto con el papel de otra persona dentro, y se descubre cuando llama el
 * vecino.
 *
 * Casi todas las pruebas de este fichero comprueban que **NO** se resuelve. Eso es a propósito: la
 * versión peligrosa de esta función es la que siempre devuelve algo.
 *
 * Necesita el emulador:
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const T = "conjunto-r9";
const OTRO = "conjunto-vecino";

let db: Firestore;

beforeAll(() => {
  if (getApps().length === 0) initializeApp({ projectId: "hogaru-1-test" });
  db = getFirestore();
});

beforeEach(async () => {
  const snap = await db.collection("tenantUsers").get();
  const batch = db.batch();
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
});

async function membresia(tenantId: string, uid: string, extra: Record<string, unknown> = {}) {
  await db.collection("tenantUsers").doc(`${tenantId}_${uid}`).set({
    tenantId,
    uid,
    role: "resident",
    status: "active",
    unitId: "unidad-propia",
    ...extra,
  });
}

describe("FLOW-003 · R9 · de quién es el adjunto", () => {
  it("resuelve la unidad de su propio residente", async () => {
    await membresia(T, "ana");
    expect(await unidadDelDestinatario(db, T, "ana")).toEqual({ uid: "ana", tenantId: T, unitId: "unidad-propia" });
  });

  it("NO resuelve a alguien sin membresía en ese conjunto", async () => {
    await membresia(OTRO, "ana", { unitId: "unidad-del-vecino" });
    // Ana existe, y tiene unidad — pero en OTRO conjunto. Devolver esa unidad sería
    // mandarle a alguien el papel de un edificio en el que no vive.
    expect(await unidadDelDestinatario(db, T, "ana")).toBeNull();
  });

  /**
   * **El documento heredado con el id y el campo discrepando.** Está medido en este repositorio:
   * pasa el conteo laxo de «tiene membresía» y falla el predicado real. Comprobar solo el id
   * dejaría entrar exactamente a éste.
   */
  it("NO resuelve si el campo `tenantId` no concuerda con el id del documento", async () => {
    await db.collection("tenantUsers").doc(`${T}_ana`).set({
      tenantId: OTRO,
      uid: "ana",
      status: "active",
      unitId: "unidad-propia",
    });
    expect(await unidadDelDestinatario(db, T, "ana")).toBeNull();
  });

  it("NO resuelve si el `uid` del documento es otro", async () => {
    await db.collection("tenantUsers").doc(`${T}_ana`).set({
      tenantId: T,
      uid: "beto",
      status: "active",
      unitId: "unidad-propia",
    });
    expect(await unidadDelDestinatario(db, T, "ana")).toBeNull();
  });

  it("NO resuelve a una membresía inactiva", async () => {
    await membresia(T, "ana", { status: "inactive" });
    expect(await unidadDelDestinatario(db, T, "ana")).toBeNull();
  });

  /**
   * **Sin unidad, `null` — nunca un valor por defecto.** Es la misma decisión que la ficha tomó
   * para el paz y salvo: antes, con la unidad sin reconocer, salía vacío, daba cero y se firmaba
   * igual. Un adjunto es un documento que se entrega.
   */
  it.each([
    ["sin unidad asignada", { unitId: "" }],
    ["unidad en blanco", { unitId: "   " }],
    ["sin el campo", { unitId: null }],
  ])("NO resuelve %s", async (_c, extra) => {
    await membresia(T, "ana", extra as Record<string, unknown>);
    expect(await unidadDelDestinatario(db, T, "ana")).toBeNull();
  });

  it("NO resuelve con conjunto o uid vacíos, sin ir a la base", async () => {
    expect(await unidadDelDestinatario(db, "", "ana")).toBeNull();
    expect(await unidadDelDestinatario(db, T, "")).toBeNull();
  });

  /**
   * **Dos residentes del mismo conjunto, que es el caso del bucle real.** Si esto devolviera lo
   * mismo para los dos, el fallo sería invisible: los dos correos salen, los dos llegan, y uno
   * lleva la deuda del otro.
   */
  it("dos residentes del mismo conjunto resuelven a unidades DISTINTAS", async () => {
    await membresia(T, "ana", { unitId: "u-101" });
    await membresia(T, "beto", { unitId: "u-202" });

    const a = await unidadDelDestinatario(db, T, "ana");
    const b = await unidadDelDestinatario(db, T, "beto");
    expect(a?.unitId).toBe("u-101");
    expect(b?.unitId).toBe("u-202");
    expect(a?.unitId).not.toBe(b?.unitId);
  });
});

describe("FLOW-003 · R9 · el cinturón antes de enviar", () => {
  const ana = { uid: "ana", tenantId: T, unitId: "u-101" };

  it("acepta el adjunto de su propia unidad", () => {
    expect(adjuntoEsDelDestinatario(ana, { tenantId: T, unitId: "u-101" })).toBe(true);
  });

  it("RECHAZA el de otra unidad del mismo conjunto — el error de fontanería típico", () => {
    // Resolver dentro del bucle y enviar fuera, o reutilizar una variable. El
    // compilador no lo ve: los dos valores son `string`.
    expect(adjuntoEsDelDestinatario(ana, { tenantId: T, unitId: "u-202" })).toBe(false);
  });

  it("RECHAZA el de otro conjunto aunque la unidad se llame igual", () => {
    expect(adjuntoEsDelDestinatario(ana, { tenantId: OTRO, unitId: "u-101" })).toBe(false);
  });
});
