import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, describe, it } from "vitest";

/**
 * **`D-2b` — un comunicado dirigido lo puede leer cualquier residente del conjunto.**
 *
 * Lote «Análisis de la plataforma» (`docs/valoraciones/lote-2026-09-15-analisis-plataforma.md`),
 * reproducción de la fase 1 del plan (`docs/plan-lote-analisis-plataforma.md`, T1.1).
 *
 * `communications` no tiene bloque propio: cae en `match /{collection}/{docId}` con
 * `relaxedTenantCollection`, cuya lectura es `sameTenant`. La audiencia (`audienceUnitIds`,
 * VIV-401) **solo se filtra en el navegador** (`resident/communications/page.tsx`), así que un
 * residente puede leer con una consulta directa lo que la administración dirigió a otra unidad.
 * David lo declaró obligatorio el 15 sep (acceso indebido entre unidades, §2.1 del modelo v0.4).
 *
 * **Las pruebas del defecto van con `it.fails`**: vitest las da por buenas MIENTRAS el defecto
 * exista, así que no ponen rojo el banco. El arreglo (T2.1) las pasa a `it` normal y tienen que
 * pasar; si alguien lo arregla sin tocarlas, enrojecen. Las demás son el control de que la
 * prueba ve lo que dice ver: un residente SÍ lee lo general y lo dirigido a su unidad.
 */

let testEnv: RulesTestEnvironment;

const T = "tenant-audiencia";

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
    for (const [uid, unitId] of [
      ["res-aud-a", "unit-aud-a"],
      ["res-aud-b", "unit-aud-b"],
    ] as const) {
      await setDoc(doc(db, "tenantUsers", `${T}_${uid}`), {
        uid,
        tenantId: T,
        role: "resident",
        status: "active",
        email: `${uid}@hogaru.test`,
        unitId,
      });
    }
    await setDoc(doc(db, "tenants", T), { name: "Conjunto Audiencia", status: "active", currency: "COP" });

    // La forma que escribe `admin/communications/page.tsx` al publicar.
    await setDoc(doc(db, "communications", "com-aud-general"), {
      tenantId: T,
      title: "Corte de agua",
      message: "Para todo el conjunto.",
      status: "published",
      audience: "all",
      audienceTowers: [],
      audienceUnitIds: [],
    });
    await setDoc(doc(db, "communications", "com-aud-dirigido"), {
      tenantId: T,
      title: "Aviso de cartera — Saldo pendiente",
      message: "Solo para la unidad A.",
      status: "published",
      audience: "towers",
      audienceTowers: ["T1"],
      audienceUnitIds: ["unit-aud-a"],
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("D-2b · la lectura de un comunicado respeta su audiencia", () => {
  it("control: un residente lee un comunicado general", async () => {
    const b = testEnv.authenticatedContext("res-aud-b", { role: "resident", tenantId: T });
    await assertSucceeds(getDoc(doc(b.firestore(), "communications", "com-aud-general")));
  });

  it("control: un residente lee el comunicado dirigido a su unidad", async () => {
    const a = testEnv.authenticatedContext("res-aud-a", { role: "resident", tenantId: T });
    await assertSucceeds(getDoc(doc(a.firestore(), "communications", "com-aud-dirigido")));
  });

  it.fails("DEFECTO D-2b: un residente NO lee un comunicado dirigido a otra unidad", async () => {
    const b = testEnv.authenticatedContext("res-aud-b", { role: "resident", tenantId: T });
    await assertFails(getDoc(doc(b.firestore(), "communications", "com-aud-dirigido")));
  });
});
