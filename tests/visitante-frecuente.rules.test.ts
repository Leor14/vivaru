import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { Timestamp, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, describe, it } from "vitest";

/**
 * **`L-08a` — la portería no puede registrar la salida de un visitante frecuente.**
 *
 * Lote «Análisis de la plataforma», reproducción de la fase 1 del plan (T1.4). Un pase de larga
 * duración vigente vuelve a `scheduled` al salir, para poder entrar otra vez
 * (`use-visitor-passes.ts:markVisitorAsCompleted` con `reentrable`, que calcula
 * `GuardVisitors.tsx`). Pero la regla del guardia en `visitorPasses` solo acepta
 * `scheduled→inside` e `inside→completed`, así que **niega `inside→scheduled`** y la salida falla.
 * Ninguna prueba lo cubría. Ya existía en producción: 6 pases de larga duración, sin ningún
 * ingreso todavía.
 *
 * Se usa `updateDoc`, que es lo que hace el cliente: la regla ve el documento resultante.
 * **La prueba del defecto va con `it.fails`**; las otras dos son el control y el límite que el
 * arreglo tiene que conservar: un pase PUNTUAL no puede volver a `scheduled`.
 */

let testEnv: RulesTestEnvironment;

const T = "tenant-frecuente";
const GUARDIA = "guard-frecuente";

const dentro = (extra: Record<string, unknown>) => ({
  tenantId: T,
  unitId: "unit-fr-101",
  unitLabel: "T1-101",
  visitorName: "Rosa Pérez",
  documentNumber: "1010101010",
  qrCodeValue: "QR-FRECUENTE",
  hostResidentName: "Residente Frecuente",
  tower: "T1",
  unit: "101",
  date: "2026-09-01",
  scheduledTime: "08:00",
  status: "inside",
  checkInAt: Timestamp.fromDate(new Date("2026-09-15T13:00:00Z")),
  checkOutAt: null,
  createdBy: "admin-frecuente",
  ...extra,
});

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
    await setDoc(doc(db, "tenants", T), { name: "Conjunto Frecuente", status: "active", currency: "COP" });
    await setDoc(doc(db, "tenantUsers", `${T}_${GUARDIA}`), {
      uid: GUARDIA,
      tenantId: T,
      role: "security_guard",
      status: "active",
      email: `${GUARDIA}@hogaru.test`,
    });
    await setDoc(doc(db, "visitorPasses", "pase-puntual-sale"), dentro({ authorizationType: "puntual" }));
    await setDoc(doc(db, "visitorPasses", "pase-puntual-vuelve"), dentro({ authorizationType: "puntual" }));
    await setDoc(
      doc(db, "visitorPasses", "pase-frecuente"),
      dentro({ authorizationType: "larga_duracion", validUntil: "2099-12-31" }),
    );
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

const guardia = () =>
  testEnv.authenticatedContext(GUARDIA, { role: "security_guard", tenantId: T }).firestore();

describe("L-08a · la salida de un visitante frecuente", () => {
  it("control: la portería registra la salida de un pase puntual (inside → completed)", async () => {
    await assertSucceeds(
      updateDoc(doc(guardia(), "visitorPasses", "pase-puntual-sale"), {
        status: "completed",
        checkOutAt: serverTimestamp(),
      }),
    );
  });

  it("límite: un pase PUNTUAL no puede volver a scheduled al salir", async () => {
    await assertFails(
      updateDoc(doc(guardia(), "visitorPasses", "pase-puntual-vuelve"), {
        status: "scheduled",
        checkOutAt: serverTimestamp(),
      }),
    );
  });

  it.fails("DEFECTO L-08a: la portería registra la salida de un frecuente vigente (inside → scheduled)", async () => {
    await assertSucceeds(
      updateDoc(doc(guardia(), "visitorPasses", "pase-frecuente"), {
        status: "scheduled",
        checkOutAt: serverTimestamp(),
      }),
    );
  });
});
