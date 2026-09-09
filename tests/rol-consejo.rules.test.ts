import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/**
 * `PRD-V-PLAT-004` entrega 1 · las reglas de la marca de consejo, **contra el
 * emulador**. Cubre `CA8`, `CA9` y `CA14`.
 *
 * ## Lo que estas pruebas tienen que demostrar, y no es lo obvio
 *
 * La ficha avisa: **una prueba de denegación pasa igual sin ninguna regla, la
 * satisface el deny por defecto.** Por eso cada denegación de aquí va con su
 * pareja POSITIVA — el mismo documento, leído por alguien que sí debe poder—.
 * Si el helper `esConsejo` no funcionara, las denegaciones seguirían en verde y
 * **las positivas enrojecerían**, que es exactamente la señal que se busca.
 *
 * ## `RN-01`, que es lo que hace rara esta ficha
 *
 * El consejero es un **residente** con `isCommittee: true`, no alguien con
 * `role: "committee"`. Ese valor nunca lo tuvo nadie (0 de 41 en producción) y
 * se conserva solo por compatibilidad. Por eso el sujeto de casi todas estas
 * pruebas tiene `role: "resident"`.
 */

let testEnv: RulesTestEnvironment;

const CONJUNTO = "tenant-consejo";
const OTRO = "tenant-ajeno";

const admin = () => testEnv.authenticatedContext("admin-1", { role: "tenant_admin" }).firestore();
/** Residente CON la marca — el consejero de verdad de `PLAT-004`. */
const consejero = () => testEnv.authenticatedContext("consejero-1", {}).firestore();
/** Residente SIN la marca — el control que impide el verde hueco. */
const residente = () => testEnv.authenticatedContext("residente-1", {}).firestore();
/** El `role: "committee"` de antes de la ficha, que sigue admitido. */
const consejoViejo = () => testEnv.authenticatedContext("consejo-viejo", {}).firestore();
const ajeno = () => testEnv.authenticatedContext("consejero-ajeno", {}).firestore();

async function sembrar() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "tenants", CONJUNTO), { status: "active" });
    await setDoc(doc(db, "tenants", OTRO), { status: "active" });

    const miembros: Array<Record<string, unknown> & { uid: string; tenantId: string }> = [
      { uid: "admin-1", tenantId: CONJUNTO, role: "tenant_admin" },
      { uid: "consejero-1", tenantId: CONJUNTO, role: "resident", isCommittee: true },
      { uid: "residente-1", tenantId: CONJUNTO, role: "resident" },
      { uid: "consejo-viejo", tenantId: CONJUNTO, role: "committee" },
      { uid: "consejero-ajeno", tenantId: OTRO, role: "resident", isCommittee: true },
    ];
    for (const m of miembros) {
      // Los campos de display van completos a propósito: la regla de `update`
      // los compara uno a uno, y si faltan responde «Property … is undefined»,
      // que se lee como denegación y no lo es.
      await setDoc(doc(db, "tenantUsers", `${m.tenantId}_${m.uid}`), {
        status: "active",
        fullName: "Nombre Sembrado",
        email: `${m.uid}@ejemplo.vivaru.app`,
        unitId: "u-1",
        unitLabel: "APTO 101",
        ...m,
      });
    }

    for (const [id, tenantId, status] of [
      [`${CONJUNTO}_2026-01`, CONJUNTO, "borrador"],
      [`${CONJUNTO}_2026-02`, CONJUNTO, "emitido"],
      [`${OTRO}_2026-02`, OTRO, "emitido"],
    ] as const) {
      await setDoc(doc(db, "monthlyReports", id), { tenantId, period: id.slice(-7), status, closingBalance: 1_000 });
    }

    await setDoc(doc(db, "clearanceCertificates", `${CONJUNTO}_pz-1`), {
      tenantId: CONJUNTO, unitId: "u-9", status: "emitido",
    });
    await setDoc(doc(db, "documents", `${CONJUNTO}_doc-1`), {
      tenantId: CONJUNTO, category: "financiero", name: "Cartera de agosto",
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

/**
 * **El par que da sentido a todo lo demás.** Si `esConsejo` estuviera roto —o si
 * alguien lo sustituyera por `false`—, la primera enrojece y las denegaciones de
 * más abajo seguirían pasando. Es la falsación incorporada.
 */
describe("PLAT-004 · la marca CONCEDE de verdad", () => {
  it("un residente CON la marca lee un informe EMITIDO", async () => {
    await assertSucceeds(getDoc(doc(consejero(), "monthlyReports", `${CONJUNTO}_2026-02`)));
  });

  it("el mismo residente SIN la marca NO lo lee — el permiso viene de la marca, no de ser residente", async () => {
    await assertFails(getDoc(doc(residente(), "monthlyReports", `${CONJUNTO}_2026-02`)));
  });

  it("la marca abre el paz y salvo de una unidad AJENA, que el residente no ve", async () => {
    await assertSucceeds(getDoc(doc(consejero(), "clearanceCertificates", `${CONJUNTO}_pz-1`)));
    await assertFails(getDoc(doc(residente(), "clearanceCertificates", `${CONJUNTO}_pz-1`)));
  });

  it("y abre un documento `financiero`, que NO está en la lista blanca del residente", async () => {
    await assertSucceeds(getDoc(doc(consejero(), "documents", `${CONJUNTO}_doc-1`)));
    await assertFails(getDoc(doc(residente(), "documents", `${CONJUNTO}_doc-1`)));
  });

  it("`role: \"committee\"` sigue valiendo: la compatibilidad no se rompió", async () => {
    await assertSucceeds(getDoc(doc(consejoViejo(), "monthlyReports", `${CONJUNTO}_2026-02`)));
  });

  it("la marca NO cruza de conjunto", async () => {
    await assertFails(getDoc(doc(ajeno(), "monthlyReports", `${CONJUNTO}_2026-02`)));
  });
});

/** `CA8` — el consejo no ve lo que aún no se le ha presentado. */
describe("PLAT-004 · `CA8` · el consejero NO lee un informe en borrador", () => {
  it("con la marca puesta, el borrador sigue cerrado", async () => {
    await assertFails(getDoc(doc(consejero(), "monthlyReports", `${CONJUNTO}_2026-01`)));
  });

  it("y el administrador SÍ lo lee — la denegación es del rol, no del documento", async () => {
    await assertSucceeds(getDoc(doc(admin(), "monthlyReports", `${CONJUNTO}_2026-01`)));
  });
});

/** `CA9` — leer no es escribir. */
describe("PLAT-004 · `CA9` · el consejero NO escribe en `monthlyReports`", () => {
  it("no puede cambiar una cifra del informe que sí puede leer", async () => {
    await assertFails(
      updateDoc(doc(consejero(), "monthlyReports", `${CONJUNTO}_2026-02`), { closingBalance: 999_999_999 }),
    );
  });

  it("tampoco con `setDoc`, que REEMPLAZA en vez de fusionar", async () => {
    await assertFails(
      setDoc(doc(consejero(), "monthlyReports", `${CONJUNTO}_2026-02`), {
        tenantId: CONJUNTO, period: "2026-02", status: "emitido", closingBalance: 1,
      }),
    );
  });
});

/**
 * `CA14` — **el hueco que había antes de esta ficha.** La regla de `tenantUsers`
 * enumera los campos que NO pueden cambiar, así que `isCommittee` nacía
 * escribible: un `tenant_admin` podía dársela a sí mismo desde el navegador y
 * con ella la firma del informe del conjunto.
 */
describe("PLAT-004 · `CA14` · la marca no se escribe desde el cliente", () => {
  it("el `tenant_admin` NO se concede la marca a sí mismo", async () => {
    await assertFails(updateDoc(doc(admin(), "tenantUsers", `${CONJUNTO}_admin-1`), { isCommittee: true }));
  });

  it("ni `committeeSince`", async () => {
    await assertFails(
      updateDoc(doc(admin(), "tenantUsers", `${CONJUNTO}_admin-1`), { committeeSince: new Date() }),
    );
  });

  it("ni `committeeGrantedBy`", async () => {
    await assertFails(
      updateDoc(doc(admin(), "tenantUsers", `${CONJUNTO}_admin-1`), { committeeGrantedBy: "admin-1" }),
    );
  });

  it("un consejero NO se RETIRA la marca a sí mismo — ni se la pone a otro", async () => {
    await assertFails(updateDoc(doc(consejero(), "tenantUsers", `${CONJUNTO}_consejero-1`), { isCommittee: false }));
    await assertFails(updateDoc(doc(consejero(), "tenantUsers", `${CONJUNTO}_residente-1`), { isCommittee: true }));
  });

  it("y el administrador CONSERVA lo que sí podía hacer: cambiarse el nombre", async () => {
    // Control negativo. Sin esto, blindar los tres campos de más —o romper la
    // regla entera— pasaría inadvertido: todas las pruebas de arriba seguirían
    // en verde por el deny por defecto.
    await assertSucceeds(updateDoc(doc(admin(), "tenantUsers", `${CONJUNTO}_admin-1`), { fullName: "Nombre Nuevo" }));
  });
});

/**
 * **La consulta que necesita la pantalla, probada antes de construirla.** La
 * marca vive en `tenantUsers` y el padrón lee `people`, así que para pintar quién
 * es consejo hay que LISTAR `tenantUsers` del conjunto. Firestore evalúa una
 * consulta contra la regla **sin ejecutarla**, así que una rama que dependa del
 * documento puede rechazarla entera aunque ni un documento la incumpliera — es
 * lo que ya costó `bankAccounts`. Esto se mide, no se razona.
 */
describe("PLAT-004 · la consulta que hace la pantalla de Personas", () => {
  it("el `tenant_admin` LISTA las membresías de su conjunto filtrando por `tenantId`", async () => {
    await assertSucceeds(
      getDocs(query(collection(admin(), "tenantUsers"), where("tenantId", "==", CONJUNTO))),
    );
  });

  it("y NO puede listar las de otro conjunto", async () => {
    await assertFails(
      getDocs(query(collection(admin(), "tenantUsers"), where("tenantId", "==", OTRO))),
    );
  });

  it("un residente NO lista el padrón de membresías", async () => {
    await assertFails(
      getDocs(query(collection(residente(), "tenantUsers"), where("tenantId", "==", CONJUNTO))),
    );
  });
});
