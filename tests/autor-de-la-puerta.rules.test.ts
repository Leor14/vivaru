import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { Timestamp, doc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, describe, it } from "vitest";

/**
 * **`L-29` — quién registró cada entrada y salida en la puerta.**
 *
 * Lote «Análisis de la plataforma», T4.3 del plan. Ella pidió «medir al guarda responsable de cada
 * gestión» y el pase no guardaba autor: medido el 17 sep 2026, **309 ingresos y 301 salidas en
 * producción sin autor** (299 y 293 en staging), y ninguna pantalla lo enseñaba.
 *
 * **El campo lo escribe el cliente, así que la regla es lo único que lo hace fiable:** exige que el
 * autor sea quien firma la petición. Sin eso, `checkInBy` sería un texto que el guardia elige —el
 * defecto de `FIX-004`: un campo escribible no sostiene un invariante—. Y lo exige PRESENTE, que es
 * lo que la vuelve una restricción: el front que lo escribe va antes que esta regla.
 */

let testEnv: RulesTestEnvironment;

const T = "tenant-autor";
const GUARDIA = "guard-autor";
const OTRO_GUARDIA = "guard-autor-2";

const pase = (extra: Record<string, unknown>) => ({
  tenantId: T,
  unitId: "unit-autor-101",
  unitLabel: "T1-101",
  visitorName: "Rosa Pérez",
  qrCodeValue: "QR-AUTOR",
  tower: "T1",
  unit: "101",
  date: "2026-09-01",
  scheduledTime: "08:00",
  checkOutAt: null,
  createdBy: "admin-autor",
  ...extra,
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "hogaru-1-test",
    firestore: {
      rules: fs.readFileSync(path.resolve("firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "tenants", T), { name: "Conjunto Autor", status: "active", currency: "COP" });
    for (const uid of [GUARDIA, OTRO_GUARDIA]) {
      await setDoc(doc(db, "tenantUsers", `${T}_${uid}`), {
        uid,
        tenantId: T,
        role: "security_guard",
        status: "active",
        email: `${uid}@hogaru.test`,
      });
    }
    for (const id of ["entra-propio", "entra-ajeno", "entra-sin-autor"]) {
      await setDoc(doc(db, "visitorPasses", id), pase({ status: "scheduled", checkInAt: null }));
    }
    for (const id of ["sale-propio", "sale-ajeno", "sale-sin-autor"]) {
      await setDoc(
        doc(db, "visitorPasses", id),
        pase({
          status: "inside",
          checkInAt: Timestamp.fromDate(new Date("2026-09-17T13:00:00Z")),
          checkInBy: GUARDIA,
        }),
      );
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

const guardia = (uid: string) =>
  testEnv.authenticatedContext(uid, { role: "security_guard", tenantId: T }).firestore();

const ahora = Timestamp.fromDate(new Date("2026-09-17T14:00:00Z"));

describe("L-29 · el autor de la entrada", () => {
  it("el guarda registra el ingreso firmándolo con su propio uid", async () => {
    await assertSucceeds(
      updateDoc(doc(guardia(GUARDIA), "visitorPasses", "entra-propio"), {
        status: "inside",
        checkInAt: ahora,
        checkInBy: GUARDIA,
      }),
    );
  });

  it("no puede atribuírselo a OTRO guarda", async () => {
    await assertFails(
      updateDoc(doc(guardia(GUARDIA), "visitorPasses", "entra-ajeno"), {
        status: "inside",
        checkInAt: ahora,
        checkInBy: OTRO_GUARDIA,
      }),
    );
  });

  it("y sin autor no entra: es lo que convierte la regla en garantía", async () => {
    await assertFails(
      updateDoc(doc(guardia(GUARDIA), "visitorPasses", "entra-sin-autor"), {
        status: "inside",
        checkInAt: ahora,
      }),
    );
  });
});

describe("L-29 · el autor de la salida", () => {
  it("el guarda registra la salida con su propio uid", async () => {
    await assertSucceeds(
      updateDoc(doc(guardia(GUARDIA), "visitorPasses", "sale-propio"), {
        status: "completed",
        checkOutAt: ahora,
        checkOutBy: GUARDIA,
      }),
    );
  });

  it("no puede firmarla como otro, aunque sea de su mismo conjunto", async () => {
    await assertFails(
      updateDoc(doc(guardia(GUARDIA), "visitorPasses", "sale-ajeno"), {
        status: "completed",
        checkOutAt: ahora,
        checkOutBy: OTRO_GUARDIA,
      }),
    );
  });

  it("y sin autor no sale", async () => {
    await assertFails(
      updateDoc(doc(guardia(GUARDIA), "visitorPasses", "sale-sin-autor"), {
        status: "completed",
        checkOutAt: ahora,
      }),
    );
  });
});
