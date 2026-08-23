import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { aplicarPago, revertirPago } from "../src/payments";

/**
 * `aplicarPago` y `revertirPago` **contra una base de verdad**.
 *
 * Existe porque `payments-fin001.test.ts` prueba `calcularSaldo` y
 * `saldoTrasRevertir`, que son aritmética pura, y **ninguna de las dos toca la
 * transacción**. Todo lo que se decide dentro de `runTransaction` —qué se
 * escribe en el asiento, qué se copia al reverso, qué se valida antes— era
 * territorio sin cubrir: se podía cambiar el asiento entero con las 457 pruebas
 * en verde.
 *
 * Es la misma lección del 23 de agosto, un nivel más abajo: la suite estaba
 * verde mientras el informe mentía porque el defecto vivía donde la suite no
 * llegaba.
 *
 * Necesita el emulador:
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const TENANT = "conjunto-prueba";
const OTRO_TENANT = "conjunto-ajeno";
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

async function sembrarCuota(id: string, amount = 140000) {
  await db.collection("billingStatements").doc(id).set({
    tenantId: TENANT,
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

beforeEach(async () => {
  for (const c of ["billingStatements", "ledgerEntries", "paymentOperations", "paymentVouchers", "bankAccounts", "tenantSettings"]) {
    await limpiar(c);
  }
  await db.collection("bankAccounts").doc("cta-bancolombia").set({
    tenantId: TENANT,
    label: "Bancolombia principal",
    bankName: "Bancolombia",
    active: true,
  });
  await db.collection("bankAccounts").doc("cta-ajena").set({
    tenantId: OTRO_TENANT,
    label: "Cuenta de otro conjunto",
    bankName: "Davivienda",
    active: true,
  });
  await db.collection("bankAccounts").doc("cta-cerrada").set({
    tenantId: TENANT,
    label: "Cuenta cerrada",
    bankName: "BBVA",
    active: false,
  });
});

describe("D-C · el asiento del pago guarda a qué cuenta entró el dinero", () => {
  it("escribe el `bankAccountId` recibido, no `null`", async () => {
    await sembrarCuota("cuota-1");
    const r = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-1", amount: 140000, date: "2026-08-20", operationKey: "op-1", source: "manual", bankAccountId: "cta-bancolombia" },
      ADMIN, ROL, TENANT,
    );
    const asiento = await db.collection("ledgerEntries").doc(r.ledgerEntryId).get();
    expect(asiento.data()?.bankAccountId).toBe("cta-bancolombia");
  });

  /**
   * R11 dice «salvo efectivo». Forzar la cuenta obligaría a inventarse una
   * falsa, que es peor que no tener el dato: un `null` se ve, una cuenta
   * inventada se concilia mal y nadie se entera.
   */
  it("sin cuenta —efectivo— queda en `null`, y eso es correcto", async () => {
    await sembrarCuota("cuota-2");
    const r = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-2", amount: 140000, date: "2026-08-20", operationKey: "op-2", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    const asiento = await db.collection("ledgerEntries").doc(r.ledgerEntryId).get();
    expect(asiento.data()?.bankAccountId).toBeNull();
  });

  it("una cuenta que no existe se rechaza", async () => {
    await sembrarCuota("cuota-3");
    await expect(aplicarPago(
      { tenantId: TENANT, statementId: "cuota-3", amount: 1000, date: "2026-08-20", operationKey: "op-3", source: "manual", bankAccountId: "cta-inventada" },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow(/no existe/i);
  });

  /**
   * La comprobación que más importa: un id de otro conjunto escribiría un
   * asiento que **parece** conciliable y no lo es. Es peor que el `null` de
   * antes, porque el `null` se ve.
   */
  it("la cuenta de OTRO conjunto se rechaza", async () => {
    await sembrarCuota("cuota-4");
    await expect(aplicarPago(
      { tenantId: TENANT, statementId: "cuota-4", amount: 1000, date: "2026-08-20", operationKey: "op-4", source: "manual", bankAccountId: "cta-ajena" },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow(/otro conjunto/i);
  });

  it("una cuenta dada de baja no recibe dinero nuevo", async () => {
    await sembrarCuota("cuota-5");
    await expect(aplicarPago(
      { tenantId: TENANT, statementId: "cuota-5", amount: 1000, date: "2026-08-20", operationKey: "op-5", source: "manual", bankAccountId: "cta-cerrada" },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow(/inactiva/i);
  });
});

describe("D-C · el reverso copia la cuenta del asiento que anula", () => {
  /**
   * **Es el segundo de los dos `bankAccountId: null`, y el que la PRD no
   * nombraba.** Arreglar solo el de `aplicarPago` deja el reverso sin cuenta,
   * justo en la operación que más importa cuadrar: la conciliación vería un
   * positivo en una cuenta y un negativo en ninguna.
   */
  it("el reverso lleva la MISMA cuenta que el pago", async () => {
    await sembrarCuota("cuota-rev");
    await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-rev", amount: 140000, date: "2026-08-20", operationKey: "op-rev", source: "manual", bankAccountId: "cta-bancolombia" },
      ADMIN, ROL, TENANT,
    );
    const r = await revertirPago(
      { tenantId: TENANT, operationKey: "op-rev", reversalKey: "rev-1", reason: "Cobro duplicado" },
      ADMIN, ROL, TENANT,
    );
    const reverso = await db.collection("ledgerEntries").doc(r.reversalEntryId).get();
    expect(reverso.data()?.bankAccountId).toBe("cta-bancolombia");
    expect(reverso.data()?.amount).toBe(-140000);
  });

  // Un pago en efectivo revertido no debe estrenar una cuenta que nunca tuvo.
  it("un pago sin cuenta se revierte sin cuenta", async () => {
    await sembrarCuota("cuota-rev2");
    await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-rev2", amount: 140000, date: "2026-08-20", operationKey: "op-rev2", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    const r = await revertirPago(
      { tenantId: TENANT, operationKey: "op-rev2", reversalKey: "rev-2", reason: "Error de registro" },
      ADMIN, ROL, TENANT,
    );
    const reverso = await db.collection("ledgerEntries").doc(r.reversalEntryId).get();
    expect(reverso.data()?.bankAccountId).toBeNull();
  });
});
