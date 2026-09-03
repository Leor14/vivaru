import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/**
 * `PRD-V-FLOW-007` entrega 2 · las reglas de `monthlyReports`, **contra el
 * emulador**. Cubre `CA6`, `CA10`, `CA11` y la mitad de reglas de `CA12` y `CA14`.
 *
 * ## Estas pruebas no deberían existir todavía, según el traspaso
 *
 * La ficha y `docs/pendientes.md` dan seis criterios por **imposibles de
 * verificar aquí, «porque no hay Java»**. Es falso, y se comprobó ejercitándolo:
 * `/usr/bin/java` es el **stub de macOS** —responde «Unable to locate a Java
 * Runtime» y por eso la comprobación rápida dice que no hay—, pero el JDK está
 * instalado local al usuario en `~/.local/jdk`, documentado en `CLAUDE.md`, y
 * arranca el emulador sin una queja. **Es el mismo error que `invalid_rapt` con
 * la ADC: dar algo por muerto sin ejercitarlo.**
 *
 * ## Por qué contra el emulador y no leyendo la regla
 *
 * Una regla se lee bien y hace otra cosa. `updateDoc` fusiona y la regla evalúa
 * el documento **resultante**, mientras `setDoc` lo reemplaza; esa diferencia ya
 * dejó pasar un veto entero en este repositorio. Y una consulta de LISTA se
 * evalúa contra la regla **sin ejecutarla**, así que una rama que restringe por
 * el valor de un campo rechaza la consulta que no lo nombra aunque no hubiera ni
 * un documento que la incumpliera — eso no se ve leyendo.
 */

let testEnv: RulesTestEnvironment;

const CONJUNTO = "tenant-informe";
const OTRO = "tenant-ajeno";

const admin = () => testEnv.authenticatedContext("admin-1", { role: "tenant_admin" }).firestore();
const consejo = () => testEnv.authenticatedContext("consejo-1", {}).firestore();
const residente = () => testEnv.authenticatedContext("residente-1", {}).firestore();
const porteria = () => testEnv.authenticatedContext("guardia-1", {}).firestore();
const superadmin = () => testEnv.authenticatedContext("super-1", { role: "superadmin" }).firestore();

const cifras = {
  openingBalance: 5_000_000,
  openingBalanceSource: "registrado",
  closingBalance: 4_800_000,
  totalIncome: 200_000,
  totalExpenses: 400_000,
  netResult: -200_000,
  receivables: { total: 80_220_000, byUnit: [{ unitId: "u-1", unitLabel: "APTO 101", balance: 80_220_000, periods: 3 }] },
  payables: { total: 4_890_000, overdue: 0, byVendor: [] },
};

async function sembrar() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "tenants", CONJUNTO), { status: "active" });
    await setDoc(doc(db, "tenants", OTRO), { status: "active" });
    // Un conjunto SUSPENDIDO, para la mitad de reglas de `CA14`.
    await setDoc(doc(db, "tenants", "tenant-suspendido"), { status: "suspended" });

    const miembros: [string, string, string][] = [
      [CONJUNTO, "admin-1", "tenant_admin"],
      [CONJUNTO, "consejo-1", "committee"],
      [CONJUNTO, "residente-1", "resident"],
      [CONJUNTO, "guardia-1", "security_guard"],
      [OTRO, "residente-1", "resident"],
    ];
    for (const [t, uid, role] of miembros) {
      await setDoc(doc(db, "tenantUsers", `${t}_${uid}`), { uid, tenantId: t, role, status: "active", unitId: "u-1" });
    }

    for (const [id, tenantId, status] of [
      [`${CONJUNTO}_2026-01`, CONJUNTO, "borrador"],
      [`${CONJUNTO}_2026-02`, CONJUNTO, "emitido"],
      [`${CONJUNTO}_2026-03`, CONJUNTO, "publicado"],
      [`${CONJUNTO}_2025-12`, CONJUNTO, "anulado"],
      [`${OTRO}_2026-03`, OTRO, "publicado"],
    ] as const) {
      await setDoc(doc(db, "monthlyReports", id), {
        tenantId,
        period: id.slice(-7),
        status,
        ...cifras,
        ...(status === "anulado" ? { voidReason: "Un egreso de marzo con fecha de abril." } : {}),
      });
    }
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

/**
 * `CA6` y `CA16` · **la escritura está cerrada al cliente, entera.**
 *
 * Las cuatro operaciones van por callable con Admin SDK, que **no evalúa estas
 * reglas**. Dejar aquí una rama de administrador sería una segunda puerta al
 * mismo sitio — la lección de `CF8`, donde el producto se negaba a facturarle a
 * un conjunto suspendido y le dejaba cobrar.
 */
describe("FLOW-007 · `CA6` · un informe emitido no se edita desde el cliente", () => {
  it("el administrador NO puede tocar una cifra de un informe emitido", async () => {
    await assertFails(
      updateDoc(doc(admin(), "monthlyReports", `${CONJUNTO}_2026-02`), { closingBalance: 999_999_999 }),
    );
  });

  it("tampoco con `setDoc`, que REEMPLAZA en vez de fusionar", async () => {
    // Las dos formas a propósito: la regla ve documentos distintos según cuál se
    // use, y probar solo una deja la otra sin vigilar.
    await assertFails(
      setDoc(doc(admin(), "monthlyReports", `${CONJUNTO}_2026-02`), { tenantId: CONJUNTO, ...cifras, status: "emitido" }),
    );
  });

  it("ni puede cambiarle el ESTADO a mano, que sería emitir sin pasar por el servidor", async () => {
    await assertFails(updateDoc(doc(admin(), "monthlyReports", `${CONJUNTO}_2026-01`), { status: "emitido" }));
  });

  it("`CA16` · ni anular por escritura directa, que se saltaría el motivo obligatorio", async () => {
    // El motivo lo exige `anularInforme` en el servidor. Por aquí no se llega.
    await assertFails(updateDoc(doc(admin(), "monthlyReports", `${CONJUNTO}_2026-02`), { status: "anulado" }));
  });

  it("un borrador tampoco se crea a mano: las cifras las calcula el servidor", async () => {
    await assertFails(
      setDoc(doc(admin(), "monthlyReports", `${CONJUNTO}_2026-04`), { tenantId: CONJUNTO, period: "2026-04", status: "borrador", ...cifras }),
    );
  });

  it("y NO se borra: un informe emitido es el respaldo de una obligación legal", async () => {
    await assertFails(deleteDoc(doc(admin(), "monthlyReports", `${CONJUNTO}_2026-02`)));
  });

  it("ni siquiera el superadmin escribe: no firma ni emite en nombre del conjunto", async () => {
    await assertFails(updateDoc(doc(superadmin(), "monthlyReports", `${CONJUNTO}_2026-02`), { closingBalance: 1 }));
  });
});

describe("FLOW-007 · quién LEE el informe", () => {
  it("el administrador ve todos los estados, borrador incluido", async () => {
    await assertSucceeds(getDoc(doc(admin(), "monthlyReports", `${CONJUNTO}_2026-01`)));
    await assertSucceeds(getDoc(doc(admin(), "monthlyReports", `${CONJUNTO}_2026-02`)));
  });

  it("`CA15` · el anulado SIGUE leyéndose, con su motivo: archivar no es esconder", async () => {
    await assertSucceeds(getDoc(doc(admin(), "monthlyReports", `${CONJUNTO}_2025-12`)));
    await assertSucceeds(getDoc(doc(consejo(), "monthlyReports", `${CONJUNTO}_2025-12`)));
  });

  it("el consejo ve lo EMITIDO, y no el borrador", async () => {
    await assertSucceeds(getDoc(doc(consejo(), "monthlyReports", `${CONJUNTO}_2026-02`)));
    // Un borrador tiene cifras que todavía cambian; enseñárselo invita a
    // discutir números que nadie ha afirmado.
    await assertFails(getDoc(doc(consejo(), "monthlyReports", `${CONJUNTO}_2026-01`)));
  });

  it("la consulta del consejo TIENE que nombrar los estados, o se rechaza entera", async () => {
    const sinFiltro = query(collection(consejo(), "monthlyReports"), where("tenantId", "==", CONJUNTO));
    // Firestore evalúa la consulta contra la regla SIN ejecutarla: sin nombrar
    // los estados la rechaza aunque no hubiera ni un borrador. Es la trampa de
    // `bankAccounts` con `active == true` y la de `documents` con las categorías.
    await assertFails(getDocs(sinFiltro));

    const conFiltro = query(
      collection(consejo(), "monthlyReports"),
      where("tenantId", "==", CONJUNTO),
      where("status", "in", ["emitido", "publicado", "anulado"]),
    );
    await assertSucceeds(getDocs(conFiltro));
  });

  /**
   * `CA10`, `CA11` y `CA12` · **el residente no lee NADA aquí, todavía.**
   *
   * Es la entrega 3, y su alcance espera al abogado (`RN-11`). Estos criterios
   * «deben fallar» hoy, y fallan porque no hay rama de residente — no porque la
   * interfaz no le enseñe el botón.
   */
  it("`CA10` · un residente no lee el borrador NI el emitido de su propio conjunto", async () => {
    await assertFails(getDoc(doc(residente(), "monthlyReports", `${CONJUNTO}_2026-01`)));
    await assertFails(getDoc(doc(residente(), "monthlyReports", `${CONJUNTO}_2026-02`)));
  });

  it("`CA12` · ni el publicado: con la entrega 3 sin construir, no ve ninguno", async () => {
    await assertFails(getDoc(doc(residente(), "monthlyReports", `${CONJUNTO}_2026-03`)));
  });

  it("`CA11` · ni el publicado de OTRO conjunto donde también es residente", async () => {
    // El aislamiento por `tenantId` no depende de la entrega 3: es el invariante
    // de siempre, y tiene que seguir en pie cuando la 3 abra la puerta.
    await assertFails(getDoc(doc(residente(), "monthlyReports", `${OTRO}_2026-03`)));
  });

  it("la portería no ve nada del informe, que es lo que dice §3", async () => {
    await assertFails(getDoc(doc(porteria(), "monthlyReports", `${CONJUNTO}_2026-02`)));
  });

  it("y un no-miembro tampoco, aunque el informe esté publicado", async () => {
    const ajeno = testEnv.authenticatedContext("nadie-1", {}).firestore();
    await assertFails(getDoc(doc(ajeno, "monthlyReports", `${CONJUNTO}_2026-03`)));
  });

  it("sin sesión, nada", async () => {
    const anonimo = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonimo, "monthlyReports", `${CONJUNTO}_2026-03`)));
  });
});
