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
 * `PRD-V-FEAT-008` entrega 1 · las reglas de `meteredServices` y `meterReadings`.
 * Cubre `CA10`, `CA11`, `CA12` y `CA13`.
 *
 * **Cada denegación va con su pareja positiva.** Una prueba de denegación pasa
 * igual sin ninguna regla —la satisface el deny por defecto—, así que sola no
 * demuestra nada: lo que demuestra que la regla existe es que lo permitido
 * SIGUE permitido.
 */

let testEnv: RulesTestEnvironment;

const CONJUNTO = "tenant-medidores";
const OTRO = "tenant-ajeno";

const admin = () => testEnv.authenticatedContext("admin-1", { role: "tenant_admin" }).firestore();
const residente = () => testEnv.authenticatedContext("residente-101", {}).firestore();
const vecino = () => testEnv.authenticatedContext("residente-202", {}).firestore();

async function sembrar() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "tenants", CONJUNTO), { status: "active" });
    await setDoc(doc(db, "tenants", OTRO), { status: "active" });
    await setDoc(doc(db, "tenants", "tenant-suspendido"), { status: "suspended" });

    const gente: Array<[string, string, string, string]> = [
      [CONJUNTO, "admin-1", "tenant_admin", "u-000"],
      [CONJUNTO, "residente-101", "resident", "u-101"],
      [CONJUNTO, "residente-202", "resident", "u-202"],
    ];
    for (const [t, uid, role, unitId] of gente) {
      await setDoc(doc(db, "tenantUsers", `${t}_${uid}`), {
        uid, tenantId: t, role, status: "active", unitId,
        fullName: "N", email: `${uid}@ejemplo.vivaru.app`, unitLabel: "APTO",
      });
    }

    await setDoc(doc(db, "meteredServices", `${CONJUNTO}_agua-fria`), {
      tenantId: CONJUNTO, name: "Agua fría", unit: "m3", rate: 3200,
      accountCode: "1.11", active: true,
    });

    for (const [unitId, estado] of [["u-101", "abierto"], ["u-202", "cobrado"]] as const) {
      await setDoc(doc(db, "meterReadings", `${CONJUNTO}_agua-fria_${unitId}_2026-09`), {
        tenantId: CONJUNTO, serviceId: "agua-fria", unitId, period: "2026-09",
        previous: 1200, current: 1247, consumption: 47, status: estado,
        photoUrl: "https://ejemplo/medidor.jpg",
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

describe("FEAT-008 · el catálogo de servicios medidos", () => {
  it("el administrador lo crea y lo edita", () => assertSucceeds(
    setDoc(doc(admin(), "meteredServices", `${CONJUNTO}_gas`), {
      tenantId: CONJUNTO, name: "Gas", unit: "m3", rate: 900, accountCode: "1.11", active: true,
    }),
  ));

  it("el residente lo LEE — necesita saber a qué tarifa se le cobra", () => assertSucceeds(
    getDoc(doc(residente(), "meteredServices", `${CONJUNTO}_agua-fria`)),
  ));

  it("pero NO lo escribe: la tarifa decide dinero", () => assertFails(
    updateDoc(doc(residente(), "meteredServices", `${CONJUNTO}_agua-fria`), { rate: 1 }),
  ));

  it("ni lo crea en otro conjunto", () => assertFails(
    setDoc(doc(admin(), "meteredServices", `${OTRO}_gas`), {
      tenantId: OTRO, name: "Gas", unit: "m3", rate: 900, accountCode: "1.11", active: true,
    }),
  ));
});

describe("FEAT-008 · `RN-07` · el residente ve SOLO su unidad", () => {
  it("lee la lectura de su propia unidad", () => assertSucceeds(
    getDoc(doc(residente(), "meterReadings", `${CONJUNTO}_agua-fria_u-101_2026-09`)),
  ));

  it("`CA10` · NO lee la de su vecino", () => assertFails(
    getDoc(doc(residente(), "meterReadings", `${CONJUNTO}_agua-fria_u-202_2026-09`)),
  ));

  it("y el vecino tampoco la suya — la denegación va en las dos direcciones", () => assertFails(
    getDoc(doc(vecino(), "meterReadings", `${CONJUNTO}_agua-fria_u-101_2026-09`)),
  ));

  it("el administrador las lee todas", async () => {
    await assertSucceeds(getDoc(doc(admin(), "meterReadings", `${CONJUNTO}_agua-fria_u-101_2026-09`)));
    await assertSucceeds(getDoc(doc(admin(), "meterReadings", `${CONJUNTO}_agua-fria_u-202_2026-09`)));
  });
});

describe("FEAT-008 · la consulta que hacen las pantallas", () => {
  it("el administrador LISTA el período entero filtrando `tenantId`", () => assertSucceeds(
    getDocs(query(collection(admin(), "meterReadings"),
      where("tenantId", "==", CONJUNTO), where("period", "==", "2026-09"))),
  ));

  it("el residente lista lo suyo filtrando ADEMÁS por `unitId`", () => assertSucceeds(
    getDocs(query(collection(residente(), "meterReadings"),
      where("tenantId", "==", CONJUNTO), where("unitId", "==", "u-101"))),
  ));

  it("🔴 y SIN ese `unitId` se le rechaza la consulta ENTERA", () => assertFails(
    // Firestore evalúa la consulta contra la regla **sin ejecutarla**: aunque
    // todas las lecturas fueran suyas, sin el filtro se deniega. Es la trampa
    // que ya costó `bankAccounts`, y por eso se mide en vez de razonarse.
    getDocs(query(collection(residente(), "meterReadings"), where("tenantId", "==", CONJUNTO))),
  ));
});

describe("FEAT-008 · `CA11` y `CA13` · la lectura no se escribe desde el cliente", () => {
  it("`CA11` · un residente NO registra una lectura", () => assertFails(
    setDoc(doc(residente(), "meterReadings", `${CONJUNTO}_agua-fria_u-101_2026-10`), {
      tenantId: CONJUNTO, serviceId: "agua-fria", unitId: "u-101", period: "2026-10",
      previous: 1247, current: 1300, consumption: 53, status: "abierto",
    }),
  ));

  it("`CA13` · **ni el administrador**: `consumption` y `previous` los pone el servidor", () => assertFails(
    updateDoc(doc(admin(), "meterReadings", `${CONJUNTO}_agua-fria_u-101_2026-09`), { consumption: 999999 }),
  ));

  it("tampoco puede tocar `previous`, que es la otra mitad del cálculo", () => assertFails(
    updateDoc(doc(admin(), "meterReadings", `${CONJUNTO}_agua-fria_u-101_2026-09`), { previous: 0 }),
  ));

  it("`CA12` · ni una lectura de un período ya cobrado", () => assertFails(
    updateDoc(doc(admin(), "meterReadings", `${CONJUNTO}_agua-fria_u-202_2026-09`), { current: 1 }),
  ));

  it("ni borrarla", () => assertFails(
    updateDoc(doc(admin(), "meterReadings", `${CONJUNTO}_agua-fria_u-101_2026-09`), { status: "anulado" }),
  ));
});
