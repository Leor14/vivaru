import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, describe, it } from "vitest";

/**
 * **`D-2b` — un comunicado dirigido solo lo lee su audiencia.**
 *
 * Lote «Análisis de la plataforma» (`docs/valoraciones/lote-2026-09-15-analisis-plataforma.md`),
 * plan `docs/plan-lote-analisis-plataforma.md` (T1.1 la reproducción, T2.1 el arreglo).
 *
 * Hasta el 15 sep 2026 `communications` caía en la regla comodín, con lectura `sameTenant`: la
 * audiencia (`audienceUnitIds`, VIV-401) solo se filtraba en el navegador y un residente podía
 * leer con una consulta directa lo dirigido a otra unidad. La prueba del defecto nació con
 * `it.fails` (fase 1) y pasó a `it` con el arreglo. Si alguien vuelve a abrir la lectura,
 * enrojece.
 *
 * Además del documento suelto, se prueban **las consultas**: la regla nueva obliga al residente
 * a filtrar por `audience == "all"` o por `audienceUnitIds array-contains <su unidad>`, y una
 * consulta sin ese filtro se rechaza entera. Es lo que hace `useCommunications` en modo residente.
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
    for (const [uid, role, unitId] of [
      ["res-aud-a", "resident", "unit-aud-a"],
      ["res-aud-b", "resident", "unit-aud-b"],
      ["guard-aud", "security_guard", null],
      ["admin-aud", "tenant_admin", null],
    ] as const) {
      await setDoc(doc(db, "tenantUsers", `${T}_${uid}`), {
        uid,
        tenantId: T,
        role,
        status: "active",
        email: `${uid}@hogaru.test`,
        ...(unitId ? { unitId } : {}),
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
    // Un comunicado anterior a la audiencia: así eran 26 de 42 en producción el 15 sep.
    await setDoc(doc(db, "communications", "com-aud-antiguo"), {
      tenantId: T,
      title: "Asamblea ordinaria",
      message: "Sin campo de audiencia.",
      status: "published",
    });

    // `D-2c`: los adjuntos que Comunicaciones registra en Documentos.
    for (const [id, category] of [
      ["doc-adjunto-general", "comunicado"],
      ["doc-adjunto-dirigido", "comunicado_dirigido"],
    ] as const) {
      await setDoc(doc(db, "documents", id), {
        tenantId: T,
        fileName: `${id}.pdf`,
        category,
        source: "communication",
        sourceId: id === "doc-adjunto-general" ? "com-aud-general" : "com-aud-dirigido",
      });
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

const residente = (uid: string) => testEnv.authenticatedContext(uid, { role: "resident", tenantId: T }).firestore();
const comunicados = () => collection(residente("res-aud-a"), "communications");

describe("D-2b · la lectura de un comunicado respeta su audiencia", () => {
  it("un residente lee un comunicado general", async () => {
    await assertSucceeds(getDoc(doc(residente("res-aud-b"), "communications", "com-aud-general")));
  });

  it("un residente lee el comunicado dirigido a su unidad", async () => {
    await assertSucceeds(getDoc(doc(residente("res-aud-a"), "communications", "com-aud-dirigido")));
  });

  it("D-2b: un residente NO lee un comunicado dirigido a otra unidad", async () => {
    await assertFails(getDoc(doc(residente("res-aud-b"), "communications", "com-aud-dirigido")));
  });

  it("la administración lee el comunicado dirigido", async () => {
    const admin = testEnv.authenticatedContext("admin-aud", { role: "tenant_admin", tenantId: T }).firestore();
    await assertSucceeds(getDoc(doc(admin, "communications", "com-aud-dirigido")));
  });

  it("la portería ya no lee comunicados: ninguna de sus pantallas lo hace", async () => {
    const guardia = testEnv.authenticatedContext("guard-aud", { role: "security_guard", tenantId: T }).firestore();
    await assertFails(getDoc(doc(guardia, "communications", "com-aud-general")));
  });

  it("un comunicado SIN audience no lo lee ningún residente: por eso el relleno va antes que la regla", async () => {
    await assertFails(getDoc(doc(residente("res-aud-a"), "communications", "com-aud-antiguo")));
  });
});

describe("D-2b · las consultas del residente", () => {
  it("acepta la consulta de los generales (audience == all)", async () => {
    await assertSucceeds(getDocs(query(comunicados(), where("tenantId", "==", T), where("audience", "==", "all"))));
  });

  it("acepta la consulta de los dirigidos a su unidad (array-contains)", async () => {
    await assertSucceeds(
      getDocs(query(comunicados(), where("tenantId", "==", T), where("audienceUnitIds", "array-contains", "unit-aud-a"))),
    );
  });

  it("rechaza la consulta de los dirigidos a OTRA unidad", async () => {
    await assertFails(
      getDocs(query(comunicados(), where("tenantId", "==", T), where("audienceUnitIds", "array-contains", "unit-aud-b"))),
    );
  });

  it("rechaza entera la consulta sin filtro de audiencia: la que hacía el hook hasta el 15 sep", async () => {
    await assertFails(getDocs(query(comunicados(), where("tenantId", "==", T))));
  });
});

/**
 * **`D-2c` — el adjunto de un comunicado dirigido no se lee desde Documentos.** Comunicaciones lo
 * registra como `comunicado_dirigido`, que la lista blanca de `documents` no concede al residente.
 */
describe("D-2c · los adjuntos de comunicados en Documentos", () => {
  it("un residente lee el adjunto de un comunicado general", async () => {
    await assertSucceeds(getDoc(doc(residente("res-aud-b"), "documents", "doc-adjunto-general")));
  });

  it("D-2c: un residente NO lee el adjunto de un comunicado dirigido", async () => {
    await assertFails(getDoc(doc(residente("res-aud-b"), "documents", "doc-adjunto-dirigido")));
  });

  it("la administración sí lo lee: la copia sigue en su repositorio", async () => {
    const admin = testEnv.authenticatedContext("admin-aud", { role: "tenant_admin", tenantId: T }).firestore();
    await assertSucceeds(getDoc(doc(admin, "documents", "doc-adjunto-dirigido")));
  });
});
