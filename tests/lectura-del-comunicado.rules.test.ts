import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, describe, it } from "vitest";

/**
 * **`L-13` — quién vio un comunicado, y que el número se pueda citar.**
 *
 * Lote «Análisis de la plataforma», pág. 5. Lo escribe el residente, así que **la regla es lo único
 * que sostiene el conteo**: sin exigir que el id sea `{communicationId}_{uid}` y que el `uid` sea el
 * de quien escribe, cualquier residente podría fabricar lecturas ajenas —o cien de sí mismo con
 * ids distintos— y el número que la administración lee no significaría nada.
 *
 * Y **nadie borra**: un contador que se puede limpiar tampoco se puede citar.
 */

let testEnv: RulesTestEnvironment;

const T = "tenant-lecturas";
const OTRO = "tenant-lecturas-otro";

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
    for (const [tenant, uid, role] of [
      [T, "res-lec-a", "resident"],
      [T, "res-lec-b", "resident"],
      [T, "admin-lec", "tenant_admin"],
      [OTRO, "admin-lec-otro", "tenant_admin"],
    ] as const) {
      await setDoc(doc(db, "tenantUsers", `${tenant}_${uid}`), {
        uid,
        tenantId: tenant,
        role,
        status: "active",
        email: `${uid}@hogaru.test`,
        ...(role === "resident" ? { unitId: `unit-${uid}` } : {}),
      });
    }
    for (const tenant of [T, OTRO]) {
      await setDoc(doc(db, "tenants", tenant), { name: tenant, status: "active", currency: "COP" });
    }
    // Una lectura ya anotada, para probar la segunda pasada y la lectura ajena.
    await setDoc(doc(db, "communicationReads", "com-1_res-lec-a"), {
      tenantId: T,
      communicationId: "com-1",
      uid: "res-lec-a",
      name: "Ana",
      seenAt: new Date(),
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

const residente = (uid: string) => testEnv.authenticatedContext(uid, { role: "resident", tenantId: T }).firestore();
const adminDe = (tenant: string, uid: string) =>
  testEnv.authenticatedContext(uid, { role: "tenant_admin", tenantId: tenant }).firestore();
const lectura = (tenantId: string, communicationId: string, uid: string, extra: Record<string, unknown> = {}) => ({
  tenantId,
  communicationId,
  uid,
  seenAt: new Date(),
  ...extra,
});

describe("L-13 · anotar que vi un comunicado", () => {
  it("un residente anota SU lectura, con el id que la regla exige", async () => {
    const db = residente("res-lec-b");
    await assertSucceeds(
      setDoc(doc(db, "communicationReads", "com-2_res-lec-b"), lectura(T, "com-2", "res-lec-b", { name: "Beto" })),
    );
  });

  it("volver a verlo vuelve a escribir el MISMO documento, así que nadie cuenta dos veces", async () => {
    const db = residente("res-lec-a");
    await assertSucceeds(
      setDoc(doc(db, "communicationReads", "com-1_res-lec-a"), lectura(T, "com-1", "res-lec-a", { name: "Ana" })),
    );
  });

  it("NO puede anotar la lectura de otra persona", async () => {
    const db = residente("res-lec-b");
    await assertFails(
      setDoc(doc(db, "communicationReads", "com-3_res-lec-a"), lectura(T, "com-3", "res-lec-a")),
    );
  });

  it("NO puede inflar el conteo con un id distinto del que manda la regla", async () => {
    const db = residente("res-lec-b");
    await assertFails(
      setDoc(doc(db, "communicationReads", "com-4_res-lec-b-otra-vez"), lectura(T, "com-4", "res-lec-b")),
    );
    await assertFails(
      setDoc(doc(db, "communicationReads", "com-5_res-lec-b"), lectura(T, "otro-comunicado", "res-lec-b")),
    );
  });

  it("NO puede meter campos que la lectura no lleva", async () => {
    const db = residente("res-lec-b");
    await assertFails(
      setDoc(
        doc(db, "communicationReads", "com-6_res-lec-b"),
        lectura(T, "com-6", "res-lec-b", { role: "tenant_admin" }),
      ),
    );
  });

  it("NO puede anotar en otro conjunto", async () => {
    const db = residente("res-lec-b");
    await assertFails(
      setDoc(doc(db, "communicationReads", "com-7_res-lec-b"), lectura(OTRO, "com-7", "res-lec-b")),
    );
  });

  it("un residente NO se apropia de la lectura de otro en una segunda pasada", async () => {
    const db = residente("res-lec-b");
    await assertFails(
      setDoc(doc(db, "communicationReads", "com-1_res-lec-a"), lectura(T, "com-1", "res-lec-b")),
    );
  });
});

describe("L-13 · quién puede contar", () => {
  it("la administración del conjunto consulta las lecturas", async () => {
    const db = adminDe(T, "admin-lec");
    await assertSucceeds(getDocs(query(collection(db, "communicationReads"), where("tenantId", "==", T))));
  });

  it("la administración de OTRO conjunto no las ve", async () => {
    const db = adminDe(OTRO, "admin-lec-otro");
    await assertFails(getDoc(doc(db, "communicationReads", "com-1_res-lec-a")));
    await assertFails(getDocs(query(collection(db, "communicationReads"), where("tenantId", "==", T))));
  });

  it("cada residente ve la suya y no la del vecino", async () => {
    await assertSucceeds(getDoc(doc(residente("res-lec-a"), "communicationReads", "com-1_res-lec-a")));
    await assertFails(getDoc(doc(residente("res-lec-b"), "communicationReads", "com-1_res-lec-a")));
  });

  it("NADIE borra una lectura, tampoco la administración", async () => {
    await assertFails(deleteDoc(doc(residente("res-lec-a"), "communicationReads", "com-1_res-lec-a")));
    await assertFails(deleteDoc(doc(adminDe(T, "admin-lec"), "communicationReads", "com-1_res-lec-a")));
  });
});
