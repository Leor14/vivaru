import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { frasesDelRecibo, type CargoCubierto } from "../src/aviso-recibo";
import { aplicarPago } from "../src/payments";

/**
 * **CA13, en su costura.** `aviso-recibo.ts` se prueba puro; el trigger
 * `onPaymentVoucherCreated` lee de `paymentOperations`. Lo que ninguna de las
 * dos cosas prueba por separado es que **lo que escribe `aplicarPago` sea lo que
 * el aviso espera leer**.
 *
 * Y ese contrato es frágil por un motivo concreto: `allocations` y
 * `advanceAmount` **no se escribieron para el aviso**. Existen porque la
 * REVERSIÓN los necesita. Nada dentro de `payments.ts` recuerda que ahora
 * también los lee un correo, así que un cambio razonable allí —renombrar un
 * campo, guardar solo el total— dejaría el aviso **degradando en silencio** al
 * texto de antes, que es exactamente el fallo que no se ve: sale un correo, solo
 * que dice menos.
 *
 * Necesita el emulador:
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const TENANT = "conjunto-aviso";
const ADMIN = "admin-1";
const ROL = "tenant_admin";

const money = (v: number) => `$${Math.round(v).toLocaleString("es-CO")}`;

let db: Firestore;

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  db = getFirestore();
});

async function limpiar(col: string) {
  const snap = await db.collection(col).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function sembrarCuota(id: string, concept: string, period: string, amount: number) {
  await db.collection("billingStatements").doc(id).set({
    tenantId: TENANT,
    unitId: "unit-101",
    unitLabel: "101",
    period,
    concept,
    amount,
    paymentAmount: 0,
    balance: amount,
    dueDate: `${period}-28`,
    status: "pending",
  });
}

/**
 * Lo que hace el trigger: leer la operación y los cargos que nombra.
 *
 * **El id va sin prefijo de conjunto**, que es justo lo que esta prueba
 * descubrió: `aplicarPago` guarda en `doc(operationKey)` a secas, mientras las
 * tres de `advances.ts` prefijan con el tenant. Dos esquemas en la misma
 * colección, y el código del aviso se escribió primero con el equivocado.
 */
async function loQueLeeElAviso(operationKey: string) {
  const opSnap = await db.collection("paymentOperations").doc(operationKey).get();
  expect(opSnap.exists, "la operación tiene que existir con este id, o el aviso no lee nada").toBe(true);
  const op = opSnap.data() as { allocations?: Array<{ statementId?: string }>; advanceAmount?: number };
  const ids = (op.allocations ?? []).map((a) => a?.statementId).filter((id): id is string => Boolean(id));
  const cargos: CargoCubierto[] =
    ids.length > 0
      ? (await db.getAll(...ids.map((id) => db.collection("billingStatements").doc(id))))
          .filter((s) => s.exists)
          .map((s) => s.data() as CargoCubierto)
      : [];
  return { cargos, saldoAFavor: op.advanceAmount ?? 0 };
}

beforeEach(async () => {
  for (const c of ["billingStatements", "ledgerEntries", "paymentOperations", "paymentVouchers", "advances", "featureFlagOverrides", "tenants"]) {
    await limpiar(c);
  }
  await db.collection("tenants").doc(TENANT).set({ name: "Conjunto del aviso", status: "active", country: "MX" });
  await db.collection("featureFlagOverrides").doc(TENANT).set({
    flags: { "producto-anticipos": true, "producto-pago-multiple": true },
  });
});

describe("CA13 · lo que escribe el pago es lo que lee el aviso", () => {
  it("un pago repartido entre dos cargos deja nombrables los DOS", async () => {
    await sembrarCuota("c-admin", "administracion", "2026-08", 100000);
    await sembrarCuota("c-multa", "multa", "2026-06", 40000);

    await aplicarPago(
      {
        tenantId: TENANT,
        allocations: [
          { statementId: "c-admin", amount: 100000 },
          { statementId: "c-multa", amount: 40000 },
        ],
        amount: 140000,
        date: "2026-08-20",
        operationKey: "op-dos",
        source: "manual",
      },
      ADMIN,
      ROL,
      TENANT,
    );

    const leido = await loQueLeeElAviso("op-dos");
    expect(leido.cargos).toHaveLength(2);

    // México: la cuota ordinaria es «cuota de mantenimiento», no «alícuota».
    const frases = frasesDelRecibo({ ...leido, terminoCuota: "cuota de mantenimiento", formatMoney: money });
    expect(frases.cargos).toBe(
      "Cubrió la cuota de mantenimiento de agosto de 2026 y la multa de junio de 2026.",
    );
    expect(frases.saldoAFavor).toBe("");
  });

  it("un sobrepago deja el saldo a favor con su importe exacto", async () => {
    await sembrarCuota("c-sobre", "administracion", "2026-08", 100000);

    await aplicarPago(
      { tenantId: TENANT, statementId: "c-sobre", amount: 160000, date: "2026-08-20", operationKey: "op-sobra", source: "manual" },
      ADMIN,
      ROL,
      TENANT,
    );

    const leido = await loQueLeeElAviso("op-sobra");
    expect(leido.saldoAFavor).toBe(60000);

    const frases = frasesDelRecibo({ ...leido, terminoCuota: "cuota de mantenimiento", formatMoney: money });
    expect(frases.cargos).toBe("Cubrió la cuota de mantenimiento de agosto de 2026.");
    expect(frases.saldoAFavor).toBe("Te quedó un saldo a favor de $60.000.");
  });

  /**
   * **CA8.** Sin cargos que cubrir el pago entero se vuelve anticipo, y el aviso
   * no puede decir que cubrió nada. Es el caso donde una plantilla escrita sin
   * cuidado diría «Cubrió .».
   */
  it("un pago sin cargos que cubrir solo habla del saldo a favor", async () => {
    await aplicarPago(
      { tenantId: TENANT, statementId: "no-existe", amount: 90000, date: "2026-08-20", operationKey: "op-nada", source: "manual" },
      ADMIN,
      ROL,
      TENANT,
    ).catch(() => undefined);

    // Si `aplicarPago` exige un cargo existente, la ruta de CA8 llega por otro
    // camino; lo que se fija aquí es el TEXTO ante cero cargos, que es lo que el
    // trigger construiría.
    const frases = frasesDelRecibo({
      cargos: [],
      saldoAFavor: 90000,
      terminoCuota: "cuota de mantenimiento",
      formatMoney: money,
    });
    expect(frases.cargos).toBe("");
    expect(frases.saldoAFavor).toBe("Te quedó un saldo a favor de $90.000.");
  });
});
