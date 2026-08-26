import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";

import { aplicarEventoDeCorreo } from "../src/email-webhook";

/**
 * `PRD-V-FLOW-003` — la otra mitad del webhook.
 *
 * `webhook-firma.test.ts` prueba **quién entra**; esto prueba **qué pasa cuando entra**. Separarlos
 * no es cosmético: la firma se puede probar sin red ni base, y mezclarlas obligaría a levantar el
 * emulador para verificar un HMAC.
 *
 * Necesita el emulador:
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const TENANT = "conjunto-webhook";
const MSG = "resend-msg-abc";

let db: Firestore;

beforeAll(() => {
  if (getApps().length === 0) initializeApp({ projectId: "hogaru-1-test" });
  db = getFirestore();
});

beforeEach(async () => {
  for (const col of ["emailDeliveries", "people"]) {
    const snap = await db.collection(col).get();
    const batch = db.batch();
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await db.collection("emailDeliveries").doc(MSG).set({
    tenantId: TENANT,
    providerMessageId: MSG,
    recipientEmail: "residente@ejemplo.co",
    recipientUserId: "uid-residente",
    notificationKey: "billing_new",
    subject: "Tu cuota",
    status: "enviado",
    sentAt: Timestamp.now(),
  });
  await db.collection("people").doc("persona-1").set({
    tenantId: TENANT,
    userId: "uid-residente",
    fullName: "Ana Lucía Pérez",
  });
});

const evento = (type: string, email_id: string = MSG) => ({ type, data: { email_id } });

describe("FLOW-003 · aplicar un evento verificado", () => {
  it("mueve el estado de la fila", async () => {
    expect(await aplicarEventoDeCorreo(db, evento("email.delivered"))).toBe("aplicado");
    const d = (await db.collection("emailDeliveries").doc(MSG).get()).data();
    expect(d?.status).toBe("entregado");
    expect(d?.updatedAt).toBeDefined();
  });

  /**
   * **La idempotencia la garantiza la base, no una comprobación previa** (§7.1): el id del
   * documento ES el del proveedor, así que el mismo evento repetido escribe encima del mismo
   * documento. Los proveedores reintentan; sin esto habría una fila por reintento.
   */
  it("el mismo evento dos veces deja UN documento y el mismo estado", async () => {
    await aplicarEventoDeCorreo(db, evento("email.delivered"));
    await aplicarEventoDeCorreo(db, evento("email.delivered"));

    const todas = await db.collection("emailDeliveries").get();
    expect(todas.size).toBe(1);
    expect(todas.docs[0].data().status).toBe("entregado");
  });

  it("un rebote marca el contacto en `people`, que es donde se corrige", async () => {
    expect(await aplicarEventoDeCorreo(db, evento("email.bounced"))).toBe("aplicado");

    expect((await db.collection("emailDeliveries").doc(MSG).get()).data()?.status).toBe("rebotado");
    expect((await db.collection("people").doc("persona-1").get()).data()?.emailStatus).toBe("bounced");
  });

  it("una queja de spam marca `complained`, que no es lo mismo que un rebote", async () => {
    // Un rebote es una dirección rota; una queja es alguien que NO quiere el correo.
    // Tratarlos igual haría que se persiguiera a quien pidió que no le escribieran.
    await aplicarEventoDeCorreo(db, evento("email.complained"));
    expect((await db.collection("people").doc("persona-1").get()).data()?.emailStatus).toBe("complained");
  });

  it("una entrega NO toca `people` — solo el contacto roto se marca", async () => {
    await aplicarEventoDeCorreo(db, evento("email.delivered"));
    expect((await db.collection("people").doc("persona-1").get()).data()?.emailStatus).toBeUndefined();
  });

  /**
   * **Un id desconocido no crea nada.** Puede ser un correo enviado con la bandera apagada, o de
   * otro ambiente que comparta proveedor. Inventarle una fila metería un documento sin `tenantId`
   * en una colección que alguien lee filtrando por conjunto: invisible para todos y contando en
   * los totales de nadie.
   */
  it("un id que no conocemos se ignora sin crear fila", async () => {
    expect(await aplicarEventoDeCorreo(db, evento("email.delivered", "resend-de-otro"))).toBe("desconocido");
    expect((await db.collection("emailDeliveries").get()).size).toBe(1);
  });

  it("un evento que no nos interesa no toca nada", async () => {
    expect(await aplicarEventoDeCorreo(db, evento("email.opened"))).toBe("evento-ignorado");
    expect((await db.collection("emailDeliveries").doc(MSG).get()).data()?.status).toBe("enviado");
  });

  it("un evento sin id se dice, en vez de reventar", async () => {
    expect(await aplicarEventoDeCorreo(db, { type: "email.delivered", data: {} })).toBe("sin-id");
  });
});
