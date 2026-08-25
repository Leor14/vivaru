import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { anularAnticipo, cruzarAnticipo, deshacerCruce } from "../src/advances";
import { aplicarPago, revertirPago, vistaPreviaReparto } from "../src/payments";

/**
 * **`PLAT-002` §11.2 — la autoridad de la ruta del dinero es la membresía.**
 *
 * El defecto que esto fija, dicho con precisión. Las seis callables de dinero
 * —`applyPayment`, `revertPayment`, `previewPaymentAllocation`, `applyAdvance`,
 * `undoAdvanceApplication`, `cancelAdvance`— decidían con
 * `tokenTenant !== tenantId`: el conjunto del **claim** contra el pedido. La
 * auditoría del 21 de agosto de 2026 retiró doce comparaciones iguales, pero
 * miró `index.ts` y estas seis viven en `payments.ts` y `advances.ts`. Se
 * quedaron dentro, y eran **más duras** que las retiradas: aquellas solo
 * actuaban si el claim existía; estas no tienen guarda de presencia.
 *
 * Consecuencia medible: un administrador con membresía en A y en B, parado en
 * B, **no podía cobrar en B**. El selector de conjunto habría cambiado la
 * pantalla y el dinero habría rebotado.
 *
 * **Y borrarlas a secas abría un hueco.** Las doce de `index.ts` tenían
 * `assertActiveTenantAdmin` justo detrás; estas no tenían nada. La comparación
 * con el claim era lo ÚNICO que ataba al llamante con el conjunto. Por eso las
 * pruebas de abajo van en dos mitades que se sostienen la una a la otra: lo que
 * ahora SÍ se puede (CA11) y lo que sigue sin poderse (CF2). Una sola mitad no
 * demuestra nada — retirar la guarda entera pondría CA11 en verde.
 *
 * Necesita el emulador:
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const A = "plat002-conjunto-a";
const B = "plat002-conjunto-b";

/** Administrador de la empresa administradora: miembro de A **y** de B. */
const ADMIN_DOS = "plat002-admin-de-dos";
/** El administrador de siempre: una sola membresía, en A. Es el que no debe notar nada. */
const ADMIN_UNO = "plat002-admin-de-uno";
const ROL = "tenant_admin";

let db: Firestore;

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  db = getFirestore();
});

async function limpiar(col: string) {
  const snap = await db.collection(col).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function sembrarMembresia(
  tenantId: string,
  uid: string,
  extra: { role?: string; status?: string } = {},
) {
  await db.collection("tenantUsers").doc(`${tenantId}_${uid}`).set({
    uid,
    tenantId,
    role: extra.role ?? "tenant_admin",
    status: extra.status ?? "active",
  });
}

async function sembrarCuota(tenantId: string, id: string, amount = 100000, unitId = "unit-101") {
  await db.collection("billingStatements").doc(id).set({
    tenantId,
    unitId,
    unitLabel: "101",
    period: "2026-08",
    concept: "administracion",
    amount,
    paymentAmount: 0,
    balance: amount,
    dueDate: "2026-08-31",
    status: "pending",
  });
}

/** Crea un anticipo REAL cobrando de más. Devuelve su id. */
async function crearAnticipo(tenantId: string, uid: string, sufijo: string, sobrante: number) {
  await sembrarCuota(tenantId, `cuota-origen-${sufijo}`, 100000);
  const r = await aplicarPago(
    {
      tenantId,
      statementId: `cuota-origen-${sufijo}`,
      amount: 100000 + sobrante,
      date: "2026-08-20",
      operationKey: `op-origen-${sufijo}`,
      source: "manual",
    },
    uid,
    ROL,
  );
  return r.advanceId!;
}

beforeEach(async () => {
  for (const c of [
    "billingStatements",
    "ledgerEntries",
    "paymentOperations",
    "paymentVouchers",
    "advances",
    "advanceApplications",
    "featureFlagOverrides",
    "tenants",
    // Se limpia a propósito: si una membresía sobreviviera de otra corrida, las
    // pruebas de CF2 pasarían a abrirse sobre un estado que no es el que dicen.
    "tenantUsers",
  ]) {
    await limpiar(c);
  }

  for (const t of [A, B]) {
    await db.collection("tenants").doc(t).set({ name: t, status: "active" });
    await db.collection("featureFlagOverrides").doc(t).set({
      flags: { "producto-anticipos": true, "producto-pago-multiple": true },
    });
  }

  await sembrarMembresia(A, ADMIN_DOS);
  await sembrarMembresia(B, ADMIN_DOS);
  await sembrarMembresia(A, ADMIN_UNO);
  // En B, ADMIN_UNO **no** tiene documento. Es la ausencia que prueba CF2.
});

/**
 * La puerta de la que cuelga todo lo demás. Antes de cruzarla, sobre cuántos
 * casos se abre: dos membresías de ADMIN_DOS y una de ADMIN_UNO, y la de
 * ADMIN_UNO en B ausente. Sin esto, un `beforeEach` que fallara en silencio
 * dejaría a CF2 pasando en verde por el motivo equivocado.
 */
describe("el montaje es el que dicen las pruebas", () => {
  it("ADMIN_DOS tiene dos membresías y ADMIN_UNO una, y en B no tiene ninguna", async () => {
    const deDos = await db.collection("tenantUsers").where("uid", "==", ADMIN_DOS).get();
    const deUno = await db.collection("tenantUsers").where("uid", "==", ADMIN_UNO).get();
    expect(deDos.size).toBe(2);
    expect(deUno.size).toBe(1);

    const enB = await db.collection("tenantUsers").doc(`${B}_${ADMIN_UNO}`).get();
    expect(enB.exists).toBe(false);
  });
});

describe("CA11 · con membresía en los dos conjuntos se opera en los dos", () => {
  /**
   * **Esta es la prueba del cambio.** Con la guarda anterior fallaba: el claim
   * es de un solo conjunto, así que uno de los dos cobros salía denegado.
   */
  it("el mismo administrador cobra en A y en B sin volver a autenticarse", async () => {
    await sembrarCuota(A, "cuota-a", 100000);
    await sembrarCuota(B, "cuota-b", 250000);

    const enA = await aplicarPago(
      { tenantId: A, statementId: "cuota-a", amount: 100000, date: "2026-08-20", operationKey: "op-a", source: "manual" },
      ADMIN_DOS,
      ROL,
    );
    const enB = await aplicarPago(
      { tenantId: B, statementId: "cuota-b", amount: 250000, date: "2026-08-20", operationKey: "op-b", source: "manual" },
      ADMIN_DOS,
      ROL,
    );

    expect(enA.applied).toBe(true);
    expect(enB.applied).toBe(true);
    expect(enB.balance).toBe(0);
  });

  it("y también cruza un anticipo en el segundo conjunto", async () => {
    const advanceId = await crearAnticipo(B, ADMIN_DOS, "b", 40000);
    await sembrarCuota(B, "cuota-destino-b", 60000);

    const r = await cruzarAnticipo(
      { tenantId: B, advanceId, statementId: "cuota-destino-b", amount: 40000, date: "2026-08-21", operationKey: "cruce-b" },
      ADMIN_DOS,
      ROL,
    );
    expect(r.applied).toBe(true);
  });
});

describe("CF2 · sin membresía en el conjunto, las seis deniegan", () => {
  /**
   * El montaje de cada una se hace **con ADMIN_DOS**, que sí es miembro de B:
   * así el dato existe y la denegación solo puede venir del permiso de
   * ADMIN_UNO, no de un cargo o un anticipo que falte.
   */
  it("applyPayment", async () => {
    await sembrarCuota(B, "cuota-cf2-1", 100000);
    await expect(
      aplicarPago(
        { tenantId: B, statementId: "cuota-cf2-1", amount: 100000, date: "2026-08-20", operationKey: "op-cf2-1", source: "manual" },
        ADMIN_UNO,
        ROL,
      ),
    ).rejects.toThrow(/no tienes permiso/i);
  });

  it("revertPayment", async () => {
    await sembrarCuota(B, "cuota-cf2-2", 100000);
    await aplicarPago(
      { tenantId: B, statementId: "cuota-cf2-2", amount: 100000, date: "2026-08-20", operationKey: "op-cf2-2", source: "manual" },
      ADMIN_DOS,
      ROL,
    );
    await expect(
      revertirPago(
        { tenantId: B, operationKey: "op-cf2-2", reversalKey: "rev-cf2-2", reason: "prueba" },
        ADMIN_UNO,
        ROL,
      ),
    ).rejects.toThrow(/no tienes permiso/i);
  });

  it("previewPaymentAllocation", async () => {
    await sembrarCuota(B, "cuota-cf2-3", 100000);
    await expect(
      vistaPreviaReparto({ tenantId: B, unitId: "unit-101", amount: 50000 }, ADMIN_UNO, ROL),
    ).rejects.toThrow(/no tienes permiso/i);
  });

  it("applyAdvance", async () => {
    const advanceId = await crearAnticipo(B, ADMIN_DOS, "cf2-4", 30000);
    await sembrarCuota(B, "cuota-destino-cf2-4", 50000);
    await expect(
      cruzarAnticipo(
        { tenantId: B, advanceId, statementId: "cuota-destino-cf2-4", amount: 30000, date: "2026-08-21", operationKey: "cruce-cf2-4" },
        ADMIN_UNO,
        ROL,
      ),
    ).rejects.toThrow(/no tienes permiso/i);
  });

  it("undoAdvanceApplication", async () => {
    const advanceId = await crearAnticipo(B, ADMIN_DOS, "cf2-5", 30000);
    await sembrarCuota(B, "cuota-destino-cf2-5", 50000);
    const cruce = await cruzarAnticipo(
      { tenantId: B, advanceId, statementId: "cuota-destino-cf2-5", amount: 30000, date: "2026-08-21", operationKey: "cruce-cf2-5" },
      ADMIN_DOS,
      ROL,
    );
    await expect(
      deshacerCruce(
        { tenantId: B, applicationId: cruce.applicationId!, operationKey: "undo-cf2-5" },
        ADMIN_UNO,
        ROL,
      ),
    ).rejects.toThrow(/no tienes permiso/i);
  });

  it("cancelAdvance", async () => {
    const advanceId = await crearAnticipo(B, ADMIN_DOS, "cf2-6", 30000);
    await expect(
      anularAnticipo(
        { tenantId: B, advanceId, reason: "prueba", operationKey: "anul-cf2-6" },
        ADMIN_UNO,
        ROL,
      ),
    ).rejects.toThrow(/no tienes permiso/i);
  });
});

describe("CA1 · para quien tiene una sola membresía no cambia nada", () => {
  /**
   * El gemelo obligatorio de CF2. Si la única prueba fuera la denegación, una
   * guarda que denegara SIEMPRE pasaría en verde.
   */
  it("ADMIN_UNO sigue cobrando en su conjunto", async () => {
    await sembrarCuota(A, "cuota-propia", 120000);
    const r = await aplicarPago(
      { tenantId: A, statementId: "cuota-propia", amount: 120000, date: "2026-08-20", operationKey: "op-propia", source: "manual" },
      ADMIN_UNO,
      ROL,
    );
    expect(r.applied).toBe(true);
    expect(r.balance).toBe(0);
  });
});

describe("lo que se cerró de paso al dejar de mirar el token", () => {
  /**
   * Antes el rol salía del **token** y nadie miraba la membresía, así que un
   * administrador dado de baja seguía cobrando mientras su token no caducara.
   */
  it("una membresía INACTIVA no puede cobrar", async () => {
    await sembrarMembresia(A, ADMIN_UNO, { status: "inactive" });
    await sembrarCuota(A, "cuota-inactiva", 100000);
    await expect(
      aplicarPago(
        { tenantId: A, statementId: "cuota-inactiva", amount: 100000, date: "2026-08-20", operationKey: "op-inactiva", source: "manual" },
        ADMIN_UNO,
        ROL,
      ),
    ).rejects.toThrow(/no tienes permiso/i);
  });

  /**
   * El rol del token dice `tenant_admin` y el de la membresía dice `resident`.
   * Manda la membresía: el token lo emite quien inició sesión, el documento lo
   * escribe la administración.
   */
  it("una membresía de RESIDENTE no puede cobrar aunque el token diga admin", async () => {
    await sembrarMembresia(A, ADMIN_UNO, { role: "resident" });
    await sembrarCuota(A, "cuota-residente", 100000);
    await expect(
      aplicarPago(
        { tenantId: A, statementId: "cuota-residente", amount: 100000, date: "2026-08-20", operationKey: "op-residente", source: "manual" },
        ADMIN_UNO,
        ROL,
      ),
    ).rejects.toThrow(/no tienes permiso/i);
  });

  /**
   * La salida de emergencia se conserva intacta: el superadmin sale **antes**
   * de la membresía, porque no tiene ninguna y tiene que poder operar cualquier
   * conjunto para desbloquearlo.
   */
  it("el superadmin sigue operando sin ninguna membresía", async () => {
    await sembrarCuota(B, "cuota-super", 100000);
    const r = await aplicarPago(
      { tenantId: B, statementId: "cuota-super", amount: 100000, date: "2026-08-20", operationKey: "op-super", source: "manual" },
      "plat002-super",
      "superadmin",
    );
    expect(r.applied).toBe(true);
  });
});
