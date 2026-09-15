import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * **`D-2` — el aviso de un comunicado dirigido llega a TODOS los residentes.**
 *
 * Lote «Análisis de la plataforma», reproducción de la fase 1 del plan (T1.1).
 * `onCommunicationCreated` toma los destinatarios de `listTenantUidsByRoles(tenantId,
 * ["resident"])` y no mira `audienceUnitIds`: el residente de otra unidad recibe el aviso con el
 * TÍTULO del comunicado. Es el gemelo de `D-2b` (la lectura), del lado del servidor.
 *
 * El disparador se invoca con `.run(event)`, que expone `firebase-functions` v7, sobre el emulador
 * de Firestore y sin tocar el código del producto. **La prueba del defecto va con `it.fails`**;
 * la de control comprueba que un comunicado general sí avisa a los dos, para que un «nadie recibe
 * nada» no pase por arreglo.
 *
 * Necesita el emulador:
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const T = "conjunto-avisos-audiencia";

let db: Firestore;
let onCommunicationCreated: { run: (event: unknown) => unknown };

beforeAll(async () => {
  // `src/index.ts` inicializa la app al importarse: por eso se importa aquí, con el
  // emulador ya apuntado.
  ({ onCommunicationCreated } = (await import("../src/index")) as unknown as {
    onCommunicationCreated: { run: (event: unknown) => unknown };
  });
  db = getFirestore();
});

async function limpiar(col: string) {
  const snap = await db.collection(col).where("tenantId", "==", T).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

beforeEach(async () => {
  await limpiar("notifications");
  await limpiar("tenantUsers");
  for (const [uid, unitId] of [
    ["res-aviso-a", "unit-aviso-a"],
    ["res-aviso-b", "unit-aviso-b"],
  ] as const) {
    await db.collection("tenantUsers").doc(`${T}_${uid}`).set({
      uid,
      tenantId: T,
      role: "resident",
      status: "active",
      unitId,
    });
  }
});

async function publicar(id: string, datos: Record<string, unknown>) {
  await onCommunicationCreated.run({
    params: { communicationId: id },
    data: { id, data: () => ({ tenantId: T, status: "published", ...datos }) },
  });
}

async function destinatarios(): Promise<string[]> {
  const snap = await db.collection("notifications").where("tenantId", "==", T).get();
  return snap.docs
    .filter((d) => d.data().type === "communication")
    .map((d) => String(d.data().userId))
    .sort();
}

describe("D-2 · el aviso de un comunicado llega solo a su audiencia", () => {
  it("control: un comunicado general avisa a todos los residentes", async () => {
    await publicar("com-general", { title: "Corte de agua", audience: "all", audienceUnitIds: [] });
    expect(await destinatarios()).toEqual(["res-aviso-a", "res-aviso-b"]);
  });

  it.fails("DEFECTO D-2: un comunicado dirigido a la unidad A solo avisa a su residente", async () => {
    await publicar("com-dirigido", {
      title: "Aviso de cartera — Saldo pendiente",
      audience: "towers",
      audienceUnitIds: ["unit-aviso-a"],
    });
    expect(await destinatarios()).toEqual(["res-aviso-a"]);
  });
});
