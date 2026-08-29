import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { Timestamp, deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, describe, it } from "vitest";

/**
 * Reglas de `pushTokens` (PRD-V-PLAT-005 §7.2).
 *
 * El patrón probado es el REAL del cliente: `setDoc` con el token como id de
 * documento, que es exactamente lo que hace el registro. Re-registrar es un
 * `setDoc` sobre documento existente —un update—, y R4 exige que un teléfono
 * prestado pueda reclamarse: por eso update comparte condición con create.
 */

let testEnv: RulesTestEnvironment;

// Tokens FCM de mentira: largos e inadivinables como los reales.
const TOKEN_A = "push-tok-residente-a-9f3k2m8x71";
const TOKEN_B = "push-tok-residente-b-2c7q5w1z44";

const docToken = (uid: string, tenantId: string) => ({
  userId: uid,
  tenantId,
  createdAt: Timestamp.now(),
  platform: "android",
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

  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "tenantUsers", "tenant-push-a_res-push-1"), {
      uid: "res-push-1",
      tenantId: "tenant-push-a",
      role: "resident",
      status: "active",
      email: "res-push-1@hogaru.test",
      unitId: "unit-push-1",
      unitLabel: "T1-101",
    });
    await setDoc(doc(db, "tenantUsers", "tenant-push-a_res-push-2"), {
      uid: "res-push-2",
      tenantId: "tenant-push-a",
      role: "resident",
      status: "active",
      email: "res-push-2@hogaru.test",
      unitId: "unit-push-2",
      unitLabel: "T1-102",
    });
    // res-push-1 NO es miembro de tenant-push-b: sirve para el caso cruzado.
    await setDoc(doc(db, "tenantUsers", "tenant-push-b_res-push-3"), {
      uid: "res-push-3",
      tenantId: "tenant-push-b",
      role: "resident",
      status: "active",
      email: "res-push-3@hogaru.test",
      unitId: "unit-push-3",
      unitLabel: "B1-101",
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("pushTokens — crear (el registro del dispositivo)", () => {
  it("el residente registra su propio token en su conjunto", async () => {
    const db = testEnv.authenticatedContext("res-push-1").firestore();
    await assertSucceeds(
      setDoc(doc(db, "pushTokens", TOKEN_A), docToken("res-push-1", "tenant-push-a")),
    );
  });

  it("CA4 · no puede crear un token con userId AJENO", async () => {
    const db = testEnv.authenticatedContext("res-push-2").firestore();
    await assertFails(
      setDoc(doc(db, "pushTokens", "tok-suplantado-1"), docToken("res-push-1", "tenant-push-a")),
    );
  });

  it("CA4 · no puede crear un token con tenantId de un conjunto del que no es miembro", async () => {
    const db = testEnv.authenticatedContext("res-push-1").firestore();
    await assertFails(
      setDoc(doc(db, "pushTokens", "tok-cruzado-1"), docToken("res-push-1", "tenant-push-b")),
    );
  });

  it("sin tenantId se rechaza (invariante de la casa)", async () => {
    const db = testEnv.authenticatedContext("res-push-1").firestore();
    await assertFails(
      setDoc(doc(db, "pushTokens", "tok-sin-tenant-1"), {
        userId: "res-push-1",
        createdAt: Timestamp.now(),
      }),
    );
  });

  it("sin sesión se rechaza", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, "pushTokens", "tok-anonimo-1"), docToken("res-push-1", "tenant-push-a")),
    );
  });
});

describe("pushTokens — re-registro y el teléfono prestado (R4)", () => {
  it("CA6 · re-registrar el mismo token es un update y pasa (idempotencia del setDoc)", async () => {
    const db = testEnv.authenticatedContext("res-push-1").firestore();
    await assertSucceeds(
      setDoc(doc(db, "pushTokens", TOKEN_A), docToken("res-push-1", "tenant-push-a")),
    );
  });

  it("R4 · otra sesión en el mismo dispositivo RECLAMA el token con su propio uid", async () => {
    const db = testEnv.authenticatedContext("res-push-2").firestore();
    await assertSucceeds(
      setDoc(doc(db, "pushTokens", TOKEN_A), docToken("res-push-2", "tenant-push-a")),
    );
  });

  it("pero nadie puede escribir un token declarando el uid de OTRO", async () => {
    const db = testEnv.authenticatedContext("res-push-2").firestore();
    await assertFails(
      setDoc(doc(db, "pushTokens", TOKEN_A), docToken("res-push-1", "tenant-push-a")),
    );
  });
});

describe("pushTokens — leer y borrar (solo el dueño)", () => {
  it("el dueño lee su token", async () => {
    // TOKEN_A quedó a nombre de res-push-2 tras el caso R4 de arriba.
    const db = testEnv.authenticatedContext("res-push-2").firestore();
    await assertSucceeds(getDoc(doc(db, "pushTokens", TOKEN_A)));
  });

  it("otro usuario del MISMO conjunto no lo lee", async () => {
    const db = testEnv.authenticatedContext("res-push-1").firestore();
    await assertFails(getDoc(doc(db, "pushTokens", TOKEN_A)));
  });

  it("el dueño da de baja su dispositivo (CA9)", async () => {
    const db = testEnv.authenticatedContext("res-push-2").firestore();
    await assertSucceeds(deleteDoc(doc(db, "pushTokens", TOKEN_A)));
  });

  it("nadie borra el dispositivo de otro", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "pushTokens", TOKEN_B),
        docToken("res-push-2", "tenant-push-a"),
      );
    });
    const db = testEnv.authenticatedContext("res-push-1").firestore();
    await assertFails(deleteDoc(doc(db, "pushTokens", TOKEN_B)));
  });

  it("el tenant_admin tampoco: las credenciales de entrega no son del conjunto", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "tenantUsers", "tenant-push-a_admin-push-1"), {
        uid: "admin-push-1",
        tenantId: "tenant-push-a",
        role: "tenant_admin",
        status: "active",
        email: "admin-push-1@hogaru.test",
        unitId: "unit-admin-push",
        unitLabel: "ADMIN",
      });
    });
    const db = testEnv.authenticatedContext("admin-push-1").firestore();
    await assertFails(getDoc(doc(db, "pushTokens", TOKEN_B)));
    await assertFails(deleteDoc(doc(db, "pushTokens", TOKEN_B)));
  });
});
