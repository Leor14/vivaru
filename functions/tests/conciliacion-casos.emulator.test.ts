import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { aplicarCaso, asegurarCasos, liberarConciliacion, reabrirCaso, rechazarCaso } from "../src/conciliacion-casos";
import { aplicarPago, revertirPago } from "../src/payments";

/**
 * `PRD-V-FLOW-004` — las callables del expediente, **contra una base de verdad**.
 *
 * Existe por lo mismo que `payments.emulator.test.ts`: `conciliacion.test.ts`
 * prueba las reglas puras y **ninguna toca la transacción**. Todo lo que se
 * decide dentro de `runTransaction` —que se escriban las tres colecciones o
 * ninguna, que el caso nazca si no existía, que la cascada suelte la línea— era
 * territorio sin cubrir.
 *
 * **Y la prueba que más importa es la última:** revertir un pago cuyo asiento
 * estaba conciliado. Ese camino escribe con Admin SDK, así que **ninguna regla
 * de Firestore lo mira**; si la cascada no está aquí dentro, no está en ninguna
 * parte y la línea de banco se queda apuntando a un asiento anulado.
 *
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const TENANT = "conjunto-prueba";
const OTRO = "conjunto-ajeno";
const ADMIN = "admin-1";
const ROL = "tenant_admin";
const CUENTA = "cta-bancolombia";

let db: Firestore;

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  db = getFirestore();
});

async function limpiar(col: string) {
  const snap = await db.collection(col).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function sembrarMembresia(tenantId: string, uid = ADMIN) {
  await db.collection("tenantUsers").doc(`${tenantId}_${uid}`).set({ uid, tenantId, role: "tenant_admin", status: "active" });
}

async function sembrarLinea(id: string, over: Record<string, unknown> = {}) {
  await db.collection("bankStatementLines").doc(id).set({
    tenantId: TENANT,
    bankAccountId: CUENTA,
    date: "2026-06-08",
    description: "Mantenimiento bomba de agua",
    amount: -300000,
    reconciled: false,
    matchedLedgerEntryId: null,
    ...over,
  });
}

async function sembrarAsiento(id: string, over: Record<string, unknown> = {}) {
  await db.collection("ledgerEntries").doc(id).set({
    tenantId: TENANT,
    bankAccountId: CUENTA,
    date: "2026-06-08",
    type: "egreso",
    amount: 300000,
    concept: "Mantenimiento",
    sourceType: "manual",
    reconciled: false,
    ...over,
  });
}

const caso = (id: string) => db.collection("reconciliationCases").doc(id);

beforeEach(async () => {
  for (const c of ["bankStatementLines", "ledgerEntries", "reconciliationCases", "billingStatements", "paymentOperations", "paymentVouchers", "tenantSettings", "auditLogs", "bankAccounts", "treasuryTransfers"]) {
    await limpiar(c);
  }
  await sembrarMembresia(TENANT);
  await sembrarMembresia(OTRO);
  await db.collection("bankAccounts").doc(CUENTA).set({ tenantId: TENANT, bankName: "Bancolombia", active: true });
});

describe("CA6 · aplicar escribe las TRES colecciones, o ninguna", () => {
  it("las tres, y el caso nace aunque no existiera", async () => {
    await sembrarLinea("L1");
    await sembrarAsiento("A1");

    const r = await aplicarCaso({ tenantId: TENANT, bankStatementLineId: "L1", ledgerEntryId: "A1" }, ADMIN, ROL);
    expect(r.applied).toBe(true);

    const linea = (await db.collection("bankStatementLines").doc("L1").get()).data();
    const asiento = (await db.collection("ledgerEntries").doc("A1").get()).data();
    const c = (await caso("L1").get()).data();

    expect(linea?.reconciled).toBe(true);
    expect(linea?.matchedLedgerEntryId).toBe("A1");
    expect(asiento?.reconciled).toBe(true);
    expect(asiento?.bankStatementLineId).toBe("L1");
    expect(c?.status).toBe("aplicado");
    expect(c?.version).toBe(1);
    expect(c?.history).toHaveLength(1);
    expect(c?.history?.[0]?.mecanismo).toBe("bandeja");
  });

  it("CF1 · −300.000 contra +40.000 se RECHAZA, y no deja nada a medias", async () => {
    await sembrarLinea("L1");
    await sembrarAsiento("A1", { type: "ingreso", amount: 40000, date: "2026-06-02", bankAccountId: null });

    await expect(
      aplicarCaso({ tenantId: TENANT, bankStatementLineId: "L1", ledgerEntryId: "A1" }, ADMIN, ROL),
    ).rejects.toThrow(/No cuadran/);

    // Lo que importa de «o ninguna»: la base quedó exactamente como estaba.
    expect((await db.collection("bankStatementLines").doc("L1").get()).data()?.reconciled).toBe(false);
    expect((await db.collection("ledgerEntries").doc("A1").get()).data()?.reconciled).toBe(false);
    expect((await caso("L1").get()).exists).toBe(false);
  });

  it("CF1b · misma magnitud, sentido contrario — el caso que solo caza el signo", async () => {
    await sembrarLinea("L1", { amount: -3000, description: "Salida de 3.000" });
    await sembrarAsiento("A1", { type: "ingreso", amount: 3000 });
    await expect(
      aplicarCaso({ tenantId: TENANT, bankStatementLineId: "L1", ledgerEntryId: "A1" }, ADMIN, ROL),
    ).rejects.toThrow(/No cuadran/);
  });

  it("CF3 · un conjunto no toca la línea de otro", async () => {
    await sembrarLinea("L1");
    await sembrarAsiento("A1");
    await expect(
      aplicarCaso({ tenantId: OTRO, bankStatementLineId: "L1", ledgerEntryId: "A1" }, ADMIN, ROL),
    ).rejects.toThrow(/otro conjunto/);
  });

  it("CF7 · una versión desactualizada no aplica", async () => {
    await sembrarLinea("L1");
    await sembrarAsiento("A1");
    await expect(
      aplicarCaso({ tenantId: TENANT, bankStatementLineId: "L1", ledgerEntryId: "A1", expectedVersion: 7 }, ADMIN, ROL),
    ).rejects.toThrow(/movió este caso/);
  });

  it("CF8 · contra un asiento anulado, no", async () => {
    await sembrarLinea("L1");
    await sembrarAsiento("A1", { reversedByEntryId: "R1" });
    await expect(
      aplicarCaso({ tenantId: TENANT, bankStatementLineId: "L1", ledgerEntryId: "A1" }, ADMIN, ROL),
    ).rejects.toThrow(/anulado/);
  });

  it("R10 · aplicar dos veces lo mismo no duplica ni sube la versión", async () => {
    await sembrarLinea("L1");
    await sembrarAsiento("A1");
    await aplicarCaso({ tenantId: TENANT, bankStatementLineId: "L1", ledgerEntryId: "A1" }, ADMIN, ROL);
    const segunda = await aplicarCaso({ tenantId: TENANT, bankStatementLineId: "L1", ledgerEntryId: "A1" }, ADMIN, ROL);

    expect(segunda.applied).toBe(false);
    const c = (await caso("L1").get()).data();
    expect(c?.version).toBe(1);
    expect(c?.history).toHaveLength(1);
  });

  it("una línea ya conciliada con OTRO movimiento no se pisa", async () => {
    await sembrarLinea("L1");
    await sembrarAsiento("A1");
    await sembrarAsiento("A2");
    await aplicarCaso({ tenantId: TENANT, bankStatementLineId: "L1", ledgerEntryId: "A1" }, ADMIN, ROL);
    await expect(
      aplicarCaso({ tenantId: TENANT, bankStatementLineId: "L1", ledgerEntryId: "A2" }, ADMIN, ROL),
    ).rejects.toThrow(/ya está conciliada/);
  });
});

describe("R6 · rechazar exige motivo, y reabrir deshace", () => {
  it("CF6 · sin motivo del catálogo no se escribe", async () => {
    await sembrarLinea("L1");
    await expect(
      rechazarCaso({ tenantId: TENANT, bankStatementLineId: "L1", motivoCodigo: "inventado" as never }, ADMIN, ROL),
    ).rejects.toThrow(/motivo/);
    expect((await caso("L1").get()).exists).toBe(false);
  });

  it("con motivo, el caso queda rechazado y el motivo queda escrito", async () => {
    await sembrarLinea("L1", { amount: -180, description: "Comisión bancaria mensual" });
    await rechazarCaso({ tenantId: TENANT, bankStatementLineId: "L1", motivoCodigo: "comision_bancaria" }, ADMIN, ROL);
    const c = (await caso("L1").get()).data();
    expect(c?.status).toBe("rechazado");
    expect(c?.motivoCodigo).toBe("comision_bancaria");
  });

  it("reabrir un caso aplicado suelta las dos puntas", async () => {
    await sembrarLinea("L1");
    await sembrarAsiento("A1");
    await aplicarCaso({ tenantId: TENANT, bankStatementLineId: "L1", ledgerEntryId: "A1" }, ADMIN, ROL);
    await reabrirCaso({ tenantId: TENANT, bankStatementLineId: "L1" }, ADMIN, ROL);

    expect((await db.collection("bankStatementLines").doc("L1").get()).data()?.reconciled).toBe(false);
    expect((await db.collection("ledgerEntries").doc("A1").get()).data()?.reconciled).toBe(false);
    const c = (await caso("L1").get()).data();
    expect(c?.status).toBe("detectado");
    expect(c?.version).toBe(2);
    expect(c?.history).toHaveLength(2);
  });
});

describe("CA7 · R7, la cascada — el camino que NINGUNA regla vigila", () => {
  async function pagoConciliado() {
    await db.collection("billingStatements").doc("C1").set({
      tenantId: TENANT, unitId: "unit-101", unitLabel: "101", period: "2026-06",
      concept: "administracion", amount: 3000, paymentAmount: 0, balance: 3000,
      dueDate: "2026-06-30", status: "pending",
    });
    const pago = await aplicarPago(
      { tenantId: TENANT, statementId: "C1", amount: 3000, date: "2026-06-08", operationKey: "op-1", source: "manual", bankAccountId: CUENTA },
      ADMIN, ROL,
    );
    const asientoId = pago.ledgerEntryId as string;
    await sembrarLinea("L1", { amount: 3000, description: "SPEI recibido — T1-101" });
    await aplicarCaso({ tenantId: TENANT, bankStatementLineId: "L1", ledgerEntryId: asientoId }, ADMIN, ROL);
    return asientoId;
  }

  it("revertir el pago suelta la línea y deja el caso en `reversado` con motivo automático", async () => {
    const asientoId = await pagoConciliado();
    // Que de verdad estaba conciliado antes: si no, lo de abajo no prueba nada.
    expect((await db.collection("bankStatementLines").doc("L1").get()).data()?.reconciled).toBe(true);

    await revertirPago(
      { tenantId: TENANT, operationKey: "op-1", reversalKey: "rev-1", reason: "cheque devuelto" },
      ADMIN, ROL,
    );

    const linea = (await db.collection("bankStatementLines").doc("L1").get()).data();
    const asiento = (await db.collection("ledgerEntries").doc(asientoId).get()).data();
    const c = (await caso("L1").get()).data();

    expect(linea?.reconciled).toBe(false);
    expect(linea?.matchedLedgerEntryId).toBeNull();
    expect(asiento?.reversedByEntryId).toBeTruthy();
    expect(asiento?.reconciled).toBe(false);
    expect(c?.status).toBe("reversado");
    expect(c?.motivoCodigo).toBe("reverso_del_asiento");
    expect(c?.history?.at(-1)?.mecanismo).toBe("cascada_reverso");
  });

  it("y el caso vuelve a la bandeja: se puede aplicar otra vez", async () => {
    await pagoConciliado();
    await revertirPago({ tenantId: TENANT, operationKey: "op-1", reversalKey: "rev-1", reason: "cheque devuelto" }, ADMIN, ROL);
    await sembrarAsiento("A9", { type: "ingreso", amount: 3000 });
    const r = await aplicarCaso({ tenantId: TENANT, bankStatementLineId: "L1", ledgerEntryId: "A9" }, ADMIN, ROL);
    expect(r.applied).toBe(true);
    expect((await caso("L1").get()).data()?.status).toBe("aplicado");
  });

  it("revertir un pago NO conciliado no toca ninguna línea ni inventa un caso", async () => {
    await db.collection("billingStatements").doc("C1").set({
      tenantId: TENANT, unitId: "unit-101", unitLabel: "101", period: "2026-06",
      concept: "administracion", amount: 3000, paymentAmount: 0, balance: 3000,
      dueDate: "2026-06-30", status: "pending",
    });
    await aplicarPago({ tenantId: TENANT, statementId: "C1", amount: 3000, date: "2026-06-08", operationKey: "op-2", source: "manual", bankAccountId: CUENTA }, ADMIN, ROL);
    await revertirPago({ tenantId: TENANT, operationKey: "op-2", reversalKey: "rev-2", reason: "error" }, ADMIN, ROL);
    expect((await db.collection("reconciliationCases").get()).size).toBe(0);
  });

  it("el camino del cliente: `liberarConciliacion` suelta las dos puntas", async () => {
    await sembrarLinea("L1");
    await sembrarAsiento("A1");
    await aplicarCaso({ tenantId: TENANT, bankStatementLineId: "L1", ledgerEntryId: "A1" }, ADMIN, ROL);

    const r = await liberarConciliacion({ tenantId: TENANT, ledgerEntryId: "A1" }, ADMIN, ROL);
    expect(r.released).toBe(true);
    expect((await db.collection("bankStatementLines").doc("L1").get()).data()?.reconciled).toBe(false);
    expect((await db.collection("ledgerEntries").doc("A1").get()).data()?.reconciled).toBe(false);
    expect((await caso("L1").get()).data()?.status).toBe("reversado");
  });

  it("sobre un asiento que no estaba conciliado no hace nada, y lo dice", async () => {
    await sembrarAsiento("A1");
    const r = await liberarConciliacion({ tenantId: TENANT, ledgerEntryId: "A1" }, ADMIN, ROL);
    expect(r.released).toBe(false);
  });
});

describe("CA1 · el expediente nace con la línea", () => {
  /**
   * **El criterio que no se cumplía, y se descubrió con la ficha ya
   * desplegada.** Importar escribía la línea y nada más. No se veía —la bandeja
   * agrupa mirando líneas y asientos— pero «100% de las líneas con expediente»
   * dejaba de ser cierto en la siguiente carga.
   */
  it("crea el caso de cada línea que no lo tenga, y lo clasifica", async () => {
    await sembrarLinea("L1");
    await sembrarLinea("L2", { amount: 3000, description: "SPEI T1-101", date: "2026-06-10" });
    await sembrarAsiento("A1");

    const r = await asegurarCasos({ tenantId: TENANT, bankAccountId: CUENTA }, ADMIN, ROL);
    expect(r.created).toBe(2);
    expect(r.lines).toBe(2);
    expect(r.truncated).toBe(false);

    // L1 tiene su asiento coherente: propuesto. L2 no tiene ninguno.
    expect((await caso("L1").get()).data()?.status).toBe("propuesto");
    expect((await caso("L2").get()).data()?.excepcion).toBe("sin_contraparte");
    expect((await caso("L1").get()).data()?.history?.[0]?.mecanismo).toBe("importacion");
  });

  it("es idempotente: reimportar no crea nada ni pisa lo decidido", async () => {
    await sembrarLinea("L1");
    await sembrarAsiento("A1");
    await aplicarCaso({ tenantId: TENANT, bankStatementLineId: "L1", ledgerEntryId: "A1" }, ADMIN, ROL);

    const r = await asegurarCasos({ tenantId: TENANT, bankAccountId: CUENTA }, ADMIN, ROL);
    expect(r.created).toBe(0);
    // Y lo importante: el caso conserva su versión y su historia.
    const c = (await caso("L1").get()).data();
    expect(c?.status).toBe("aplicado");
    expect(c?.version).toBe(1);
    expect(c?.history).toHaveLength(1);
  });

  it("una línea conciliada nace `aplicado` con sus incoherencias si el par no cuadra", async () => {
    await sembrarLinea("L1", { reconciled: true, matchedLedgerEntryId: "A1" });
    await sembrarAsiento("A1", { type: "ingreso", amount: 40000, date: "2026-06-02", reconciled: true });
    await asegurarCasos({ tenantId: TENANT }, ADMIN, ROL);
    const c = (await caso("L1").get()).data();
    expect(c?.status).toBe("aplicado");
    expect(c?.incoherencias).toEqual(["signo", "monto", "fecha"]);
  });

  it("y si apunta a un asiento que YA NO existe, no nace `aplicado` mintiendo", async () => {
    await sembrarLinea("L1", { reconciled: true, matchedLedgerEntryId: "A-borrado" });
    await asegurarCasos({ tenantId: TENANT }, ADMIN, ROL);
    expect((await caso("L1").get()).data()?.status).toBe("detectado");
  });

  it("no toca las líneas de otro conjunto", async () => {
    await sembrarLinea("L1");
    await db.collection("bankStatementLines").doc("L-ajena").set({
      tenantId: OTRO, bankAccountId: CUENTA, date: "2026-06-08", description: "x", amount: 1, reconciled: false,
    });
    const r = await asegurarCasos({ tenantId: TENANT }, ADMIN, ROL);
    expect(r.lines).toBe(1);
    expect((await caso("L-ajena").get()).exists).toBe(false);
  });

  it("y no deja las líneas como las encontró... salvo que sí: no las toca", async () => {
    await sembrarLinea("L1");
    await asegurarCasos({ tenantId: TENANT }, ADMIN, ROL);
    const l = (await db.collection("bankStatementLines").doc("L1").get()).data();
    expect(l?.reconciled).toBe(false);
    expect(l?.matchedLedgerEntryId).toBeNull();
  });
});

describe("`PRD-V-FEAT-010` 2b · `CA7` · los tramos de un traspaso", () => {
  const CUENTA_B = "cta-ahorros";
  const traspasoDoc = (id: string) => db.collection("treasuryTransfers").doc(id);
  const lineaDoc = (id: string) => db.collection("bankStatementLines").doc(id);

  async function sembrarTraspaso(id = "TR1", over: Record<string, unknown> = {}) {
    await traspasoDoc(id).set({
      tenantId: TENANT,
      fromAccountId: CUENTA,
      toAccountId: CUENTA_B,
      amount: 300000,
      date: "2026-06-08",
      kind: "traspaso",
      status: "registrado",
      ...over,
    });
  }
  const aplicarTramo = (linea: string, tramo: "salida" | "entrada", traspaso = "TR1") =>
    aplicarCaso({ tenantId: TENANT, bankStatementLineId: linea, treasuryTransferId: traspaso, tramo }, ADMIN, ROL);

  beforeEach(async () => {
    await db.collection("bankAccounts").doc(CUENTA_B).set({ tenantId: TENANT, bankName: "Bancolombia", active: true });
    await sembrarTraspaso();
    await sembrarLinea("LA", { amount: -300000, description: "TRASPASO A AHORROS" });
    await sembrarLinea("LB", { bankAccountId: CUENTA_B, amount: 300000, description: "TRASPASO DE CORRIENTE" });
  });

  it("la salida casa con la línea de A y la entrada con la de B — y el libro no se entera", async () => {
    expect((await aplicarTramo("LA", "salida")).applied).toBe(true);
    expect((await aplicarTramo("LB", "entrada")).applied).toBe(true);

    expect((await lineaDoc("LA").get()).data()).toMatchObject({ reconciled: true, matchedLedgerEntryId: null, matchedTransferId: "TR1", matchedTransferLeg: "salida" });
    expect((await lineaDoc("LB").get()).data()).toMatchObject({ reconciled: true, matchedTransferId: "TR1", matchedTransferLeg: "entrada" });
    expect((await traspasoDoc("TR1").get()).data()).toMatchObject({ salidaLineId: "LA", entradaLineId: "LB", status: "registrado" });
    expect((await caso("LA").get()).data()).toMatchObject({ status: "aplicado", matchedLedgerEntryId: null, matchedTransferId: "TR1", matchedTransferLeg: "salida" });
    expect((await db.collection("ledgerEntries").get()).size).toBe(0);
  });

  it("cruzados, no: la entrada no está en el extracto de A — y no deja nada a medias", async () => {
    await expect(aplicarTramo("LA", "entrada")).rejects.toThrow(/no entra en esta cuenta/);
    expect((await lineaDoc("LA").get()).data()?.reconciled).toBe(false);
    expect((await traspasoDoc("TR1").get()).data()?.entradaLineId).toBeUndefined();
    expect((await caso("LA").get()).exists).toBe(false);
  });

  it("el sentido y el importe cuentan: +300.000 en A no es la salida", async () => {
    await sembrarLinea("LA+", { amount: 300000 });
    await expect(aplicarTramo("LA+", "salida")).rejects.toThrow(/No cuadran/);
  });

  it("un traspaso anulado, o de otro conjunto, no casa", async () => {
    await sembrarTraspaso("TR-anulado", { status: "anulado" });
    await expect(aplicarTramo("LA", "salida", "TR-anulado")).rejects.toThrow(/anulado/);
    await sembrarTraspaso("TR-ajeno", { tenantId: OTRO });
    await expect(aplicarTramo("LA", "salida", "TR-ajeno")).rejects.toThrow(/otro conjunto/);
  });

  it("un tramo ya conciliado no casa con una segunda línea", async () => {
    await aplicarTramo("LA", "salida");
    await sembrarLinea("LA2", { amount: -300000, description: "OTRA LINEA" });
    await expect(aplicarTramo("LA2", "salida")).rejects.toThrow(/ya fue conciliado/);
  });

  it("R10 · dos veces lo mismo no duplica ni sube la versión", async () => {
    await aplicarTramo("LA", "salida");
    expect((await aplicarTramo("LA", "salida")).applied).toBe(false);
    expect((await caso("LA").get()).data()?.version).toBe(1);
  });

  it("con un asiento Y un traspaso a la vez, se niega", async () => {
    await sembrarAsiento("A1");
    await expect(
      aplicarCaso({ tenantId: TENANT, bankStatementLineId: "LA", ledgerEntryId: "A1", treasuryTransferId: "TR1", tramo: "salida" }, ADMIN, ROL),
    ).rejects.toThrow(/no con los dos/);
  });

  it("reabrir suelta el tramo también en el traspaso", async () => {
    await aplicarTramo("LA", "salida");
    await reabrirCaso({ tenantId: TENANT, bankStatementLineId: "LA" }, ADMIN, ROL);
    expect((await lineaDoc("LA").get()).data()).toMatchObject({ reconciled: false, matchedTransferId: null, matchedTransferLeg: null });
    expect((await traspasoDoc("TR1").get()).data()?.salidaLineId).toBeNull();
    expect((await caso("LA").get()).data()?.status).toBe("detectado");
  });

  it("anular: `liberarConciliacion` suelta los DOS tramos y deja cada caso en `reversado` con su motivo", async () => {
    await aplicarTramo("LA", "salida");
    await aplicarTramo("LB", "entrada");
    expect((await liberarConciliacion({ tenantId: TENANT, treasuryTransferId: "TR1" }, ADMIN, ROL)).released).toBe(true);

    expect((await traspasoDoc("TR1").get()).data()).toMatchObject({ salidaLineId: null, entradaLineId: null });
    for (const id of ["LA", "LB"]) {
      expect((await lineaDoc(id).get()).data()).toMatchObject({ reconciled: false, matchedTransferId: null });
      expect((await caso(id).get()).data()).toMatchObject({ status: "reversado", motivoCodigo: "traspaso_anulado" });
    }
  });

  /**
   * El id de una línea se deriva de su contenido: borrada a mano y reimportada,
   * vuelve con el MISMO id. Si entretanto casó con un asiento, el traspaso sigue
   * apuntándole — y anular el traspaso no puede soltar esa conciliación ajena.
   */
  it("liberar NO suelta una línea que ya apunta a otra cosa, aunque el traspaso la nombre", async () => {
    await sembrarAsiento("A1", { reconciled: true, bankStatementLineId: "LA" });
    await lineaDoc("LA").set({ reconciled: true, matchedLedgerEntryId: "A1" }, { merge: true });
    await traspasoDoc("TR1").set({ salidaLineId: "LA" }, { merge: true });

    expect((await liberarConciliacion({ tenantId: TENANT, treasuryTransferId: "TR1" }, ADMIN, ROL)).released).toBe(true);
    expect((await lineaDoc("LA").get()).data()).toMatchObject({ reconciled: true, matchedLedgerEntryId: "A1" });
    expect((await caso("LA").get()).exists).toBe(false);
    expect((await traspasoDoc("TR1").get()).data()?.salidaLineId).toBeNull();
  });

  it("sin tramos conciliados, liberar no hace nada, y lo dice", async () => {
    expect((await liberarConciliacion({ tenantId: TENANT, treasuryTransferId: "TR1" }, ADMIN, ROL)).released).toBe(false);
  });

  it("`CA1` · el expediente de una línea con un solo tramo que cuadra nace propuesto", async () => {
    await asegurarCasos({ tenantId: TENANT, bankAccountId: CUENTA_B }, ADMIN, ROL);
    expect((await caso("LB").get()).data()).toMatchObject({ status: "propuesto", candidateLedgerEntryIds: [], candidateTransferLegs: ["TR1:entrada"] });
  });
});
