import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { Timestamp, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, describe, it } from "vitest";

/**
 * **`L-14` — un comunicado no se borra: se archiva** (fase 7, bloque 3, 20 sep 2026).
 *
 * Decisión de David: «se conserva todo». La pantalla ya archiva, pero **una costumbre del front no
 * es un invariante**: mientras la regla dejara borrar, el `deleteDoc` seguía a una línea de
 * distancia y con él se irían el texto, los adjuntos y el sentido de las lecturas de
 * `communicationReads`, que quedarían huérfanas.
 *
 * El superadministrador conserva el borrado: es quien atiende una supresión de datos.
 */

let testEnv: RulesTestEnvironment;

const T = "tenant-archivar";
const ADMIN = "admin-archivar";
const RESIDENTE = "residente-archivar";

const comunicado = {
  tenantId: T,
  title: "Corte de agua",
  message: "Mañana de 8 a 12.",
  status: "published",
  audience: "all",
  createdBy: ADMIN,
  createdAt: Timestamp.now(),
};

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
    await setDoc(doc(db, "tenants", T), { name: "Conjunto Archivar", status: "active", currency: "COP" });
    await setDoc(doc(db, "tenantUsers", `${T}_${ADMIN}`), {
      uid: ADMIN,
      tenantId: T,
      role: "tenant_admin",
      status: "active",
      email: `${ADMIN}@hogaru.test`,
    });
    await setDoc(doc(db, "tenantUsers", `${T}_${RESIDENTE}`), {
      uid: RESIDENTE,
      tenantId: T,
      role: "resident",
      status: "active",
      unitId: "unit-arch-1",
      email: `${RESIDENTE}@hogaru.test`,
    });
    for (const id of ["a-archivar", "a-borrar-admin", "a-borrar-super", "a-borrar-residente"]) {
      await setDoc(doc(db, "communications", id), comunicado);
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

const admin = () => testEnv.authenticatedContext(ADMIN, { role: "tenant_admin", tenantId: T }).firestore();
const residente = () => testEnv.authenticatedContext(RESIDENTE, { role: "resident", tenantId: T }).firestore();
const superadmin = () => testEnv.authenticatedContext("super-1", { role: "superadmin" }).firestore();

describe("L-14 · el comunicado se archiva", () => {
  it("la administración puede archivarlo, con su autor y su fecha", async () => {
    await assertSucceeds(
      updateDoc(doc(admin(), "communications", "a-archivar"), {
        status: "archived",
        archivedAt: serverTimestamp(),
        archivedBy: ADMIN,
      }),
    );
  });

  it("NO puede borrarlo", async () => {
    await assertFails(deleteDoc(doc(admin(), "communications", "a-borrar-admin")));
  });

  it("y el residente tampoco, como siempre", async () => {
    await assertFails(deleteDoc(doc(residente(), "communications", "a-borrar-residente")));
  });

  it("el superadministrador sí: es la vía de una supresión de datos", async () => {
    await assertSucceeds(deleteDoc(doc(superadmin(), "communications", "a-borrar-super")));
  });
});
