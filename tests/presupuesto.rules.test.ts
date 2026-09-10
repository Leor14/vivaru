import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/**
 * `PRD-V-FEAT-009` entrega 1 · las reglas de `budgets`.
 * Cubre `CA12`, `CA13`, `CA14`, `CA15`, `CA16` y `CA18`.
 *
 * **Cada denegación va con su pareja positiva.** Una prueba de denegación pasa
 * igual sin ninguna regla —la satisface el deny por defecto—, así que sola no
 * demuestra nada: lo que demuestra que la regla existe es que lo permitido
 * SIGUE permitido.
 */

let testEnv: RulesTestEnvironment;

const CONJUNTO = "tenant-presupuesto";
const OTRO = "tenant-ajeno";
const SUSPENDIDO = "tenant-suspendido";

const admin = () => testEnv.authenticatedContext("admin-1", { role: "tenant_admin" }).firestore();
const adminAjeno = () => testEnv.authenticatedContext("admin-2", { role: "tenant_admin" }).firestore();
const adminSuspendido = () => testEnv.authenticatedContext("admin-3", { role: "tenant_admin" }).firestore();
const residente = () => testEnv.authenticatedContext("residente-101", {}).firestore();

const borrador = (tenantId: string, year: number, uid = "admin-1") => ({
  tenantId, year, status: "borrador",
  lines: [{ accountCode: "2.3", amount: 1_200_000 }],
  createdBy: uid, updatedBy: uid,
});

async function sembrar() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "tenants", CONJUNTO), { status: "active" });
    await setDoc(doc(db, "tenants", OTRO), { status: "active" });
    await setDoc(doc(db, "tenants", SUSPENDIDO), { status: "suspended" });

    const gente: Array<[string, string, string, string]> = [
      [CONJUNTO, "admin-1", "tenant_admin", "u-000"],
      [OTRO, "admin-2", "tenant_admin", "u-000"],
      [SUSPENDIDO, "admin-3", "tenant_admin", "u-000"],
      [CONJUNTO, "residente-101", "resident", "u-101"],
    ];
    for (const [t, uid, role, unitId] of gente) {
      await setDoc(doc(db, "tenantUsers", `${t}_${uid}`), {
        uid, tenantId: t, role, status: "active", unitId,
        fullName: "N", email: `${uid}@ejemplo.vivaru.app`, unitLabel: "APTO",
      });
    }

    await setDoc(doc(db, "budgets", `${CONJUNTO}_2026`), borrador(CONJUNTO, 2026));
    // Sembrado con las reglas apagadas: en la entrega 1 no hay forma de aprobar
    // desde el cliente, pero el documento aprobado tiene que existir para probar
    // que NO se toca (`RN-04`).
    await setDoc(doc(db, "budgets", `${CONJUNTO}_2025`), {
      ...borrador(CONJUNTO, 2025), status: "aprobado", approvedAt: "2025-03-15", approvedBy: "admin-1",
    });
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "hogaru-1-test",
    firestore: { rules: fs.readFileSync(path.resolve("firestore.rules"), "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(async () => { await testEnv.cleanup(); });
beforeEach(async () => { await sembrar(); });

describe("FEAT-009 · quién lee el presupuesto", () => {
  it("el administrador de su conjunto lo lee", () => assertSucceeds(
    getDoc(doc(admin(), "budgets", `${CONJUNTO}_2026`)),
  ));

  it("`CA12` · el residente NO", () => assertFails(
    getDoc(doc(residente(), "budgets", `${CONJUNTO}_2026`)),
  ));

  it("`CA13` · el administrador de OTRO conjunto tampoco", () => assertFails(
    getDoc(doc(adminAjeno(), "budgets", `${CONJUNTO}_2026`)),
  ));

  it("la consulta por conjunto: sí para su administrador, no para el residente", async () => {
    await assertSucceeds(getDocs(query(collection(admin(), "budgets"), where("tenantId", "==", CONJUNTO))));
    await assertFails(getDocs(query(collection(residente(), "budgets"), where("tenantId", "==", CONJUNTO))));
  });

  it("un año que aún no existe se puede escuchar — la pantalla lo hace antes de crearlo", () => assertSucceeds(
    getDoc(doc(admin(), "budgets", `${CONJUNTO}_2027`)),
  ));
});

describe("FEAT-009 · crear", () => {
  it("el administrador crea el borrador de un año nuevo", () => assertSucceeds(
    setDoc(doc(admin(), "budgets", `${CONJUNTO}_2027`), borrador(CONJUNTO, 2027)),
  ));

  it("`CA15` · NO lo crea directamente aprobado", () => assertFails(
    setDoc(doc(admin(), "budgets", `${CONJUNTO}_2027`), { ...borrador(CONJUNTO, 2027), status: "aprobado" }),
  ));

  it("`CA16` · NO con el id de otro conjunto", () => assertFails(
    setDoc(doc(admin(), "budgets", `${OTRO}_2027`), borrador(CONJUNTO, 2027)),
  ));

  it("`CA16` · NI con el id de otro año", () => assertFails(
    setDoc(doc(admin(), "budgets", `${CONJUNTO}_2028`), borrador(CONJUNTO, 2027)),
  ));

  it("`CA13` · NI en otro conjunto con su propio id", () => assertFails(
    setDoc(doc(admin(), "budgets", `${OTRO}_2027`), borrador(OTRO, 2027)),
  ));

  it("NO firmando como otra persona", () => assertFails(
    setDoc(doc(admin(), "budgets", `${CONJUNTO}_2027`), borrador(CONJUNTO, 2027, "alguien-mas")),
  ));

  it("NO con las líneas en un mapa en vez de un array", () => assertFails(
    setDoc(doc(admin(), "budgets", `${CONJUNTO}_2027`), { ...borrador(CONJUNTO, 2027), lines: { "2.3": 5 } }),
  ));

  it("`CA18` · un conjunto SUSPENDIDO no crea — y el mismo cuerpo en uno activo sí", async () => {
    await assertFails(setDoc(doc(adminSuspendido(), "budgets", `${SUSPENDIDO}_2027`), borrador(SUSPENDIDO, 2027, "admin-3")));
    await assertSucceeds(setDoc(doc(adminAjeno(), "budgets", `${OTRO}_2027`), borrador(OTRO, 2027, "admin-2")));
  });

  it("el residente no crea", () => assertFails(
    setDoc(doc(residente(), "budgets", `${CONJUNTO}_2027`), borrador(CONJUNTO, 2027, "residente-101")),
  ));
});

describe("FEAT-009 · editar, y `RN-04`: lo aprobado no se toca", () => {
  it("el borrador se edita, con el documento entero", () => assertSucceeds(
    setDoc(doc(admin(), "budgets", `${CONJUNTO}_2026`), {
      ...borrador(CONJUNTO, 2026), lines: [{ accountCode: "2.3", amount: 900_000 }],
    }),
  ));

  it("`CA14` · las líneas de un APROBADO no se cambian", () => assertFails(
    setDoc(doc(admin(), "budgets", `${CONJUNTO}_2025`), {
      ...borrador(CONJUNTO, 2025), lines: [{ accountCode: "2.3", amount: 1 }],
    }),
  ));

  it("`CA14` · ni se devuelve a borrador", () => assertFails(
    setDoc(doc(admin(), "budgets", `${CONJUNTO}_2025`), borrador(CONJUNTO, 2025)),
  ));

  it("la aprobación no existe aún desde el cliente: un borrador no pasa a aprobado", () => assertFails(
    setDoc(doc(admin(), "budgets", `${CONJUNTO}_2026`), { ...borrador(CONJUNTO, 2026), status: "aprobado" }),
  ));

  it("NO se muda de conjunto al editar", () => assertFails(
    setDoc(doc(admin(), "budgets", `${CONJUNTO}_2026`), borrador(OTRO, 2026)),
  ));

  it("`CA13` · el administrador ajeno no edita", () => assertFails(
    setDoc(doc(adminAjeno(), "budgets", `${CONJUNTO}_2026`), borrador(CONJUNTO, 2026, "admin-2")),
  ));

  it("el borrador se borra; el aprobado no", async () => {
    await assertSucceeds(deleteDoc(doc(admin(), "budgets", `${CONJUNTO}_2026`)));
    await assertFails(deleteDoc(doc(admin(), "budgets", `${CONJUNTO}_2025`)));
  });
});
