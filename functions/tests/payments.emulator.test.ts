import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { esRecaudoDeCartera, aplicarPago, revertirPago } from "../src/payments";
import { cruzarAnticipo, deshacerCruce } from "../src/advances";

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
  for (const c of ["billingStatements", "ledgerEntries", "paymentOperations", "paymentVouchers", "bankAccounts", "tenantSettings", "advances", "advanceApplications", "featureFlagOverrides"]) {
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

/** Crea un anticipo de `sobrante` cobrando de más sobre una cuota auxiliar. */
async function anticipoDe(sobrante: number, sufijo: string) {
  await sembrarCuota(`cuota-origen-${sufijo}`, 100000);
  const r = await aplicarPago(
    { tenantId: TENANT, statementId: `cuota-origen-${sufijo}`, amount: 100000 + sobrante, date: "2026-08-20", operationKey: `op-origen-${sufijo}`, source: "manual" },
    ADMIN, ROL, TENANT,
  );
  return r.advanceId!;
}

describe("R4 · cruzar un anticipo no mueve dinero", () => {
  it("de 60 contra un cargo de 140 lo deja en 80, y el anticipo en cero y `applied` (CA5)", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(60000, "ca5");
    await sembrarCuota("cuota-ca5", 140000);

    const r = await cruzarAnticipo(
      { tenantId: TENANT, advanceId, statementId: "cuota-ca5", amount: 60000, date: "2026-08-21", operationKey: "cruce-ca5" },
      ADMIN, ROL, TENANT,
    );
    expect(r.appliedAmount).toBe(60000);
    expect(r.balance).toBe(80000);
    expect(r.remaining).toBe(0);
    expect(r.advanceStatus).toBe("applied");

    const cuota = (await db.collection("billingStatements").doc("cuota-ca5").get()).data()!;
    expect(cuota.advanceAppliedAmount).toBe(60000);
    // **La otra mitad de R4**: `paymentAmount` no se toca. Es lo que impide que
    // `cuotaIncome` —que es exactamente su suma— cuente el anticipo dos veces.
    expect(cuota.paymentAmount).toBe(0);
  });

  it("no crea ningún asiento nuevo en el libro (CA6)", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(60000, "ca6");
    await sembrarCuota("cuota-ca6", 140000);
    const antes = (await db.collection("ledgerEntries").get()).size;

    await cruzarAnticipo(
      { tenantId: TENANT, advanceId, statementId: "cuota-ca6", amount: 60000, date: "2026-08-21", operationKey: "cruce-ca6" },
      ADMIN, ROL, TENANT,
    );
    expect((await db.collection("ledgerEntries").get()).size).toBe(antes);
  });

  /**
   * **CA6′ — el criterio que la v1.1 no tenía, y sin el cual todo lo demás
   * pasaría en verde con el estado financiero mal.**
   *
   * CA6 comprueba el MECANISMO («no se crea asiento») y es cierto. Pero cruzar
   * subiría `paymentAmount`, y `cuotaIncome` es exactamente la suma de esos
   * `paymentAmount`: el anticipo se contaría al entrar y otra vez al cruzarlo,
   * **sin crear ningún asiento**. El doble conteo no pasa por el libro, que es
   * donde CA6 miraba.
   *
   * Esto mide el NÚMERO: el ingreso total antes y después del cruce, sobre los
   * mismos datos. Tiene que ser idéntico.
   */
  it("el ingreso total del conjunto NO cambia al cruzar", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(60000, "inv");
    await sembrarCuota("cuota-inv2", 140000);

    const antes = await ingresoTotal();
    await cruzarAnticipo(
      { tenantId: TENANT, advanceId, statementId: "cuota-inv2", amount: 60000, date: "2026-08-21", operationKey: "cruce-inv" },
      ADMIN, ROL, TENANT,
    );
    const despues = await ingresoTotal();

    expect(despues.total).toBe(antes.total);
    // Y no por casualidad: ninguno de los dos sumandos se movió.
    expect(despues.cuotaIncome).toBe(antes.cuotaIncome);
    expect(despues.ledgerIncome).toBe(antes.ledgerIncome);
  });

  /**
   * **R6/CF1.** Sin esto, el saldo a favor de una unidad podría pagar la deuda
   * de otra: el dinero de un residente saldaría la cuota de un vecino sin que
   * ninguno de los dos se entere.
   */
  it("contra un cargo de OTRA unidad se deniega (CF1)", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(60000, "cf1");
    await db.collection("billingStatements").doc("cuota-otra-unidad").set({
      tenantId: TENANT, unitId: "unit-999", unitLabel: "999", period: "2026-08",
      amount: 140000, paymentAmount: 0, balance: 140000, status: "pending",
    });
    await expect(cruzarAnticipo(
      { tenantId: TENANT, advanceId, statementId: "cuota-otra-unidad", amount: 60000, date: "2026-08-21", operationKey: "cruce-cf1" },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow(/otra unidad/i);
  });

  // §5.3: se limita al saldo del cargo y el resto sigue en el anticipo. No se
  // rechaza — quien cruza suele querer «lo que haga falta».
  it("cruzar más que el saldo del cargo se limita, y el resto queda en el anticipo", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(200000, "cap");
    await sembrarCuota("cuota-cap", 140000);

    const r = await cruzarAnticipo(
      { tenantId: TENANT, advanceId, statementId: "cuota-cap", amount: 200000, date: "2026-08-21", operationKey: "cruce-cap" },
      ADMIN, ROL, TENANT,
    );
    expect(r.appliedAmount).toBe(140000);
    expect(r.remaining).toBe(60000);
    expect(r.advanceStatus).toBe("open");
    expect(r.status).toBe("paid");
  });

  it("contra un cargo ya saldado no hace nada y lo dice", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(60000, "sal");
    await sembrarCuota("cuota-saldada", 140000);
    await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-saldada", amount: 140000, date: "2026-08-20", operationKey: "op-saldada", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    await expect(cruzarAnticipo(
      { tenantId: TENANT, advanceId, statementId: "cuota-saldada", amount: 60000, date: "2026-08-21", operationKey: "cruce-sal" },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow(/saldo pendiente/i);
  });

  it("reintentar el cruce con la misma clave no lo aplica dos veces", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(60000, "idem");
    await sembrarCuota("cuota-idem", 140000);
    const uno = await cruzarAnticipo(
      { tenantId: TENANT, advanceId, statementId: "cuota-idem", amount: 60000, date: "2026-08-21", operationKey: "cruce-idem" },
      ADMIN, ROL, TENANT,
    );
    const dos = await cruzarAnticipo(
      { tenantId: TENANT, advanceId, statementId: "cuota-idem", amount: 60000, date: "2026-08-21", operationKey: "cruce-idem" },
      ADMIN, ROL, TENANT,
    );
    expect(dos.applied).toBe(false);
    expect(dos.applicationId).toBe(uno.applicationId);
    expect((await db.collection("advanceApplications").get()).size).toBe(1);
  });

  it("con la bandera apagada no se puede cruzar", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(60000, "off");
    await sembrarCuota("cuota-off2", 140000);
    await bandera(false);
    await expect(cruzarAnticipo(
      { tenantId: TENANT, advanceId, statementId: "cuota-off2", amount: 60000, date: "2026-08-21", operationKey: "cruce-off" },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow();
  });
});

describe("CA12 · deshacer un cruce devuelve el anticipo a `open` con su remanente", () => {
  it("lo devuelve entero y el cargo vuelve a deber", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(60000, "ca12");
    await sembrarCuota("cuota-ca12", 140000);
    const cruce = await cruzarAnticipo(
      { tenantId: TENANT, advanceId, statementId: "cuota-ca12", amount: 60000, date: "2026-08-21", operationKey: "cruce-ca12" },
      ADMIN, ROL, TENANT,
    );

    const r = await deshacerCruce(
      { tenantId: TENANT, applicationId: cruce.applicationId, operationKey: "undo-ca12", reason: "Imputado por error" },
      ADMIN, ROL, TENANT,
    );
    expect(r.remaining).toBe(60000);
    expect(r.advanceStatus).toBe("open");
    expect(r.balance).toBe(140000);

    const cuota = (await db.collection("billingStatements").doc("cuota-ca12").get()).data()!;
    expect(cuota.advanceAppliedAmount).toBe(0);
    expect(cuota.status).toBe("pending");
  });

  // Deshacer tampoco mueve dinero: es el cruce al revés.
  it("deshacer tampoco cambia el ingreso total", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(60000, "inv3");
    await sembrarCuota("cuota-inv3", 140000);
    const antes = await ingresoTotal();
    const cruce = await cruzarAnticipo(
      { tenantId: TENANT, advanceId, statementId: "cuota-inv3", amount: 60000, date: "2026-08-21", operationKey: "cruce-inv3" },
      ADMIN, ROL, TENANT,
    );
    await deshacerCruce(
      { tenantId: TENANT, applicationId: cruce.applicationId, operationKey: "undo-inv3" },
      ADMIN, ROL, TENANT,
    );
    expect((await ingresoTotal()).total).toBe(antes.total);
  });

  it("no se puede deshacer dos veces", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(60000, "dos");
    await sembrarCuota("cuota-dos", 140000);
    const cruce = await cruzarAnticipo(
      { tenantId: TENANT, advanceId, statementId: "cuota-dos", amount: 60000, date: "2026-08-21", operationKey: "cruce-dos" },
      ADMIN, ROL, TENANT,
    );
    await deshacerCruce({ tenantId: TENANT, applicationId: cruce.applicationId, operationKey: "undo-dos-1" }, ADMIN, ROL, TENANT);
    await expect(deshacerCruce(
      { tenantId: TENANT, applicationId: cruce.applicationId, operationKey: "undo-dos-2" },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow(/ya se deshizo/i);
  });
});
