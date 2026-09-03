import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import {
  anularInforme,
  firmarInforme,
  guardarBorrador,
  idDelInforme,
  leerYConstruirInstantanea,
  prepararEmision,
  sellarEmision,
  type InstantaneaDelInforme,
} from "../src/informe-mensual";

/**
 * `PRD-V-FLOW-007` entrega 2 — la máquina de estados del informe. `CA5`, `CA15`,
 * `CA16` y las guardas de §6.
 *
 * **Lo que vigilan estas pruebas es que un informe emitido NO cambie.** Es un
 * documento con sanción legal detrás —la remoción del administrador—, y el valor
 * entero de emitirlo está en que a partir de ese momento dice siempre lo mismo.
 * Un informe que se altera solo al corregir un asiento no es un informe: es una
 * pantalla con fecha.
 *
 * Necesita el emulador:
 *   export JAVA_HOME="$HOME/.local/jdk/jdk-21.0.12.1+1/Contents/Home"
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const T = "flow007-conjunto";
const PERIODO = "2026-02";
const ID = idDelInforme(T, PERIODO);
const ADMIN = "flow007-admin";
const CONSEJERO = "flow007-consejero";

let db: Firestore;

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  db = getFirestore();
});

async function limpiar(col: string) {
  const snap = await db.collection(col).where("tenantId", "==", T).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

/**
 * Un mes con números redondos y escritos a mano: 5.000 de apertura, 200 de
 * egreso. Es el caso de `CA2` de la ficha, con su saldo final de 4.800.
 */
async function sembrarElMes() {
  await Promise.all([limpiar("billingStatements"), limpiar("ledgerEntries"), limpiar("bankAccountBalances"), limpiar("expenses")]);
  await db.collection("monthlyReports").doc(ID).delete();

  await db.collection("bankAccountBalances").doc(`${T}-cuenta`).set({ tenantId: T, openingBalance: 5_000 });
  await db.collection("ledgerEntries").doc(`${T}-asiento`).set({
    tenantId: T, type: "egreso", category: "mantenimiento", amount: 200, date: `${PERIODO}-15`,
  });
  await db.collection("billingStatements").doc(`${T}-cargo`).set({
    tenantId: T, unitId: "u-1", unitLabel: "APTO 101", period: PERIODO,
    amount: 1_000, paymentAmount: 0, balance: 1_000, status: "pending",
  });
}

async function crearBorrador() {
  const instantanea = await leerYConstruirInstantanea(T, PERIODO);
  await guardarBorrador({ tenantId: T, period: PERIODO, instantanea, actorUid: "system" });
  return instantanea;
}

async function emitir() {
  const preparado = await prepararEmision({ tenantId: T, period: PERIODO });
  await sellarEmision({
    tenantId: T, period: PERIODO, instantanea: preparado.instantanea, actorUid: ADMIN, documentId: "doc-1",
  });
}

const leer = async () => (await db.collection("monthlyReports").doc(ID).get()).data() as InstantaneaDelInforme & {
  status: string;
  issuedBy?: string;
  voidReason?: string;
  signatures?: { uid: string; name: string; role: string }[];
};

beforeEach(sembrarElMes);

describe("FLOW-007 · el borrador", () => {
  it("`CA2` · nace con el saldo real del banco y su saldo final derivado", async () => {
    await crearBorrador();
    const i = await leer();
    expect(i.status).toBe("borrador");
    expect(i.openingBalance).toBe(5_000);
    expect(i.openingBalanceSource).toBe("registrado");
    // 5.000 − 200 = 4.800, escrito a mano igual que en la ficha.
    expect(i.closingBalance).toBe(4_800);
  });

  it("regenerar SUSTITUYE las cifras: no arrastra líneas de una versión anterior", async () => {
    await crearBorrador();
    // Aparece un egreso más. Con `merge` sobrevivirían las cifras viejas al lado.
    await db.collection("ledgerEntries").doc(`${T}-asiento-2`).set({
      tenantId: T, type: "egreso", category: "nomina", amount: 800, date: `${PERIODO}-20`,
    });
    await crearBorrador();
    const i = await leer();
    expect(i.totalExpenses).toBe(1_000);
    expect(i.closingBalance).toBe(4_000);
  });

  it("conserva su `createdAt` al regenerarse: no nació la última vez que se pulsó el botón", async () => {
    await crearBorrador();
    const primero = (await db.collection("monthlyReports").doc(ID).get()).get("createdAt");
    await crearBorrador();
    const segundo = (await db.collection("monthlyReports").doc(ID).get()).get("createdAt");
    expect(segundo.toMillis()).toBe(primero.toMillis());
  });

  it("un borrador NO se firma: sus cifras todavía pueden cambiar", async () => {
    await crearBorrador();
    await expect(
      firmarInforme({ tenantId: T, reportId: ID, actorUid: ADMIN, actorName: "Ana", actorRole: "Administración" }),
    ).rejects.toThrow(/borrador no se firma/i);
  });

  it("un borrador NO se anula: no ha afirmado nada, y anularlo bloquearía el período", async () => {
    await crearBorrador();
    await expect(
      anularInforme({ tenantId: T, reportId: ID, reason: "me equivoqué", actorUid: ADMIN }),
    ).rejects.toThrow(/borrador no se anula/i);
  });

  it("sin borrador no se emite: emitir sin él sería firmar sin haber visto", async () => {
    await expect(prepararEmision({ tenantId: T, period: PERIODO })).rejects.toThrow(/No hay borrador/i);
  });

  it("el período tiene que tener forma de período", async () => {
    await expect(prepararEmision({ tenantId: T, period: "febrero" })).rejects.toThrow(/AAAA-MM/);
    await expect(prepararEmision({ tenantId: T, period: "2026-13" })).rejects.toThrow(/AAAA-MM/);
  });
});

/**
 * **`CA5` — el criterio que da sentido a la entrega.**
 *
 * «Emitido el informe, se cambia el monto de un asiento del período y se relee:
 * las cifras del informe emitido NO cambian.»
 */
describe("FLOW-007 · `CA5` · un informe emitido CONGELA sus cifras", () => {
  it("cambiar un asiento del período después de emitir no altera el informe", async () => {
    await crearBorrador();
    await emitir();
    const antes = await leer();
    expect(antes.status).toBe("emitido");
    expect(antes.closingBalance).toBe(4_800);

    // El administrador corrige un asiento: el egreso eran 5.000, no 200.
    await db.collection("ledgerEntries").doc(`${T}-asiento`).update({ amount: 5_000 });

    // ── EL CONTROL DEL INSTRUMENTO, y sin él esta prueba no vigila nada ──
    //
    // Afirmar «el informe sigue diciendo 4.800» es cierto por construcción
    // mientras el informe sea una instantánea guardada: **ninguna falsación
    // podría enrojecerlo**, así que pasaría igual con el cambio siendo un no-op
    // —si el `update` de arriba no hubiera cambiado nada, o si el asiento no
    // entrara en el cálculo—. Lo que le da sentido es comprobar antes que
    // recalcular HOY daría otro número: entonces «no se movió» dice algo.
    const recalculado = await leerYConstruirInstantanea(T, PERIODO);
    expect(recalculado.closingBalance).toBe(0); // 5.000 − 5.000
    expect(recalculado.closingBalance).not.toBe(antes.closingBalance);

    const despues = await leer();
    // **Nada se movió.** Si esto cambiara, emitir no significaría nada.
    expect(despues.closingBalance).toBe(4_800);
    expect(despues.totalExpenses).toBe(200);
  });

  it("y tampoco lo mueve la corrida programada del mes siguiente", async () => {
    await crearBorrador();
    await emitir();
    await db.collection("ledgerEntries").doc(`${T}-asiento`).update({ amount: 5_000 });

    // `guardarBorrador` es lo que corre el día 1. Sobre un emitido no escribe.
    const instantanea = await leerYConstruirInstantanea(T, PERIODO);
    const r = await guardarBorrador({ tenantId: T, period: PERIODO, instantanea, actorUid: "system" });

    expect(r).toEqual({ escrito: false, motivo: "emitido" });
    expect((await leer()).closingBalance).toBe(4_800);
  });

  it("sella quién emitió, y ese campo no lo escribe el cliente", async () => {
    await crearBorrador();
    await emitir();
    const i = await leer();
    expect(i.issuedBy).toBe(ADMIN);
    expect((await db.collection("monthlyReports").doc(ID).get()).get("issuedAt")).toBeTruthy();
  });

  it("reemitir es idempotente: devuelve el emitido y no archiva un segundo PDF", async () => {
    await crearBorrador();
    await emitir();
    const otra = await prepararEmision({ tenantId: T, period: PERIODO });
    expect(otra.yaEmitido).toBe(true);
  });

  it("dos emisiones a la vez: la segunda NO pisa las cifras de la primera", async () => {
    await crearBorrador();
    // Las dos preparan sobre el mismo borrador —la carrera de dos pestañas—, y
    // sellar vuelve a comprobar el estado DENTRO de la transacción.
    const a = await prepararEmision({ tenantId: T, period: PERIODO });
    const b = await prepararEmision({ tenantId: T, period: PERIODO });
    await sellarEmision({ tenantId: T, period: PERIODO, instantanea: a.instantanea, actorUid: ADMIN, documentId: "doc-a" });
    await expect(
      sellarEmision({ tenantId: T, period: PERIODO, instantanea: b.instantanea, actorUid: ADMIN, documentId: "doc-b" }),
    ).rejects.toThrow(/ya fue emitido/i);
    expect((await db.collection("monthlyReports").doc(ID).get()).get("documentId")).toBe("doc-a");
  });
});

describe("FLOW-007 · las firmas · `RN-12`", () => {
  beforeEach(async () => {
    await crearBorrador();
    await emitir();
  });

  it("registra quién firmó, con su cargo y su sello de tiempo", async () => {
    await firmarInforme({ tenantId: T, reportId: ID, actorUid: CONSEJERO, actorName: "Paola Ruiz", actorRole: "Consejo de administración" });
    const firmas = (await leer()).signatures ?? [];
    expect(firmas).toHaveLength(1);
    expect(firmas[0]).toMatchObject({ uid: CONSEJERO, name: "Paola Ruiz", role: "Consejo de administración" });
    expect((await db.collection("monthlyReports").doc(ID).get()).get("signatures")[0].signedAt).toBeTruthy();
  });

  it("firmar dos veces no duplica la fila ni mueve la fecha de la primera", async () => {
    await firmarInforme({ tenantId: T, reportId: ID, actorUid: CONSEJERO, actorName: "Paola Ruiz", actorRole: "Consejo" });
    const primera = (await db.collection("monthlyReports").doc(ID).get()).get("signatures")[0].signedAt.toMillis();

    const otra = await firmarInforme({ tenantId: T, reportId: ID, actorUid: CONSEJERO, actorName: "Paola Ruiz", actorRole: "Consejo" });
    expect(otra.yaFirmado).toBe(true);

    const firmas = (await db.collection("monthlyReports").doc(ID).get()).get("signatures");
    expect(firmas).toHaveLength(1);
    expect(firmas[0].signedAt.toMillis()).toBe(primera);
  });

  it("dos personas distintas firman las dos, y las dos quedan", async () => {
    await firmarInforme({ tenantId: T, reportId: ID, actorUid: ADMIN, actorName: "Ana Gómez", actorRole: "Administración" });
    await firmarInforme({ tenantId: T, reportId: ID, actorUid: CONSEJERO, actorName: "Paola Ruiz", actorRole: "Consejo" });
    expect((await leer()).signatures).toHaveLength(2);
  });

  it("un informe de OTRO conjunto no se firma, aunque se sepa su id", async () => {
    await expect(
      firmarInforme({ tenantId: "otro-conjunto", reportId: ID, actorUid: ADMIN, actorName: "Ana", actorRole: "Administración" }),
    ).rejects.toThrow(/no pertenece a este conjunto/i);
  });
});

describe("FLOW-007 · anular · `CA15` y `CA16`", () => {
  beforeEach(async () => {
    await crearBorrador();
    await emitir();
  });

  it("`CA16` · anular SIN motivo lo rechaza el servidor, no el formulario", async () => {
    await expect(anularInforme({ tenantId: T, reportId: ID, reason: "", actorUid: ADMIN })).rejects.toThrow(/exige un motivo/i);
    // Y un motivo en blanco tampoco cuela: se recorta antes de mirarlo.
    await expect(anularInforme({ tenantId: T, reportId: ID, reason: "   ", actorUid: ADMIN })).rejects.toThrow(/exige un motivo/i);
  });

  it("`CA15` · el anulado SE CONSERVA, con su motivo y sus cifras a la vista", async () => {
    await anularInforme({ tenantId: T, reportId: ID, reason: "Un egreso de marzo con fecha de abril.", actorUid: ADMIN });
    const i = await leer();
    // Archivar no es esconder: el documento sigue ahí, y dice por qué no vale.
    expect(i.status).toBe("anulado");
    expect(i.voidReason).toBe("Un egreso de marzo con fecha de abril.");
    expect(i.closingBalance).toBe(4_800);
    expect((await db.collection("monthlyReports").doc(ID).get()).get("voidedBy")).toBe(ADMIN);
  });

  it("anular dos veces es idempotente y no reescribe el motivo original", async () => {
    await anularInforme({ tenantId: T, reportId: ID, reason: "El primero.", actorUid: ADMIN });
    const otra = await anularInforme({ tenantId: T, reportId: ID, reason: "Otro distinto.", actorUid: ADMIN });
    expect(otra.yaAnulado).toBe(true);
    expect((await leer()).voidReason).toBe("El primero.");
  });

  it("`anulado` es TERMINAL: ni se reemite ni se firma", async () => {
    await anularInforme({ tenantId: T, reportId: ID, reason: "Cifras mal.", actorUid: ADMIN });
    await expect(prepararEmision({ tenantId: T, period: PERIODO })).rejects.toThrow(/está anulado/i);
    await expect(
      firmarInforme({ tenantId: T, reportId: ID, actorUid: ADMIN, actorName: "Ana", actorRole: "Administración" }),
    ).rejects.toThrow(/anulado/i);
  });

  it("la corrida del día 1 tampoco resucita un anulado", async () => {
    await anularInforme({ tenantId: T, reportId: ID, reason: "Cifras mal.", actorUid: ADMIN });
    const instantanea = await leerYConstruirInstantanea(T, PERIODO);
    const r = await guardarBorrador({ tenantId: T, period: PERIODO, instantanea, actorUid: "system" });
    expect(r).toEqual({ escrito: false, motivo: "anulado" });
  });

  it("un informe de OTRO conjunto no se anula, aunque se sepa su id", async () => {
    await expect(
      anularInforme({ tenantId: "otro-conjunto", reportId: ID, reason: "x", actorUid: ADMIN }),
    ).rejects.toThrow(/no pertenece a este conjunto/i);
  });
});
