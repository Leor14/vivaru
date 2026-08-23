import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { esRecaudoDeCartera, aplicarPago, revertirPago } from "../src/payments";

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

/** Enciende o apaga `producto-anticipos` para este conjunto, por override. */
async function bandera(encendida: boolean) {
  await db.collection("featureFlagOverrides").doc(TENANT).set({ flags: { "producto-anticipos": encendida } });
}

/** El ingreso total tal y como lo calcula el producto: Cartera + libro. */
async function ingresoTotal() {
  const cargos = await db.collection("billingStatements").where("tenantId", "==", TENANT).get();
  const cuotaIncome = cargos.docs.reduce((s, d) => s + (d.data().paymentAmount ?? 0), 0);
  const libro = await db.collection("ledgerEntries").where("tenantId", "==", TENANT).get();
  const ledgerIncome = libro.docs
    .map((d) => d.data())
    .filter((e) => e.type === "ingreso" && !esRecaudoDeCartera(e))
    .reduce((s, e) => s + (e.amount ?? 0), 0);
  return { cuotaIncome, ledgerIncome, total: cuotaIncome + ledgerIncome };
}

beforeEach(async () => {
  for (const c of ["billingStatements", "ledgerEntries", "paymentOperations", "paymentVouchers", "bankAccounts", "tenantSettings", "advances", "featureFlagOverrides"]) {
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

describe("D-A · con la bandera APAGADA no cambia un solo número", () => {
  /**
   * **«Inerte» es una predicción, no un hecho.** Se demuestra corriendo el
   * comportamiento viejo y el nuevo sobre los mismos datos y contando qué
   * cambia de lado — no leyendo el código y asintiendo.
   *
   * Es lo único que hace seguro desplegar esto a producción sin encender nada.
   */
  it("pagar 200 sobre una cuota de 140 se sigue contabilizando entero, como hasta hoy", async () => {
    await bandera(false);
    await sembrarCuota("cuota-off", 140000);
    const r = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-off", amount: 200000, date: "2026-08-20", operationKey: "op-off", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    expect(r.paymentAmount).toBe(200000);
    expect(r.balance).toBe(0);
    expect(r.status).toBe("paid");
    expect(r.advanceId).toBeUndefined();
    expect((await db.collection("advances").get()).size).toBe(0);
  });
});

describe("D-A · el sobrepago deja de evaporarse", () => {
  it("pagar 200 sobre 140 deja la cuota pagada y un anticipo de 60 (CA1)", async () => {
    await bandera(true);
    await sembrarCuota("cuota-a", 140000);
    const r = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-a", amount: 200000, date: "2026-08-20", operationKey: "op-a", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    expect(r.paymentAmount).toBe(140000);
    expect(r.status).toBe("paid");
    expect(r.advanceAmount).toBe(60000);

    const adv = await db.collection("advances").doc(r.advanceId!).get();
    expect(adv.data()).toMatchObject({ amount: 60000, remaining: 60000, origin: "overpayment", status: "open", unitId: "unit-101" });
  });

  /** **R1**: ni un céntimo se pierde ni se inventa. */
  it("lo aplicado más el anticipo es EXACTAMENTE lo pagado (CA4)", async () => {
    await bandera(true);
    await sembrarCuota("cuota-r1", 140000);
    const r = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-r1", amount: 200000, date: "2026-08-20", operationKey: "op-r1", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    expect(r.paymentAmount + (r.advanceAmount ?? 0)).toBe(200000);
  });

  /** **R3**: un anticipo de importe cero no se crea. */
  it("pagar el importe exacto NO crea un anticipo de cero", async () => {
    await bandera(true);
    await sembrarCuota("cuota-r3", 140000);
    const r = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-r3", amount: 140000, date: "2026-08-20", operationKey: "op-r3", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    expect(r.advanceId).toBeUndefined();
    expect((await db.collection("advances").get()).size).toBe(0);
  });

  /** **CA8**: un pago sin nada pendiente se convierte íntegro en anticipo. */
  it("pagar sobre una cuota ya saldada va entero al anticipo", async () => {
    await bandera(true);
    await sembrarCuota("cuota-ca8", 140000);
    await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-ca8", amount: 140000, date: "2026-08-20", operationKey: "op-ca8-1", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    const r = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-ca8", amount: 50000, date: "2026-08-21", operationKey: "op-ca8-2", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    expect(r.advanceAmount).toBe(50000);
    expect(r.paymentAmount).toBe(140000);
  });

  /**
   * **R10, y es el peor fallo posible de esta ficha**: que un reintento de red
   * duplique el saldo a favor de un residente.
   */
  it("reintentar con la misma clave devuelve el MISMO anticipo (CA9)", async () => {
    await bandera(true);
    await sembrarCuota("cuota-r10", 140000);
    const uno = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-r10", amount: 200000, date: "2026-08-20", operationKey: "op-r10", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    const dos = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-r10", amount: 200000, date: "2026-08-20", operationKey: "op-r10", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    expect(dos.applied).toBe(false);
    expect(dos.advanceId).toBe(uno.advanceId);
    expect((await db.collection("advances").get()).size).toBe(1);
  });
});

describe("§7.4 · el asiento del anticipo NO hereda el origen del cobro", () => {
  /**
   * **La trampa de la ficha, y la razón de que exista `sourceType: "advance"`.**
   * Si el asiento heredara `"billingStatement"`, `esRecaudoDeCartera` lo
   * excluiría del libro aunque su categoría dijera `anticipo`, y como el
   * anticipo tampoco está en `cuotaIncome` —eso suma `paymentAmount` de cargos,
   * y un anticipo no es de ningún cargo— se descontaría de un lado sin estar
   * sumado en el otro. Desaparecería.
   */
  it("lleva `sourceType: \"advance\"` y `category: \"anticipo\"` (CA7)", async () => {
    await bandera(true);
    await sembrarCuota("cuota-74", 140000);
    const r = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-74", amount: 200000, date: "2026-08-20", operationKey: "op-74", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    const adv = (await db.collection("advances").doc(r.advanceId!).get()).data()!;
    const asiento = (await db.collection("ledgerEntries").doc(adv.ledgerEntryId).get()).data()!;
    expect(asiento.sourceType).toBe("advance");
    expect(asiento.category).toBe("anticipo");
    expect(asiento.amount).toBe(60000);
    // Lo que de verdad importa: la exclusión NO lo atrapa.
    expect(esRecaudoDeCartera(asiento)).toBe(false);
  });

  /**
   * **CA6′ — el criterio que mide el NÚMERO y no el mecanismo.**
   *
   * El ingreso total del conjunto tiene que ser exactamente lo que entró: 200.
   * Repartido en 140 por Cartera y 60 por el libro, pero 200. Si el asiento del
   * anticipo heredara el origen, este total daría 140 y los 60 no estarían en
   * ninguna parte — con todas las demás pruebas en verde.
   */
  it("el ingreso total es lo que entró: ni más, ni menos", async () => {
    await bandera(true);
    await sembrarCuota("cuota-inv", 140000);
    await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-inv", amount: 200000, date: "2026-08-20", operationKey: "op-inv", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    const { cuotaIncome, ledgerIncome, total } = await ingresoTotal();
    expect(cuotaIncome).toBe(140000);
    expect(ledgerIncome).toBe(60000);
    expect(total).toBe(200000);
  });

  // El asiento del cobro baja a lo aplicado: si dijera 200 donde Cartera contó
  // 140, la fila del libro y la cartera contarían cosas distintas.
  it("el asiento del cobro vale lo aplicado al cargo, no lo pagado", async () => {
    await bandera(true);
    await sembrarCuota("cuota-asi", 140000);
    const r = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-asi", amount: 200000, date: "2026-08-20", operationKey: "op-asi", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    const asiento = (await db.collection("ledgerEntries").doc(r.ledgerEntryId).get()).data()!;
    expect(asiento.amount).toBe(140000);
    expect(asiento.sourceType).toBe("billingStatement");
  });
});

describe("R15 · revertir un pago con anticipo se BLOQUEA, no se adivina", () => {
  /**
   * Todavía no está construido revertir el anticipo junto con el pago (va en
   * 2.5). Dejar pasar la reversión escribiría el descuadre: el residente
   * conservaría un saldo a favor **de un dinero ya devuelto**. Se bloquea con un
   * mensaje que dice qué hacer.
   */
  it("lo dice y no lo hace", async () => {
    await bandera(true);
    await sembrarCuota("cuota-r15", 140000);
    await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-r15", amount: 200000, date: "2026-08-20", operationKey: "op-r15", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    await expect(revertirPago(
      { tenantId: TENANT, operationKey: "op-r15", reversalKey: "rev-r15", reason: "Error" },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow(/saldo a favor/i);
  });

  // Un pago SIN anticipo se sigue revirtiendo con normalidad: el bloqueo mira el
  // anticipo, no la bandera.
  it("un pago sin anticipo se revierte igual que siempre", async () => {
    await bandera(true);
    await sembrarCuota("cuota-r15b", 140000);
    await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-r15b", amount: 140000, date: "2026-08-20", operationKey: "op-r15b", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    const r = await revertirPago(
      { tenantId: TENANT, operationKey: "op-r15b", reversalKey: "rev-r15b", reason: "Error" },
      ADMIN, ROL, TENANT,
    );
    expect(r.reversed).toBe(true);
    expect(r.paymentAmount).toBe(0);
  });
});
