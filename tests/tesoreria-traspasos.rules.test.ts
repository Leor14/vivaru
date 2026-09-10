import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/**
 * `PRD-V-FEAT-010` entrega 2a · las reglas de `treasuryTransfers`.
 * Cubre `CA13`, `CA15`, `CA16` y `CA18`, y el anular de `RN-06`.
 *
 * **Cada denegación va con su pareja positiva**: una prueba de denegación pasa
 * igual sin ninguna regla, así que sola no demuestra nada.
 */

let testEnv: RulesTestEnvironment;

const CONJUNTO = "tenant-tesoreria";
const OTRO = "tenant-ajeno";
const SUSPENDIDO = "tenant-suspendido";

const admin = () => testEnv.authenticatedContext("admin-1", { role: "tenant_admin" }).firestore();
const adminAjeno = () => testEnv.authenticatedContext("admin-2", { role: "tenant_admin" }).firestore();
const adminSuspendido = () => testEnv.authenticatedContext("admin-3", { role: "tenant_admin" }).firestore();
const residente = () => testEnv.authenticatedContext("residente-101", {}).firestore();

const traspaso = (extra: Record<string, unknown> = {}) => ({
  tenantId: CONJUNTO,
  fromAccountId: "cuenta-a",
  toAccountId: "cuenta-b",
  amount: 300_000,
  date: "2026-09-10",
  kind: "traspaso",
  status: "registrado",
  createdBy: "admin-1",
  updatedBy: "admin-1",
  ...extra,
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
    for (const [id, t] of [["cuenta-a", CONJUNTO], ["cuenta-b", CONJUNTO], ["cuenta-ajena", OTRO], ["cuenta-o2", OTRO], ["cuenta-s1", SUSPENDIDO], ["cuenta-s2", SUSPENDIDO]]) {
      await setDoc(doc(db, "bankAccounts", id), { tenantId: t, label: id, bankName: "Banco", active: true });
    }
    await setDoc(doc(db, "treasuryTransfers", "t-registrado"), traspaso());
    await setDoc(doc(db, "treasuryTransfers", "t-anulado"), traspaso({ status: "anulado", voidedBy: "admin-1" }));
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

describe("FEAT-010 · quién lee un traspaso", () => {
  it("el administrador de su conjunto lo lee, y consulta los de su conjunto", async () => {
    await assertSucceeds(getDoc(doc(admin(), "treasuryTransfers", "t-registrado")));
    await assertSucceeds(getDocs(query(collection(admin(), "treasuryTransfers"), where("tenantId", "==", CONJUNTO))));
  });

  it("`CA13` · el residente NO, ni suelto ni consultando", async () => {
    await assertFails(getDoc(doc(residente(), "treasuryTransfers", "t-registrado")));
    await assertFails(getDocs(query(collection(residente(), "treasuryTransfers"), where("tenantId", "==", CONJUNTO))));
  });

  it("el administrador de otro conjunto tampoco", () => assertFails(
    getDoc(doc(adminAjeno(), "treasuryTransfers", "t-registrado")),
  ));
});

describe("FEAT-010 · registrar un traspaso, y `CA15`", () => {
  const nuevo = (db: ReturnType<typeof admin>) => doc(db, "treasuryTransfers", "t-nuevo");

  it("el administrador registra un traspaso entre dos cuentas de su conjunto", () => assertSucceeds(
    setDoc(nuevo(admin()), traspaso()),
  ));

  it("`CA15` · NO con origen igual a destino", () => assertFails(
    setDoc(nuevo(admin()), traspaso({ toAccountId: "cuenta-a" })),
  ));

  it("`CA15` · NI con valor cero, negativo o que no es número", async () => {
    await assertFails(setDoc(nuevo(admin()), traspaso({ amount: 0 })));
    await assertFails(setDoc(nuevo(admin()), traspaso({ amount: -5 })));
    await assertFails(setDoc(nuevo(admin()), traspaso({ amount: "300000" })));
  });

  it("`CA15` · NI hacia una cuenta de OTRO conjunto", () => assertFails(
    setDoc(nuevo(admin()), traspaso({ toAccountId: "cuenta-ajena" })),
  ));

  it("NI desde una cuenta que no existe", () => assertFails(
    setDoc(nuevo(admin()), traspaso({ fromAccountId: "cuenta-fantasma" })),
  ));

  it("NI naciendo anulado, NI con un tipo de la caja chica (llega en la entrega 3)", async () => {
    await assertFails(setDoc(nuevo(admin()), traspaso({ status: "anulado" })));
    await assertFails(setDoc(nuevo(admin()), traspaso({ kind: "apertura" })));
  });

  it("NI con una fecha sin forma de fecha", () => assertFails(
    setDoc(nuevo(admin()), traspaso({ date: "10/09/2026" })),
  ));

  it("NI firmando como otra persona", () => assertFails(
    setDoc(nuevo(admin()), traspaso({ createdBy: "alguien-mas" })),
  ));

  it("`CA13` · el residente no registra, y el administrador ajeno tampoco en este conjunto", async () => {
    await assertFails(setDoc(nuevo(residente()), traspaso({ createdBy: "residente-101" })));
    await assertFails(setDoc(nuevo(adminAjeno()), traspaso({ createdBy: "admin-2" })));
  });

  it("`CA18` · un conjunto SUSPENDIDO no registra — y el mismo cuerpo en uno activo sí", async () => {
    await assertFails(setDoc(doc(adminSuspendido(), "treasuryTransfers", "t-s"), traspaso({
      tenantId: SUSPENDIDO, fromAccountId: "cuenta-s1", toAccountId: "cuenta-s2", createdBy: "admin-3",
    })));
    await assertSucceeds(setDoc(doc(adminAjeno(), "treasuryTransfers", "t-o"), traspaso({
      tenantId: OTRO, fromAccountId: "cuenta-ajena", toAccountId: "cuenta-o2", createdBy: "admin-2",
    })));
  });
});

describe("FEAT-010 · anular, y `CA16`: no se borra", () => {
  const anular = (extra: Record<string, unknown> = {}) => ({
    status: "anulado", voidedBy: "admin-1", voidedAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: "admin-1", ...extra,
  });
  const ref = (db: ReturnType<typeof admin>, id = "t-registrado") => doc(db, "treasuryTransfers", id);

  it("el administrador anula un traspaso registrado", () => assertSucceeds(
    updateDoc(ref(admin()), anular()),
  ));

  it("NO con un voidedBy ajeno, NI con la hora inventada", async () => {
    await assertFails(updateDoc(ref(admin()), anular({ voidedBy: "alguien-mas" })));
    await assertFails(updateDoc(ref(admin()), anular({ voidedAt: Timestamp.fromDate(new Date("2026-09-10T12:00:00Z")) })));
  });

  it("NO colando un cambio de valor al anular", () => assertFails(
    updateDoc(ref(admin()), anular({ amount: 1 })),
  ));

  it("NI editando un traspaso sin anularlo", () => assertFails(
    updateDoc(ref(admin()), { amount: 1, updatedBy: "admin-1" }),
  ));

  it("NI volviendo a registrar uno anulado, NI anulándolo otra vez", async () => {
    await assertFails(updateDoc(ref(admin(), "t-anulado"), { status: "registrado" }));
    await assertFails(updateDoc(ref(admin(), "t-anulado"), anular()));
  });

  it("el residente no anula", () => assertFails(
    updateDoc(ref(residente()), anular({ voidedBy: "residente-101", updatedBy: "residente-101" })),
  ));

  it("`CA16` · nadie lo borra, ni registrado ni anulado", async () => {
    await assertFails(deleteDoc(ref(admin())));
    await assertFails(deleteDoc(ref(admin(), "t-anulado")));
  });
});
