import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/**
 * `PRD-V-FEAT-010` entrega 3 · las reglas de la caja chica: `pettyCashFunds` y
 * los traspasos con nombre —apertura, reposición, cierre—.
 * Cubre `CA13` para la caja, `CA18`, el cierre de §6 y la forma de cada nombre:
 * `traspaso` va de banco a banco; `apertura` y `reposicion`, de banco a caja
 * abierta; `cierre`, de caja abierta a banco.
 *
 * **Cada denegación va con su pareja positiva**: una prueba de denegación pasa
 * igual sin ninguna regla, así que sola no demuestra nada.
 */

let testEnv: RulesTestEnvironment;

const CONJUNTO = "tenant-caja";
const OTRO = "tenant-ajeno";
const SUSPENDIDO = "tenant-suspendido";

const admin = () => testEnv.authenticatedContext("admin-1", { role: "tenant_admin" }).firestore();
const adminAjeno = () => testEnv.authenticatedContext("admin-2", { role: "tenant_admin" }).firestore();
const adminSuspendido = () => testEnv.authenticatedContext("admin-3", { role: "tenant_admin" }).firestore();
const residente = () => testEnv.authenticatedContext("residente-101", {}).firestore();

const caja = (extra: Record<string, unknown> = {}) => ({
  tenantId: CONJUNTO,
  name: "Caja de portería",
  limit: 500_000,
  sourceAccountId: "banco-a",
  status: "abierta",
  createdBy: "admin-1",
  updatedBy: "admin-1",
  ...extra,
});

const movimiento = (kind: string, fromAccountId: string, toAccountId: string, extra: Record<string, unknown> = {}) => ({
  tenantId: CONJUNTO,
  fromAccountId,
  toAccountId,
  amount: 100_000,
  date: "2026-09-10",
  kind,
  status: "registrado",
  createdBy: "admin-1",
  updatedBy: "admin-1",
  ...extra,
});

const cierre = (extra: Record<string, unknown> = {}) => ({
  status: "cerrada",
  closedAt: serverTimestamp(),
  closedBy: "admin-1",
  updatedAt: serverTimestamp(),
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
    for (const [id, t] of [["banco-a", CONJUNTO], ["banco-b", CONJUNTO], ["banco-ajeno", OTRO], ["banco-s", SUSPENDIDO]]) {
      await setDoc(doc(db, "bankAccounts", id), { tenantId: t, label: id, bankName: "Banco", active: true });
    }
    await setDoc(doc(db, "pettyCashFunds", "caja-abierta"), caja());
    await setDoc(doc(db, "pettyCashFunds", "caja-dos"), caja({ name: "Caja del salón" }));
    await setDoc(doc(db, "pettyCashFunds", "caja-cerrada"), caja({ status: "cerrada", closedBy: "admin-1" }));
    await setDoc(doc(db, "pettyCashFunds", "caja-ajena"), caja({ tenantId: OTRO, sourceAccountId: "banco-ajeno", createdBy: "admin-2" }));
    await setDoc(doc(db, "pettyCashFunds", "caja-suspendida"), caja({ tenantId: SUSPENDIDO, sourceAccountId: "banco-s", createdBy: "admin-3" }));
    await setDoc(doc(db, "treasuryTransfers", "m-reposicion"), movimiento("reposicion", "banco-a", "caja-abierta"));
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

describe("FEAT-010 · quién lee una caja chica", () => {
  it("el administrador de su conjunto la lee, y consulta las de su conjunto", async () => {
    await assertSucceeds(getDoc(doc(admin(), "pettyCashFunds", "caja-abierta")));
    await assertSucceeds(getDocs(query(collection(admin(), "pettyCashFunds"), where("tenantId", "==", CONJUNTO))));
  });

  it("`CA13` · el residente NO, ni suelta ni consultando", async () => {
    await assertFails(getDoc(doc(residente(), "pettyCashFunds", "caja-abierta")));
    await assertFails(getDocs(query(collection(residente(), "pettyCashFunds"), where("tenantId", "==", CONJUNTO))));
  });

  it("el administrador de otro conjunto tampoco", () => assertFails(
    getDoc(doc(adminAjeno(), "pettyCashFunds", "caja-abierta")),
  ));
});

describe("FEAT-010 · abrir una caja chica, y `CA8`", () => {
  const nueva = (db: ReturnType<typeof admin>) => doc(db, "pettyCashFunds", "caja-nueva");

  it("`CA8` · la caja y su apertura, en el mismo lote", async () => {
    const db = admin();
    const lote = writeBatch(db);
    lote.set(nueva(db), caja());
    lote.set(doc(db, "treasuryTransfers", "m-apertura"), movimiento("apertura", "banco-a", "caja-nueva", { amount: 500_000 }));
    await assertSucceeds(lote.commit());
  });

  it("la apertura SIN la caja en el lote, hacia una caja que no existe → NO", () => assertFails(
    setDoc(doc(admin(), "treasuryTransfers", "m-x"), movimiento("apertura", "banco-a", "caja-nueva")),
  ));

  it("la caja sola también nace: la apertura puede llegar después", () => assertSucceeds(
    setDoc(nueva(admin()), caja()),
  ));

  it("NO naciendo cerrada, NI sin nombre, NI con un límite que no es mayor que cero", async () => {
    await assertFails(setDoc(nueva(admin()), caja({ status: "cerrada" })));
    await assertFails(setDoc(nueva(admin()), caja({ name: "" })));
    await assertFails(setDoc(nueva(admin()), caja({ name: 7 })));
    // Una lista tiene `size()`: sin `is string`, un nombre `["Caja"]` entraría.
    await assertFails(setDoc(nueva(admin()), caja({ name: ["Caja"] })));
    await assertFails(setDoc(nueva(admin()), caja({ limit: 0 })));
    await assertFails(setDoc(nueva(admin()), caja({ limit: -1 })));
    await assertFails(setDoc(nueva(admin()), caja({ limit: "500000" })));
  });

  it("NI saliendo de una cuenta de OTRO conjunto, NI de una que no existe", async () => {
    await assertFails(setDoc(nueva(admin()), caja({ sourceAccountId: "banco-ajeno" })));
    await assertFails(setDoc(nueva(admin()), caja({ sourceAccountId: "banco-inventado" })));
  });

  it("NI firmando como otra persona", () => assertFails(
    setDoc(nueva(admin()), caja({ createdBy: "admin-2" })),
  ));

  it("`CA13` · el residente no la abre, y el administrador ajeno tampoco en este conjunto", async () => {
    await assertFails(setDoc(nueva(residente()), caja({ createdBy: "residente-101" })));
    await assertFails(setDoc(nueva(adminAjeno()), caja({ createdBy: "admin-2" })));
  });

  it("`CA18` · un conjunto SUSPENDIDO no la abre — y el mismo cuerpo en uno activo sí", async () => {
    await assertFails(setDoc(doc(adminSuspendido(), "pettyCashFunds", "caja-s"), caja({
      tenantId: SUSPENDIDO, sourceAccountId: "banco-s", createdBy: "admin-3",
    })));
    await assertSucceeds(setDoc(doc(adminAjeno(), "pettyCashFunds", "caja-o"), caja({
      tenantId: OTRO, sourceAccountId: "banco-ajeno", createdBy: "admin-2",
    })));
  });

  it("NO abre una caja desde otra caja: la apertura sale de un banco", () => assertFails(
    setDoc(doc(admin(), "treasuryTransfers", "m-x"), movimiento("apertura", "caja-dos", "caja-abierta")),
  ));
});

describe("FEAT-010 · reponer, y la forma de cada nombre", () => {
  const nuevo = (db: ReturnType<typeof admin>) => doc(db, "treasuryTransfers", "m-nuevo");

  it("una reposición del banco a una caja abierta", () => assertSucceeds(
    setDoc(nuevo(admin()), movimiento("reposicion", "banco-a", "caja-abierta")),
  ));

  it("NO a una caja cerrada, NI a una de otro conjunto", async () => {
    await assertFails(setDoc(nuevo(admin()), movimiento("reposicion", "banco-a", "caja-cerrada")));
    await assertFails(setDoc(nuevo(admin()), movimiento("reposicion", "banco-a", "caja-ajena")));
  });

  it("NO entre dos bancos, NI desde una caja: reponer es de banco a caja", async () => {
    await assertFails(setDoc(nuevo(admin()), movimiento("reposicion", "banco-a", "banco-b")));
    await assertFails(setDoc(nuevo(admin()), movimiento("reposicion", "caja-dos", "caja-abierta")));
  });

  it("un `traspaso` sigue siendo de banco a banco — y NO lleva dinero a una caja", async () => {
    await assertSucceeds(setDoc(nuevo(admin()), movimiento("traspaso", "banco-a", "banco-b")));
    await assertFails(setDoc(doc(admin(), "treasuryTransfers", "m-otro"), movimiento("traspaso", "banco-a", "caja-abierta")));
  });

  it("NI con un nombre que no existe", () => assertFails(
    setDoc(nuevo(admin()), movimiento("vuelto", "banco-a", "caja-abierta")),
  ));

  it("el administrador anula una reposición, como cualquier traspaso", () => assertSucceeds(
    updateDoc(doc(admin(), "treasuryTransfers", "m-reposicion"), {
      status: "anulado", voidedAt: serverTimestamp(), voidedBy: "admin-1", updatedAt: serverTimestamp(), updatedBy: "admin-1",
    }),
  ));
});

describe("FEAT-010 · cerrar una caja (§6)", () => {
  const ref = (db: ReturnType<typeof admin>, id = "caja-abierta") => doc(db, "pettyCashFunds", id);

  it("con dinero dentro: la devolución y el cierre, en el mismo lote", async () => {
    const db = admin();
    const lote = writeBatch(db);
    lote.set(doc(db, "treasuryTransfers", "m-cierre"), movimiento("cierre", "caja-abierta", "banco-a"));
    lote.update(ref(db), cierre());
    await assertSucceeds(lote.commit());
  });

  it("en cero, se cierra sin devolver nada", () => assertSucceeds(updateDoc(ref(admin()), cierre())));

  it("NO colando un cambio de límite o de nombre al cerrar", async () => {
    await assertFails(updateDoc(ref(admin()), cierre({ limit: 900_000 })));
    await assertFails(updateDoc(ref(admin()), cierre({ name: "Otra" })));
  });

  it("NI editando una caja sin cerrarla", () => assertFails(
    updateDoc(ref(admin()), { name: "Otra", updatedAt: serverTimestamp(), updatedBy: "admin-1" }),
  ));

  it("NO con un closedBy ajeno, NI con la hora inventada", async () => {
    await assertFails(updateDoc(ref(admin()), cierre({ closedBy: "admin-2" })));
    await assertFails(updateDoc(ref(admin()), cierre({ closedAt: Timestamp.fromDate(new Date("2026-01-01")) })));
  });

  it("NI reabriendo una cerrada, NI cerrándola otra vez", async () => {
    await assertFails(updateDoc(ref(admin(), "caja-cerrada"), { status: "abierta", updatedAt: serverTimestamp(), updatedBy: "admin-1" }));
    await assertFails(updateDoc(ref(admin(), "caja-cerrada"), cierre()));
  });

  it("NI dejándola abierta con fecha de cierre: cerrar es cambiar el estado", () => assertFails(
    updateDoc(ref(admin()), { closedAt: serverTimestamp(), closedBy: "admin-1", updatedAt: serverTimestamp(), updatedBy: "admin-1" }),
  ));

  it("`CA18` · un conjunto SUSPENDIDO no cierra su caja — y el mismo cuerpo en uno activo sí", async () => {
    await assertFails(updateDoc(doc(adminSuspendido(), "pettyCashFunds", "caja-suspendida"), cierre({ closedBy: "admin-3", updatedBy: "admin-3" })));
    await assertSucceeds(updateDoc(doc(adminAjeno(), "pettyCashFunds", "caja-ajena"), cierre({ closedBy: "admin-2", updatedBy: "admin-2" })));
  });

  it("el cierre NO sale de una caja cerrada, NI de una ajena, NI va a otra caja", async () => {
    await assertFails(setDoc(doc(admin(), "treasuryTransfers", "m-x"), movimiento("cierre", "caja-cerrada", "banco-a")));
    await assertFails(setDoc(doc(admin(), "treasuryTransfers", "m-y"), movimiento("cierre", "caja-ajena", "banco-a")));
    await assertFails(setDoc(doc(admin(), "treasuryTransfers", "m-z"), movimiento("cierre", "caja-abierta", "caja-dos")));
  });

  it("el residente no la cierra, y el administrador ajeno tampoco", async () => {
    await assertFails(updateDoc(ref(residente()), cierre({ closedBy: "residente-101", updatedBy: "residente-101" })));
    await assertFails(updateDoc(ref(adminAjeno()), cierre({ closedBy: "admin-2", updatedBy: "admin-2" })));
  });

  it("nadie la borra, ni abierta ni cerrada", async () => {
    await assertFails(deleteDoc(ref(admin())));
    await assertFails(deleteDoc(ref(admin(), "caja-cerrada")));
    await assertFails(deleteDoc(ref(residente())));
  });
});

/**
 * `PRD-V-FEAT-010` · la cuenta de un egreso o de un asiento que escribe el CLIENTE es del conjunto.
 *
 * El servidor ya la comprueba al pagar una cuota (`comprobarCuentaDeSalida`), pero «Sale de» y los
 * asientos manuales escriben directo, y la regla no miraba `bankAccountId`: un administrador podía
 * apuntar un gasto a la cuenta de OTRO conjunto, o a una que no existe, y la tesorería lo restaría de
 * ahí. Vale: ninguna, una cuenta bancaria del conjunto o una caja del conjunto. **En una edición solo
 * se mira si la cuenta CAMBIA**, y **el reverso puede copiar la del asiento que anula** aunque esa
 * cuenta ya se haya borrado —las reglas permiten borrar cuentas—. Medido antes de escribirla: 0
 * egresos y 0 asientos con una cuenta ajena o inexistente, en los dos ambientes.
 */
describe("FEAT-010 · la cuenta de un egreso o de un asiento es del conjunto", () => {
  const egreso = (bankAccountId: string | null, extra: Record<string, unknown> = {}) => ({
    tenantId: CONJUNTO,
    description: "Gasto de prueba",
    category: "mantenimiento",
    amount: 100_000,
    issueDate: "2026-09-10",
    status: "pagado",
    installments: null,
    bankAccountId,
    createdBy: "admin-1",
    updatedBy: "admin-1",
    ...extra,
  });
  const asiento = (bankAccountId: string | null, extra: Record<string, unknown> = {}) => ({
    tenantId: CONJUNTO,
    type: "egreso",
    date: "2026-09-10",
    amount: 100_000,
    concept: "Movimiento manual",
    sourceType: "manual",
    reconciled: false,
    bankAccountId,
    createdBy: "admin-1",
    updatedBy: "admin-1",
    ...extra,
  });

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "expenses", "egreso-a"), egreso("banco-a"));
      // Una cuenta que se BORRÓ después de usarse: nada lo impide.
      await setDoc(doc(db, "expenses", "egreso-cuenta-borrada"), egreso("cuenta-borrada"));
      await setDoc(doc(db, "ledgerEntries", "asiento-a"), asiento("banco-a"));
      await setDoc(doc(db, "ledgerEntries", "asiento-cuenta-borrada"), asiento("cuenta-borrada"));
    });
  });

  describe("un egreso", () => {
    it("nace con una cuenta del conjunto, con una caja del conjunto o sin cuenta", async () => {
      await assertSucceeds(setDoc(doc(admin(), "expenses", "e1"), egreso("banco-a")));
      await assertSucceeds(setDoc(doc(admin(), "expenses", "e2"), egreso("caja-abierta")));
      await assertSucceeds(setDoc(doc(admin(), "expenses", "e3"), egreso(null)));
    });

    it("NO nace con la cuenta ni la caja de OTRO conjunto, ni con una que no existe", async () => {
      await assertFails(setDoc(doc(admin(), "expenses", "e4"), egreso("banco-ajeno")));
      await assertFails(setDoc(doc(admin(), "expenses", "e5"), egreso("caja-ajena")));
      await assertFails(setDoc(doc(admin(), "expenses", "e6"), egreso("no-existe")));
    });

    it("al editarlo, cambiar a una cuenta ajena se rechaza; a otra del conjunto, no", async () => {
      await assertFails(updateDoc(doc(admin(), "expenses", "egreso-a"), { bankAccountId: "banco-ajeno" }));
      await assertSucceeds(updateDoc(doc(admin(), "expenses", "egreso-a"), { bankAccountId: "banco-b" }));
    });

    it("y un egreso viejo se edita aunque su cuenta ya no exista, si no la cambia", async () => {
      await assertSucceeds(updateDoc(doc(admin(), "expenses", "egreso-cuenta-borrada"), { description: "Corregido" }));
    });
  });

  describe("un asiento", () => {
    it("manual: con una cuenta o una caja del conjunto, o sin cuenta, sí", async () => {
      await assertSucceeds(setDoc(doc(admin(), "ledgerEntries", "l1"), asiento("banco-a")));
      await assertSucceeds(setDoc(doc(admin(), "ledgerEntries", "l2"), asiento("caja-abierta")));
      await assertSucceeds(setDoc(doc(admin(), "ledgerEntries", "l3"), asiento(null)));
    });

    it("manual: con la cuenta de OTRO conjunto o con una que no existe, no", async () => {
      await assertFails(setDoc(doc(admin(), "ledgerEntries", "l4"), asiento("banco-ajeno")));
      await assertFails(setDoc(doc(admin(), "ledgerEntries", "l5"), asiento("no-existe")));
    });

    it("el reverso copia la cuenta del asiento que anula, aunque esa cuenta ya se haya borrado", async () => {
      await assertSucceeds(setDoc(doc(admin(), "ledgerEntries", "r1"),
        asiento("cuenta-borrada", { sourceType: "reversal", sourceId: "asiento-cuenta-borrada", amount: -100_000 })));
    });

    it("pero un «reverso» no sirve de puerta para apuntar a otra cuenta", async () => {
      await assertFails(setDoc(doc(admin(), "ledgerEntries", "r2"),
        asiento("banco-ajeno", { sourceType: "reversal", sourceId: "asiento-a", amount: -100_000 })));
      await assertFails(setDoc(doc(admin(), "ledgerEntries", "r3"),
        asiento("no-existe", { sourceType: "reversal", sourceId: "no-hay-original", amount: -100_000 })));
    });

    it("al editarlo, cambiar a una cuenta ajena se rechaza; tocar otra cosa no mira la cuenta", async () => {
      await assertFails(updateDoc(doc(admin(), "ledgerEntries", "asiento-a"), { bankAccountId: "banco-ajeno" }));
      await assertSucceeds(updateDoc(doc(admin(), "ledgerEntries", "asiento-cuenta-borrada"), { concept: "Corregido" }));
    });
  });
});
