import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { esRecaudoDeCartera, aplicarPago, revertirPago } from "../src/payments";
import { anularAnticipo, cruzarAnticipo, deshacerCruce } from "../src/advances";

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
async function bandera(encendida: boolean, multiple = true) {
  await db.collection("featureFlagOverrides").doc(TENANT).set({
    flags: { "producto-anticipos": encendida, "producto-pago-multiple": multiple },
  });
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

describe("D-A · con la bandera apagada NO puede nacer un anticipo por la puerta del reparto", () => {
  /**
   * **El agujero que tapa esto.** La prueba de arriba usa la forma vieja
   * —`statementId` + `amount`—, donde la única línea vale `monto` y el sobrante
   * sale cero solo. Por eso el comentario de `aplicarPago` podía decir «cero por
   * construcción» y ser cierto: **nadie había probado la otra forma**.
   *
   * Con `allocations` que sumen menos que lo pagado —cosa que R7 permite a
   * propósito— `sobrante > 0`, y el bloque del anticipo no miraba la bandera.
   * Medido el 24 de agosto de 2026 antes de arreglarlo: nacía un anticipo de
   * 60.000 **inoperable**, porque las tres callables de `advances.ts` sí exigen
   * la bandera. Y la pantalla, con anticipos apagados, prometía justo lo
   * contrario: que esos 60.000 se contabilizaban contra el cargo.
   */
  it("una sola línea por debajo del importe se rechaza, y no deja anticipo", async () => {
    await bandera(false, false);
    await sembrarCuota("cuota-off-1", 140000);
    await expect(aplicarPago(
      {
        tenantId: TENANT, statementId: "cuota-off-1", amount: 200000, date: "2026-08-24",
        operationKey: "op-off-1", source: "manual",
        allocations: [{ statementId: "cuota-off-1", amount: 50000 }],
      },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow(/suma menos que el importe pagado/);
    expect((await db.collection("advances").get()).size).toBe(0);
  });

  /**
   * **El caso alcanzable desde la pantalla**, que es el que importa: el front
   * solo manda `allocations` con `producto-pago-multiple` encendida y más de una
   * línea. Esa combinación —múltiple ON, anticipos OFF— es la que el runbook
   * autorizaba explícitamente, y la que el rollback produce al apagar solo los
   * anticipos.
   */
  it("múltiple ON + anticipos OFF: el reparto que no llega al importe se rechaza", async () => {
    await bandera(false, true);
    await sembrarCuota("cuota-off-2", 70000);
    await sembrarCuota("cuota-off-3", 70000);
    await expect(aplicarPago(
      {
        tenantId: TENANT, statementId: "cuota-off-2", amount: 200000, date: "2026-08-24",
        operationKey: "op-off-2", source: "manual",
        allocations: [
          { statementId: "cuota-off-2", amount: 70000 },
          { statementId: "cuota-off-3", amount: 70000 },
        ],
      },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow(/suma menos que el importe pagado/);
    expect((await db.collection("advances").get()).size).toBe(0);
    // Y no se ha movido nada a medias: los cargos siguen intactos.
    expect((await db.collection("billingStatements").doc("cuota-off-2").get()).data()?.paymentAmount).toBe(0);
    expect((await db.collection("ledgerEntries").get()).size).toBe(0);
  });

  /**
   * **La contraparte imprescindible: el guardián no puede haber roto lo bueno.**
   * Un reparto que SÍ cuadra tiene que seguir pasando con la bandera apagada, y
   * con centavos — que es donde el hermano de este guardián rechazaba cobros
   * correctos.
   */
  it("un reparto que cuadra sigue pasando con la bandera apagada, también con centavos", async () => {
    await bandera(false, true);
    await sembrarCuota("cuota-off-4", 1243.79);
    await sembrarCuota("cuota-off-5", 4619.14);
    const r = await aplicarPago(
      {
        tenantId: TENANT, statementId: "cuota-off-4", amount: 5862.93, date: "2026-08-24",
        operationKey: "op-off-3", source: "manual",
        allocations: [
          { statementId: "cuota-off-4", amount: 1243.79 },
          { statementId: "cuota-off-5", amount: 4619.14 },
        ],
      },
      ADMIN, ROL, TENANT,
    );
    expect(r.advanceId).toBeUndefined();
    expect((await db.collection("advances").get()).size).toBe(0);
  });

  /** Y la forma vieja no pasa por el guardián nuevo: su línea única vale `monto`. */
  it("la forma vieja sigue contabilizando el sobrepago entero contra la cuota", async () => {
    await bandera(false, false);
    await sembrarCuota("cuota-off-6", 140000);
    const r = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-off-6", amount: 200000, date: "2026-08-24", operationKey: "op-off-4", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    expect(r.paymentAmount).toBe(200000);
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

  /**
   * **EL DINERO CON CENTAVOS, que es MXN y USD** (`FRACTION_DIGITS` en
   * `coefficient-billing.ts`: COP 0, MXN 2, USD 2).
   *
   * Todas las pruebas de sobrepago de arriba usan importes ENTEROS, y ese es
   * justo el caso que no falla: con enteros la aritmética de coma flotante no
   * pierde nada. Con dos decimales sí, y el guardián de R1 —que comparaba con
   * `!==` exacto— **abortaba la transacción entera de un cobro correcto**:
   * `35.16 + (400.42 − 35.16) = 400.41999999999996`, que no es `400.42`.
   *
   * No era un fallo raro: medido, le pasa a más del 2 % de los sobrepagos con
   * dos decimales. Y era irrecuperable — el `throw` ocurre ANTES de escribir la
   * marca de idempotencia, así que reintentar da exactamente lo mismo.
   *
   * `conjunto-las-playas` es MXN, así que esto estaba al alcance en producción
   * en cuanto se encendió la bandera.
   */
  it("un sobrepago con CENTAVOS se aplica, y el anticipo no arrastra basura decimal", async () => {
    await bandera(true);
    await sembrarCuota("cuota-cent", 35.16);
    const r = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-cent", amount: 400.42, date: "2026-08-24", operationKey: "op-cent", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    expect(r.paymentAmount).toBe(35.16);
    expect(r.status).toBe("paid");
    expect(r.advanceAmount).toBe(365.26);
    const adv = await db.collection("advances").doc(r.advanceId!).get();
    expect(adv.data()).toMatchObject({ amount: 365.26, remaining: 365.26 });
  });

  /**
   * **La segunda trampa de coma flotante, que es OTRA.** La de arriba está en la
   * SUMA (`35.16 + 365.26 !== 400.42`); esta está en la RESTA: una cuota de
   * 3.898,12 pagada con 6.440,73 deja `2542.6099999999997`, y ese número se
   * escribía tal cual en el anticipo y se arrastraba en cada cruce.
   *
   * **Se separa en su propia prueba porque falsando se vio que la otra no la
   * cubría:** quitar el redondeo del sobrante dejaba las 45 en verde, porque
   * `400.42 − 35.16` da limpio. Una prueba que pasa con el código roto no
   * vigila nada, y solo se sabe rompiéndolo a propósito.
   */
  it("el anticipo no arrastra basura decimal de la RESTA", async () => {
    await bandera(true);
    await sembrarCuota("cuota-resta", 3898.12);
    const r = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-resta", amount: 6440.73, date: "2026-08-24", operationKey: "op-resta", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    expect(r.advanceAmount).toBe(2542.61);
    const adv = await db.collection("advances").doc(r.advanceId!).get();
    expect(adv.data()).toMatchObject({ amount: 2542.61, remaining: 2542.61 });
    // R1 al céntimo: lo aplicado más el anticipo es lo pagado.
    expect(r.paymentAmount + r.advanceAmount!).toBe(6440.73);
  });

  /**
   * **El otro guardián, y falla mucho más.** `sumaAsignada > monto` rechazaba un
   * reparto EXACTO en centavos porque la suma de los dobles se pasa por 1e-12:
   * `1243.79 + 4619.14 + 1683.14 = 7546.070000000001`. Medido: el 13 % de los
   * repartos exactos de tres líneas con centavos.
   */
  it("un reparto EXACTO en centavos no se rechaza por el redondeo", async () => {
    await bandera(true);
    await sembrarCuota("cent-1", 1243.79);
    await sembrarCuota("cent-2", 4619.14);
    await sembrarCuota("cent-3", 1683.14);
    const r = await aplicarPago(
      {
        tenantId: TENANT,
        amount: 7546.07,
        allocations: [
          { statementId: "cent-1", amount: 1243.79 },
          { statementId: "cent-2", amount: 4619.14 },
          { statementId: "cent-3", amount: 1683.14 },
        ],
        date: "2026-08-24", operationKey: "op-cent-rep", source: "manual",
      },
      ADMIN, ROL, TENANT,
    );
    expect(r.applied).toBe(true);
    // Cubre los tres exactamente: no sobra nada, así que no nace anticipo (R3).
    expect(r.advanceAmount).toBeUndefined();
    for (const id of ["cent-1", "cent-2", "cent-3"]) {
      const c = (await db.collection("billingStatements").doc(id).get()).data()!;
      expect(c.balance).toBe(0);
      expect(c.status).toBe("paid");
    }
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

describe("R15 · revertir un pago se lleva por delante el anticipo que generó", () => {
  /**
   * **Sin esto, revertir un pago de 200 sobre una cuota de 140 devolvería los
   * 140 y dejaría vivo un saldo a favor de 60 de un dinero ya devuelto**: el
   * residente conservaría un crédito por dinero que tiene otra vez en el
   * bolsillo. No estaba escrito en ninguna versión de la PRD; salió de leer el
   * código. R8 cubría solo el anticipo YA CRUZADO, que es el caso raro.
   */
  it("anula el anticipo y devuelve el ingreso a cero", async () => {
    await bandera(true);
    await sembrarCuota("cuota-r15", 140000);
    const pago = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-r15", amount: 200000, date: "2026-08-20", operationKey: "op-r15", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    expect((await ingresoTotal()).total).toBe(200000);

    const r = await revertirPago(
      { tenantId: TENANT, operationKey: "op-r15", reversalKey: "rev-r15", reason: "Cobro duplicado" },
      ADMIN, ROL, TENANT,
    );
    expect(r.reversed).toBe(true);
    expect(r.paymentAmount).toBe(0);

    const adv = (await db.collection("advances").doc(pago.advanceId!).get()).data()!;
    expect(adv.status).toBe("cancelled");
    expect(adv.remaining).toBe(0);
    expect(adv.cancellationReason).toMatch(/Cobro duplicado/);

    // **La comprobación que importa: el dinero se fue del todo.** 140 por
    // Cartera y 60 por el libro, los dos deshechos.
    expect((await ingresoTotal()).total).toBe(0);
  });

  /**
   * **El defecto que la suite no vio y sí vio la base.**
   *
   * R8 preguntaba `remaining < amount`, que parecía lo mismo que «tiene cruces»
   * y no lo es: **anular un anticipo (R9) pone `remaining` a cero sin haber
   * cruzado nada**, así que un anticipo anulado se leía como cruzado y
   * bloqueaba una reversión legítima. Hacía falta encadenar cinco operaciones
   * —pagar, cruzar, descruzar, anular, revertir— para que apareciera, y ninguna
   * prueba unitaria llegaba tan lejos.
   */
  it("un anticipo ANULADO no bloquea la reversión: anular no es cruzar", async () => {
    await bandera(true);
    await sembrarCuota("cuota-anul-rev", 140000);
    const pago = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-anul-rev", amount: 200000, date: "2026-08-20", operationKey: "op-anul-rev", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    await anularAnticipo(
      { tenantId: TENANT, advanceId: pago.advanceId!, reason: "El residente renuncia", operationKey: "anul-antes-rev" },
      ADMIN, ROL, TENANT,
    );
    const r = await revertirPago(
      { tenantId: TENANT, operationKey: "op-anul-rev", reversalKey: "rev-anul", reason: "Cobro duplicado" },
      ADMIN, ROL, TENANT,
    );
    expect(r.reversed).toBe(true);
    // El dinero se va del todo: el anticipo estaba anulado pero su ingreso
    // seguía contado, y revertir el pago lo devuelve.
    expect((await ingresoTotal()).total).toBe(0);
  });

  /**
   * **R8.** Deshacer los cruces aquí sería tocar cargos que el llamante no
   * nombró —y que pueden ser de otros períodos— dentro de una transacción que
   * él cree que afecta a una sola cuota.
   */
  it("si el anticipo ya se cruzó contra otro cargo, se bloquea (CF2)", async () => {
    await bandera(true);
    await sembrarCuota("cuota-r8", 140000);
    const pago = await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-r8", amount: 200000, date: "2026-08-20", operationKey: "op-r8", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    await sembrarCuota("cuota-r8-otra", 90000);
    await cruzarAnticipo(
      { tenantId: TENANT, advanceId: pago.advanceId!, statementId: "cuota-r8-otra", amount: 60000, date: "2026-08-21", operationKey: "cruce-r8" },
      ADMIN, ROL, TENANT,
    );
    await expect(revertirPago(
      { tenantId: TENANT, operationKey: "op-r8", reversalKey: "rev-r8", reason: "Error" },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow(/deshacer esos cruces/i);
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


describe("R9 · anular un anticipo con motivo NO toca el libro", () => {
  /**
   * **Anular y revertir el pago son cosas distintas, y la diferencia está en
   * dónde queda el dinero.**
   *
   * Revertir el pago lo devuelve entero, así que allí el asiento del anticipo sí
   * se revierte (R15). Anular es otra cosa: el dinero entró y se queda en el
   * conjunto —lo que desaparece es el crédito de esa unidad—, y devolverlo es un
   * egreso que §4 deja fuera de esta ficha a propósito. Ese ingreso ocurrió, así
   * que el libro no se toca.
   */
  it("el anticipo queda anulado y el ingreso del conjunto NO baja", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(60000, "r9");
    const antes = await ingresoTotal();

    const r = await anularAnticipo(
      { tenantId: TENANT, advanceId, reason: "El residente renuncia al saldo", operationKey: "anul-r9" },
      ADMIN, ROL, TENANT,
    );
    expect(r.cancelled).toBe(true);

    const adv = (await db.collection("advances").doc(advanceId).get()).data()!;
    expect(adv.status).toBe("cancelled");
    expect(adv.cancellationReason).toBe("El residente renuncia al saldo");
    // Queda registro: importe, fecha y unidad siguen ahí. Un crédito que se
    // esfuma sin rastro es justo lo que esta ficha existe para evitar.
    expect(adv.amount).toBe(60000);
    expect((await ingresoTotal()).total).toBe(antes.total);
  });

  /** CF4: sin motivo, rechazado. La cadena de espacios cuenta como sin motivo. */
  it("sin motivo se rechaza", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(60000, "cf4");
    await expect(anularAnticipo(
      { tenantId: TENANT, advanceId, reason: "   ", operationKey: "anul-cf4" },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow(/motivo/i);
  });

  /** CF3: uno parcialmente cruzado dejaría cargos saldados con algo que ya no existe. */
  it("uno parcialmente cruzado se rechaza", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(60000, "cf3");
    await sembrarCuota("cuota-cf3", 140000);
    await cruzarAnticipo(
      { tenantId: TENANT, advanceId, statementId: "cuota-cf3", amount: 20000, date: "2026-08-21", operationKey: "cruce-cf3" },
      ADMIN, ROL, TENANT,
    );
    await expect(anularAnticipo(
      { tenantId: TENANT, advanceId, reason: "Da igual", operationKey: "anul-cf3" },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow(/deshacer esos cruces/i);
  });

  it("no se anula dos veces: `cancelled` es terminal", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(60000, "term");
    await anularAnticipo({ tenantId: TENANT, advanceId, reason: "Uno", operationKey: "anul-t1" }, ADMIN, ROL, TENANT);
    await expect(anularAnticipo(
      { tenantId: TENANT, advanceId, reason: "Dos", operationKey: "anul-t2" },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow(/ya está anulado/i);
  });
});

describe("D-B · un pago cubre varios cargos en una sola operación", () => {
  it("reparte 230 entre dos cuotas y las deja pagadas (CA3)", async () => {
    await bandera(true);
    await sembrarCuota("multi-1", 140000);
    await sembrarCuota("multi-2", 90000);

    const r = await aplicarPago(
      {
        tenantId: TENANT, amount: 230000, date: "2026-08-20", operationKey: "op-multi", source: "manual",
        allocations: [{ statementId: "multi-1", amount: 140000 }, { statementId: "multi-2", amount: 90000 }],
      },
      ADMIN, ROL, TENANT,
    );
    expect(r.allocations).toHaveLength(2);
    const uno = (await db.collection("billingStatements").doc("multi-1").get()).data()!;
    const dos = (await db.collection("billingStatements").doc("multi-2").get()).data()!;
    expect(uno.status).toBe("paid");
    expect(dos.status).toBe("paid");
    expect(uno.paymentAmount).toBe(140000);
    expect(dos.paymentAmount).toBe(90000);
  });

  /**
   * **Un asiento POR LÍNEA, no uno por pago.** Cada cargo lleva su propia cuenta
   * (R6 de `PLAT-003`): un pago que cubre una cuota y una multa tiene que dejar
   * el ingreso en las dos cuentas, no elegir una.
   */
  it("escribe un asiento por cargo, y un solo recibo", async () => {
    await bandera(true);
    await sembrarCuota("multi-a1", 140000);
    await sembrarCuota("multi-a2", 90000);
    await aplicarPago(
      {
        tenantId: TENANT, amount: 230000, date: "2026-08-20", operationKey: "op-multi-a", source: "manual",
        allocations: [{ statementId: "multi-a1", amount: 140000 }, { statementId: "multi-a2", amount: 90000 }],
      },
      ADMIN, ROL, TENANT,
    );
    const asientos = await db.collection("ledgerEntries").where("operationKey", "==", "op-multi-a").get();
    expect(asientos.size).toBe(2);
    // El residente hizo UNA transferencia: darle tres papeles por un movimiento
    // sería contarle nuestra contabilidad interna.
    expect((await db.collection("paymentVouchers").get()).size).toBe(1);
  });

  it("lo que sobra del reparto va al anticipo, y R1 se cumple", async () => {
    await bandera(true);
    await sembrarCuota("multi-b1", 140000);
    await sembrarCuota("multi-b2", 90000);
    const r = await aplicarPago(
      {
        tenantId: TENANT, amount: 300000, date: "2026-08-20", operationKey: "op-multi-b", source: "manual",
        allocations: [{ statementId: "multi-b1", amount: 140000 }, { statementId: "multi-b2", amount: 90000 }],
      },
      ADMIN, ROL, TENANT,
    );
    expect(r.advanceAmount).toBe(70000);
    const aplicado = r.allocations!.reduce((s, a) => s + a.amount, 0);
    expect(aplicado + r.advanceAmount!).toBe(300000);
    expect((await ingresoTotal()).total).toBe(300000);
  });

  /**
   * Un pago es de alguien que paga lo de SU unidad, y el sobrante se convierte
   * en anticipo **de esa unidad**. Repartir entre unidades distintas dejaría un
   * anticipo sin dueño claro, y el saldo a favor de un residente podría nacer de
   * un pago que cubrió cargos de un vecino.
   */
  it("no se reparte entre unidades distintas", async () => {
    await bandera(true);
    await sembrarCuota("multi-u1", 140000);
    await db.collection("billingStatements").doc("multi-u2").set({
      tenantId: TENANT, unitId: "unit-777", unitLabel: "777", period: "2026-08",
      amount: 90000, paymentAmount: 0, balance: 90000, status: "pending",
    });
    await expect(aplicarPago(
      {
        tenantId: TENANT, amount: 230000, date: "2026-08-20", operationKey: "op-multi-u", source: "manual",
        allocations: [{ statementId: "multi-u1", amount: 140000 }, { statementId: "multi-u2", amount: 90000 }],
      },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow(/unidades distintas/i);
  });

  // El mismo cargo dos veces sumaría dos veces sobre el mismo documento dentro
  // de la misma transacción, y la segunda escritura pisaría a la primera: el
  // dinero se perdería sin que nada fallase.
  it("un mismo cargo no puede aparecer dos veces", async () => {
    await bandera(true);
    await sembrarCuota("multi-d", 140000);
    await expect(aplicarPago(
      {
        tenantId: TENANT, amount: 200000, date: "2026-08-20", operationKey: "op-multi-d", source: "manual",
        allocations: [{ statementId: "multi-d", amount: 100000 }, { statementId: "multi-d", amount: 100000 }],
      },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow(/dos veces/i);
  });

  /** CF5. */
  it("un reparto que suma más que lo pagado se rechaza", async () => {
    await bandera(true);
    await sembrarCuota("multi-s1", 140000);
    await sembrarCuota("multi-s2", 90000);
    await expect(aplicarPago(
      {
        tenantId: TENANT, amount: 200000, date: "2026-08-20", operationKey: "op-multi-s", source: "manual",
        allocations: [{ statementId: "multi-s1", amount: 140000 }, { statementId: "multi-s2", amount: 90000 }],
      },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow(/suma más/i);
  });

  it("con la bandera del reparto apagada, solo se acepta un cargo", async () => {
    await bandera(true, false);
    await sembrarCuota("multi-f1", 140000);
    await sembrarCuota("multi-f2", 90000);
    await expect(aplicarPago(
      {
        tenantId: TENANT, amount: 230000, date: "2026-08-20", operationKey: "op-multi-f", source: "manual",
        allocations: [{ statementId: "multi-f1", amount: 140000 }, { statementId: "multi-f2", amount: 90000 }],
      },
      ADMIN, ROL, TENANT,
    )).rejects.toThrow();
  });

  /**
   * **El rediseño que arrastraba `allocations[]`.** El reverso conocía UN
   * asiento: sin esto, un pago repartido entre dos cuotas se desharía a la
   * mitad — una cuota volvería a deber y la otra se quedaría pagada con un
   * dinero que ya se devolvió.
   */
  it("revertir un pago repartido deshace TODAS sus líneas", async () => {
    await bandera(true);
    await sembrarCuota("multi-r1", 140000);
    await sembrarCuota("multi-r2", 90000);
    await aplicarPago(
      {
        tenantId: TENANT, amount: 230000, date: "2026-08-20", operationKey: "op-multi-r", source: "manual",
        allocations: [{ statementId: "multi-r1", amount: 140000 }, { statementId: "multi-r2", amount: 90000 }],
      },
      ADMIN, ROL, TENANT,
    );
    expect((await ingresoTotal()).total).toBe(230000);

    await revertirPago(
      { tenantId: TENANT, operationKey: "op-multi-r", reversalKey: "rev-multi-r", reason: "Cobro duplicado" },
      ADMIN, ROL, TENANT,
    );

    const uno = (await db.collection("billingStatements").doc("multi-r1").get()).data()!;
    const dos = (await db.collection("billingStatements").doc("multi-r2").get()).data()!;
    expect(uno.paymentAmount).toBe(0);
    expect(dos.paymentAmount).toBe(0);
    expect(uno.status).toBe("pending");
    expect(dos.status).toBe("pending");
    expect((await ingresoTotal()).total).toBe(0);
  });
});

describe("Triaje del 24 ago 2026 · el dinero con centavos, otra vez", () => {
  /**
   * **#14 — cruzar un anticipo cubriendo la deuda ENTERA deja el cargo saldado.**
   *
   * `calcularSaldo` decidía sobre `cobrado − pagado − cruzado` sin redondear, y
   * las tres restas arrastran basura: el cargo se quedaba en `pending` con un
   * saldo de ~3,5e-15 que la pantalla pinta como **0,00**. Pendiente de nada.
   * Medido antes de arreglarlo: **426 de 20.000 combinaciones con centavos**.
   */
  it("cruzar la deuda entera con centavos deja el cargo en `paid` y no en «pendiente 0,00»", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(500, "c14");
    await db.collection("billingStatements").doc("cuota-c14").set({
      tenantId: TENANT, unitId: "unit-101", unitLabel: "101", period: "2026-08",
      concept: "administracion", amount: 32.95, paymentAmount: 7.91, advanceAppliedAmount: 6.01,
      balance: 19.03, dueDate: "2026-08-31", status: "pending",
    });
    await cruzarAnticipo(
      { tenantId: TENANT, advanceId, statementId: "cuota-c14", amount: 100, date: "2026-08-21", operationKey: "cruce-c14" },
      ADMIN, ROL, TENANT,
    );
    const cargo = await db.collection("billingStatements").doc("cuota-c14").get();
    expect(cargo.data()?.balance).toBe(0);
    expect(cargo.data()?.status).toBe("paid");
  });

  /**
   * **#7 — CF3: un anticipo cruzado y DESCRUZADO se tiene que poder anular.**
   *
   * `remaining + monto` no devuelve el importe de partida con centavos —21,99
   * cruzado 3,74 y descruzado daba 21,990000000000002— y CF3 comparaba con
   * `!==`, así que se negaba a anularlo diciendo que «ya se aplicó a algún
   * cargo». Mentira, y sin salida: deshacer el cruce era justo lo que se acababa
   * de hacer. Medido: **603 de 20.000, un 3,0 %**.
   */
  it("anticipo con centavos cruzado y descruzado: se puede anular", async () => {
    await bandera(true);
    const advanceId = await anticipoDe(21.99, "c7");
    await sembrarCuota("cuota-c7", 3.74);
    const cruce = await cruzarAnticipo(
      { tenantId: TENANT, advanceId, statementId: "cuota-c7", amount: 3.74, date: "2026-08-21", operationKey: "cruce-c7" },
      ADMIN, ROL, TENANT,
    );
    await deshacerCruce(
      { tenantId: TENANT, applicationId: cruce.applicationId, operationKey: "descruce-c7" },
      ADMIN, ROL, TENANT,
    );
    const tras = await db.collection("advances").doc(advanceId).get();
    expect(tras.data()?.remaining).toBe(tras.data()?.amount);
    await expect(anularAnticipo(
      { tenantId: TENANT, advanceId, reason: "prueba", operationKey: "anula-c7" },
      ADMIN, ROL, TENANT,
    )).resolves.toMatchObject({ ok: true });
  });

  /**
   * **#13 — revertir un pago que se fue ENTERO a anticipo.**
   *
   * Un pago sin cargos pendientes (CA8) guarda `allocations: []` y
   * `appliedToStatement: 0`, así que el respaldo del reverso fabricaba una línea
   * de cero y escribía en el libro un `ingreso: 0` con categoría «alicuota». Una
   * fila que no dice nada y que ensucia la conciliación. El dinero de ese pago
   * se revierte donde de verdad está: en el asiento del anticipo (R15).
   */
  it("revertirlo no deja un asiento de importe cero en el libro", async () => {
    await bandera(true);
    await sembrarCuota("cuota-c13", 140000);
    await db.collection("billingStatements").doc("cuota-c13").update({ paymentAmount: 140000, balance: 0, status: "paid" });
    await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-c13", amount: 50000, date: "2026-08-20", operationKey: "op-c13", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    await revertirPago(
      { tenantId: TENANT, operationKey: "op-c13", reversalKey: "rev-c13", reason: "prueba" },
      ADMIN, ROL, TENANT,
    );
    const libro = await db.collection("ledgerEntries").get();
    expect(libro.docs.filter((d) => (d.data().amount ?? 0) === 0)).toHaveLength(0);
    // Y la contraparte: el dinero SÍ se revirtió, por su propio asiento.
    const anticipos = libro.docs.map((d) => d.data()).filter((e) => e.category === "anticipo");
    expect(anticipos.map((e) => e.amount).sort((a, b) => a - b)).toEqual([-50000, 50000]);
  });

  /**
   * **#6 — la clave de idempotencia no lleva el conjunto.**
   *
   * `advances.ts` prefija sus claves con el `tenantId` y `payments.ts` no: es el
   * gemelo que lo hace bien. No se puede cambiar el id del documento sin dejar
   * inalcanzables las marcas ya escritas —y con ellas la reversión de todos los
   * pagos que hay en producción—, así que lo que se comprueba es el conjunto
   * antes de devolver el resultado. Sin esto, quien acierte una clave ajena
   * recibe el recibo de otro conjunto y su propio cobro se da por hecho.
   */
  it("una clave de otro conjunto no devuelve su resultado: se rechaza", async () => {
    await bandera(true);
    await sembrarCuota("cuota-c6", 140000);
    await aplicarPago(
      { tenantId: TENANT, statementId: "cuota-c6", amount: 140000, date: "2026-08-20", operationKey: "op-c6", source: "manual" },
      ADMIN, ROL, TENANT,
    );
    await db.collection("billingStatements").doc("cuota-c6-ajena").set({
      tenantId: OTRO_TENANT, unitId: "unit-9", unitLabel: "9", period: "2026-08",
      concept: "administracion", amount: 10000, paymentAmount: 0, balance: 10000,
      dueDate: "2026-08-31", status: "pending",
    });
    await expect(aplicarPago(
      { tenantId: OTRO_TENANT, statementId: "cuota-c6-ajena", amount: 10000, date: "2026-08-20", operationKey: "op-c6", source: "manual" },
      ADMIN, ROL, OTRO_TENANT,
    )).rejects.toThrow(/pertenece a otro conjunto/);
  });
});
