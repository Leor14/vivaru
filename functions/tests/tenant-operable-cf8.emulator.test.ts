import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { anularAnticipo, cruzarAnticipo, deshacerCruce } from "../src/advances";
import { aplicarPago, revertirPago, vistaPreviaReparto } from "../src/payments";

/**
 * `CF8` — un conjunto que no puede operar tampoco puede cobrar.
 *
 * **El defecto que esto fija, dicho con precisión.** `tenantOperable` vivía solo
 * en `firestore.rules`, y las callables de dinero van con **Admin SDK, que no
 * evalúa las reglas**. Resultado: un conjunto `suspended` —un cliente que dejó
 * de pagar— podía cobrar y cruzar anticipos con normalidad. Se reprodujo en
 * producción el 24 de agosto de 2026 sobre `Privada Las Playas`: cobro de
 * $2.120.000, recibo `REC-HDFW4R`, asiento en el libro y cartera a cero. El
 * producto ya se negaba a **facturarle** (crear un cargo es escritura directa
 * del cliente y sí pasa por las reglas) pero le dejaba **cobrar**.
 *
 * **Estas pruebas viven contra el emulador y no pueden ser unitarias**, porque
 * lo que se comprueba es una LECTURA de `tenants/{id}.status`. Un mock del
 * documento probaría el mock.
 *
 * Necesita el emulador:
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const OPERABLE = "conjunto-operable";
const SUSPENDIDO = "conjunto-suspendido";
const VENCIDO = "conjunto-vencido";
const SIN_STATUS = "conjunto-sin-status";

const ADMIN = "admin-1";
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

async function sembrarCuota(tenantId: string, id: string, amount = 140000) {
  await db.collection("billingStatements").doc(id).set({
    tenantId,
    unitId: "unit-101",
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

/**
 * Crea un anticipo REAL cobrando de más en un conjunto operable. Los anticipos
 * de las pruebas de bloqueo tienen que nacer en un conjunto que sí puede
 * operar: si nacieran en el suspendido, el propio arreglo impediría crearlos y
 * la prueba pasaría por el motivo equivocado.
 */
async function anticipoEnOperable(sufijo: string, sobrante: number) {
  await sembrarCuota(OPERABLE, `cuota-origen-${sufijo}`, 100000);
  const r = await aplicarPago(
    {
      tenantId: OPERABLE,
      statementId: `cuota-origen-${sufijo}`,
      amount: 100000 + sobrante,
      date: "2026-08-20",
      operationKey: `op-origen-${sufijo}`,
      source: "manual",
    },
    ADMIN,
    ROL,
  );
  return r.advanceId!;
}

/**
 * La membresía de administrador, que desde `PLAT-002` §11.2 es **la autoridad**
 * sobre qué conjunto puede cobrar alguien: la guarda dejó de comparar el claim
 * del token y ahora lee `tenantUsers/{tenantId}_{uid}`. Sin esto sembrado, cada
 * llamada de esta suite se cae con `permission-denied` — y eso es correcto, no
 * un estorbo de la prueba: es lo que le pasaría a un administrador de verdad.
 *
 * **`conjunto-inexistente` también la lleva, y no es contradictorio.** Esa
 * prueba fija que un conjunto SIN documento en `tenants` se asume operable; la
 * membresía vive en otra colección, así que se puede ser miembro de un conjunto
 * cuyo documento no existe. Sin sembrarla, esa prueba pasaría a fallar por el
 * permiso y dejaría de comprobar lo que dice su nombre.
 */
async function sembrarMembresia(tenantId: string, uid = ADMIN) {
  await db.collection("tenantUsers").doc(`${tenantId}_${uid}`).set({
    uid,
    tenantId,
    role: "tenant_admin",
    status: "active",
  });
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
  ]) {
    await limpiar(c);
  }

  await db.collection("tenants").doc(OPERABLE).set({ name: "Operable", status: "active" });
  await db.collection("tenants").doc(SUSPENDIDO).set({ name: "Suspendido", status: "suspended" });
  await db.collection("tenants").doc(VENCIDO).set({ name: "Vencido", status: "expired" });
  // Sin campo `status` a propósito: datos anteriores a que el campo existiera.
  await db.collection("tenants").doc(SIN_STATUS).set({ name: "Sin status" });

  for (const t of [OPERABLE, SUSPENDIDO, VENCIDO, SIN_STATUS, "conjunto-inexistente"]) {
    await sembrarMembresia(t);
  }

  for (const t of [OPERABLE, SUSPENDIDO, VENCIDO, SIN_STATUS]) {
    await db.collection("featureFlagOverrides").doc(t).set({
      flags: { "producto-anticipos": true, "producto-pago-multiple": true },
    });
  }
});

describe("CF8 · cobrar en un conjunto que no puede operar", () => {
  it("un conjunto SUSPENDIDO no puede aplicar un pago", async () => {
    await sembrarCuota(SUSPENDIDO, "cuota-susp");
    await expect(
      aplicarPago(
        { tenantId: SUSPENDIDO, statementId: "cuota-susp", amount: 140000, date: "2026-08-20", operationKey: "op-susp", source: "manual" },
        ADMIN,
        ROL,
      ),
    ).rejects.toThrow(/suspendido/i);
  });

  it("un conjunto VENCIDO no puede aplicar un pago, y el mensaje habla de la prueba", async () => {
    await sembrarCuota(VENCIDO, "cuota-venc");
    await expect(
      aplicarPago(
        { tenantId: VENCIDO, statementId: "cuota-venc", amount: 140000, date: "2026-08-20", operationKey: "op-venc", source: "manual" },
        ADMIN,
        ROL,
      ),
    ).rejects.toThrow(/período de prueba/i);
  });

  /**
   * **El criterio que mide el mecanismo, no el paso.** «Lanza una excepción»
   * sería cierto y aun así insuficiente: lo que hay que probar es que el dinero
   * NO se movió. Si el guardián fallara después de la transacción, el throw
   * seguiría ocurriendo y el cargo estaría cobrado igual.
   */
  it("y el estado financiero del conjunto queda IDÉNTICO", async () => {
    await sembrarCuota(SUSPENDIDO, "cuota-intacta", 140000);

    await expect(
      aplicarPago(
        { tenantId: SUSPENDIDO, statementId: "cuota-intacta", amount: 140000, date: "2026-08-20", operationKey: "op-intacta", source: "manual" },
        ADMIN,
        ROL,
      ),
    ).rejects.toThrow();

    const cargo = await db.collection("billingStatements").doc("cuota-intacta").get();
    expect(cargo.data()?.paymentAmount).toBe(0);
    expect(cargo.data()?.balance).toBe(140000);
    expect(cargo.data()?.status).toBe("pending");

    const libro = await db.collection("ledgerEntries").where("tenantId", "==", SUSPENDIDO).get();
    expect(libro.size).toBe(0);
    const recibos = await db.collection("paymentVouchers").where("tenantId", "==", SUSPENDIDO).get();
    expect(recibos.size).toBe(0);
    const anticipos = await db.collection("advances").where("tenantId", "==", SUSPENDIDO).get();
    expect(anticipos.size).toBe(0);
  });

  it("tampoco puede revertir un pago", async () => {
    await expect(
      revertirPago(
        { tenantId: SUSPENDIDO, operationKey: "op-x", reversalKey: "rev-x", reason: "prueba" },
        ADMIN,
        ROL,
      ),
    ).rejects.toThrow(/suspendido/i);
  });

  /**
   * La vista previa no escribe nada, y aun así se bloquea: solo se pide para
   * cobrar a continuación. Bloquearla hace que la pantalla falle temprano con el
   * mensaje correcto, en vez de dejar rellenar un formulario que morirá al
   * enviarse.
   */
  it("ni siquiera calcula la vista previa del reparto", async () => {
    await sembrarCuota(SUSPENDIDO, "cuota-previa");
    await expect(
      vistaPreviaReparto({ tenantId: SUSPENDIDO, unitId: "unit-101", amount: 50000 }, ADMIN, ROL),
    ).rejects.toThrow(/suspendido/i);
  });
});

describe("CF8 · anticipos en un conjunto que no puede operar", () => {
  it("no puede cruzar un anticipo", async () => {
    const advanceId = await anticipoEnOperable("cruce", 60000);
    await sembrarCuota(SUSPENDIDO, "cuota-cruce");
    await expect(
      cruzarAnticipo(
        { tenantId: SUSPENDIDO, advanceId, statementId: "cuota-cruce", amount: 60000, date: "2026-08-21", operationKey: "cruce-susp" },
        ADMIN,
        ROL,
      ),
    ).rejects.toThrow(/suspendido/i);
  });

  it("no puede deshacer un cruce", async () => {
    await expect(
      deshacerCruce(
        { tenantId: SUSPENDIDO, applicationId: "app-x", operationKey: "undo-susp" },
        ADMIN,
        ROL,
      ),
    ).rejects.toThrow(/suspendido/i);
  });

  it("no puede anular un anticipo", async () => {
    const advanceId = await anticipoEnOperable("anul", 60000);
    await expect(
      anularAnticipo(
        { tenantId: SUSPENDIDO, advanceId, reason: "prueba", operationKey: "anul-susp" },
        ADMIN,
        ROL,
      ),
    ).rejects.toThrow(/suspendido/i);
  });
});

describe("CF8 · lo que NO se puede romper al arreglarlo", () => {
  it("un conjunto activo cobra con normalidad", async () => {
    await sembrarCuota(OPERABLE, "cuota-ok", 140000);
    const r = await aplicarPago(
      { tenantId: OPERABLE, statementId: "cuota-ok", amount: 140000, date: "2026-08-20", operationKey: "op-ok", source: "manual" },
      ADMIN,
      ROL,
    );
    expect(r.applied).toBe(true);
    expect(r.balance).toBe(0);
  });

  /**
   * **La salida de emergencia, y es deliberada.** El superadmin necesita operar
   * sobre un conjunto suspendido justamente para desatascarlo. Por eso su
   * comprobación va ANTES que la del estado, igual que en
   * `assertTenantAdminOrSuper`. Si esta prueba se pone en rojo, el arreglo dejó
   * fuera a la única persona que puede arreglar un cobro equivocado.
   */
  it("el SUPERADMIN sí puede operar un conjunto suspendido", async () => {
    await sembrarCuota(SUSPENDIDO, "cuota-super", 140000);
    const r = await aplicarPago(
      { tenantId: SUSPENDIDO, statementId: "cuota-super", amount: 140000, date: "2026-08-20", operationKey: "op-super", source: "manual" },
      "super-1",
      "superadmin",
    );
    expect(r.applied).toBe(true);
    expect(r.balance).toBe(0);
  });

  /**
   * Compatibilidad con datos anteriores al campo. Importa de verdad: la suite
   * `payments.emulator.test.ts` **no siembra ningún documento de tenant**, así
   * que todos sus conjuntos caen por aquí. Si esta rama se cerrara, se caerían
   * las 40 y pico pruebas de aquel fichero — y por el motivo equivocado.
   */
  it("un conjunto SIN campo `status` se asume operable", async () => {
    await sembrarCuota(SIN_STATUS, "cuota-sin-status", 140000);
    const r = await aplicarPago(
      { tenantId: SIN_STATUS, statementId: "cuota-sin-status", amount: 140000, date: "2026-08-20", operationKey: "op-sin-status", source: "manual" },
      ADMIN,
      ROL,
    );
    expect(r.applied).toBe(true);
  });

  it("un conjunto que NO existe se asume operable", async () => {
    await sembrarCuota("conjunto-inexistente", "cuota-inexistente", 140000);
    const r = await aplicarPago(
      { tenantId: "conjunto-inexistente", statementId: "cuota-inexistente", amount: 140000, date: "2026-08-20", operationKey: "op-inexistente", source: "manual" },
      ADMIN,
      ROL,
    );
    expect(r.applied).toBe(true);
  });

  /**
   * **El orden importa y esto lo fija.** El estado del conjunto se comprueba
   * DESPUÉS del rol. Si se comprobara antes, un residente hurgando en un
   * conjunto vencido recibiría «el período de prueba terminó» en vez de «no
   * tienes permiso»: le estaríamos filtrando el estado comercial de un cliente
   * a quien ni siquiera es miembro.
   */
  it("a quien no es administrador se le dice «no tienes permiso», NO el estado del conjunto", async () => {
    await sembrarCuota(SUSPENDIDO, "cuota-fuga");
    await expect(
      aplicarPago(
        { tenantId: SUSPENDIDO, statementId: "cuota-fuga", amount: 1000, date: "2026-08-20", operationKey: "op-fuga", source: "manual" },
        "residente-1",
        "resident",
      ),
    ).rejects.toThrow(/no tienes permiso/i);
  });
});
