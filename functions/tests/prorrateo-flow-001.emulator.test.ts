import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";

import { anularCorrida, repartirEgreso } from "../src/expense-distribution";

/**
 * **`PRD-V-FLOW-001` — repartir un egreso entre las unidades, y deshacerlo.**
 *
 * Lo que estas pruebas vigilan de verdad, más allá de recorrer los criterios:
 *
 * 1. **Que la suma de los cargos sea EXACTAMENTE el importe repartido**, y no
 *    «aproximadamente». Es la métrica de éxito de la ficha (§2) y el único
 *    número que un administrador puede comprobar a mano contra su factura.
 * 2. **Que un cargo anulado deje de ser deuda por DOS caminos a la vez**: el
 *    estado y el saldo. Seis sitios del producto usan `status !== "paid"` como
 *    «debe» y no conocen el estado nuevo — el balance en cero es lo que los
 *    salva. Si alguien quita uno de los dos, aquí se ve.
 * 3. **Que un anticipo cruzado cuente como pago** al bloquear la anulación.
 *    `advanceAppliedAmount` va aparte de `paymentAmount` desde `FLOW-002`, así
 *    que mirar solo el segundo dejaría anular un cargo ya cubierto.
 *
 * Necesita el emulador:
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const T = "flow001-conjunto";
const OTRO = "flow001-otro-conjunto";
const UID = "flow001-admin";

let db: Firestore;

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  db = getFirestore();
});

async function limpiar(col: string) {
  const snap = await db.collection(col).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

/**
 * Cuatro unidades con coeficiente 25 cada una: la suma da 100 exacta y el
 * reparto de un importe divisible sale redondo. Los casos con residuo usan
 * `sembrarSeisUnidades`, donde 100/6 NO cierra solo.
 */
async function sembrarCuatroUnidades(tenantId = T) {
  for (const [i, label] of ["101", "102", "201", "202"].entries()) {
    await db.collection("units").doc(`${tenantId}-u${i}`).set({
      tenantId,
      unitId: `${tenantId}-u${i}`,
      displayName: label,
      status: "active",
      coefficient: 25,
      ownerIds: [`persona-${i}`],
    });
  }
}

/** Seis unidades a 16,666667 / 16,666666: el caso que ejercita el residuo. */
async function sembrarSeisUnidades() {
  const coefs = [16.666667, 16.666667, 16.666667, 16.666667, 16.666666, 16.666666];
  for (const [i, coef] of coefs.entries()) {
    await db.collection("units").doc(`${T}-s${i}`).set({
      tenantId: T,
      unitId: `${T}-s${i}`,
      displayName: `S${i}`,
      status: "active",
      coefficient: coef,
      ownerIds: [`persona-s${i}`],
    });
  }
}

async function sembrarEgreso(
  id: string,
  extra: { amount?: number; status?: string; category?: string; tenantId?: string } = {},
) {
  await db.collection("expenses").doc(id).set({
    tenantId: extra.tenantId ?? T,
    amount: extra.amount ?? 1_000_000,
    status: extra.status ?? "registrado",
    category: extra.category ?? "proveedores",
    description: "Factura del ascensor",
    vendorName: "Ascensores S.A.",
    issueDate: "2026-08-01",
  });
}

const entrada = (extra: Partial<Parameters<typeof repartirEgreso>[0]> = {}) => ({
  tenantId: T,
  expenseId: "gasto-1",
  period: "2026-08",
  operationKey: "op-1",
  ...extra,
});

beforeEach(async () => {
  for (const c of ["units", "expenses", "billingCampaigns", "billingStatements", "tenants"]) {
    await limpiar(c);
  }
  await db.collection("tenants").doc(T).set({ name: "Conjunto FLOW-001", currency: "COP", country: "CO", status: "active" });
  await db.collection("tenants").doc(OTRO).set({ name: "Otro", currency: "COP", country: "CO", status: "active" });
});

describe("FLOW-001 · repartir un egreso", () => {
  it("CA1 · la suma de los cargos es EXACTAMENTE el importe repartido", async () => {
    await sembrarCuatroUnidades();
    await sembrarEgreso("gasto-1", { amount: 1_000_000 });

    const r = await repartirEgreso(entrada(), UID);

    expect(r.lines).toHaveLength(4);
    expect(r.lines.reduce((a, l) => a + l.amount, 0)).toBe(1_000_000);

    const cargos = await db.collection("billingStatements").where("campaignId", "==", r.campaignId).get();
    expect(cargos.size).toBe(4);
    expect(cargos.docs.reduce((a, d) => a + (d.data().amount as number), 0)).toBe(1_000_000);
  });

  it("CA2 · un importe que no divide exacto reparte el residuo y la suma sigue siendo exacta", async () => {
    await sembrarSeisUnidades();
    await sembrarEgreso("gasto-1", { amount: 1_000_000 });

    const r = await repartirEgreso(entrada(), UID);

    expect(r.lines).toHaveLength(6);
    expect(r.lines.reduce((a, l) => a + l.amount, 0)).toBe(1_000_000);
    // Alguien tuvo que recibir el residuo: si nadie lo recibe, la suma no cierra.
    expect(r.lines.some((l) => l.roundingAdjustment > 0)).toBe(true);
  });

  it("CA3 · cada cargo guarda el coeficiente con el que se calculó", async () => {
    await sembrarCuatroUnidades();
    await sembrarEgreso("gasto-1");

    const r = await repartirEgreso(entrada(), UID);
    const cargos = await db.collection("billingStatements").where("campaignId", "==", r.campaignId).get();

    for (const d of cargos.docs) expect(d.data().distributionBasisValue).toBe(25);
  });

  it("CA4 · cambiar el coeficiente DESPUÉS no altera el importe del cargo ya emitido", async () => {
    await sembrarCuatroUnidades();
    await sembrarEgreso("gasto-1", { amount: 1_000_000 });

    const r = await repartirEgreso(entrada(), UID);
    const antes = (await db.collection("billingStatements").where("campaignId", "==", r.campaignId).get()).docs
      .map((d) => ({ id: d.id, amount: d.data().amount, base: d.data().distributionBasisValue }))
      .sort((a, b) => a.id.localeCompare(b.id));

    // El conjunto se reorganiza: una unidad pasa de 25 a 40.
    await db.collection("units").doc(`${T}-u0`).update({ coefficient: 40 });

    const despues = (await db.collection("billingStatements").where("campaignId", "==", r.campaignId).get()).docs
      .map((d) => ({ id: d.id, amount: d.data().amount, base: d.data().distributionBasisValue }))
      .sort((a, b) => a.id.localeCompare(b.id));

    expect(despues).toEqual(antes);
  });

  it("CA5 · trazabilidad en los DOS sentidos: del cargo al egreso y del egreso a sus cargos", async () => {
    await sembrarCuatroUnidades();
    await sembrarEgreso("gasto-1");

    const r = await repartirEgreso(entrada(), UID);

    // Del cargo a su factura.
    const cargos = await db.collection("billingStatements").where("campaignId", "==", r.campaignId).get();
    for (const d of cargos.docs) expect(d.data().sourceExpenseId).toBe("gasto-1");

    // De la factura a sus cargos, que es la consulta que sirve el índice nuevo.
    const desdeElEgreso = await db
      .collection("billingStatements")
      .where("tenantId", "==", T)
      .where("sourceExpenseId", "==", "gasto-1")
      .get();
    expect(desdeElEgreso.size).toBe(4);

    const corrida = await db.collection("billingCampaigns").doc(r.campaignId!).get();
    expect(corrida.data()!.sourceExpenseId).toBe("gasto-1");
    expect(corrida.data()!.totalDistributed).toBe(1_000_000);
  });

  it("CA6/CA7 · la vista previa calcula y NO crea ni un cargo", async () => {
    await sembrarCuatroUnidades();
    await sembrarEgreso("gasto-1");

    const r = await repartirEgreso(entrada({ dryRun: true }), UID);

    expect(r.dryRun).toBe(true);
    expect(r.lines).toHaveLength(4);
    expect(r.campaignId).toBeUndefined();
    expect((await db.collection("billingStatements").get()).size).toBe(0);
    expect((await db.collection("billingCampaigns").get()).size).toBe(0);
  });

  it("CA10 · un gasto de categoría ordinaria avisa de posible doble cobro Y deja continuar", async () => {
    await sembrarCuatroUnidades();
    await sembrarEgreso("gasto-1", { category: "servicios_publicos" });

    const r = await repartirEgreso(entrada(), UID);

    expect(r.avisoDobleCobro).toBe(true);
    // Avisa, no bloquea: los cargos existen.
    expect(r.campaignId).toBeDefined();
    expect((await db.collection("billingStatements").get()).size).toBe(4);
  });

  it("CA10 · el aviso también salta con los nombres VIEJOS de categoría, que son casi la mitad de los datos", async () => {
    // 48 de 130 egresos de los dos proyectos llevan `servicios` o `seguridad`,
    // que ya no existen en `ExpenseCategory`. Sin cubrirlos, el aviso se apaga
    // justo en los gastos más ordinarios que hay.
    await sembrarCuatroUnidades();
    for (const [i, cat] of ["servicios", "seguridad"].entries()) {
      await sembrarEgreso(`gasto-viejo-${i}`, { category: cat });
      const r = await repartirEgreso(
        entrada({ expenseId: `gasto-viejo-${i}`, operationKey: `op-viejo-${i}`, dryRun: true }),
        UID,
      );
      expect(r.avisoDobleCobro, `categoría «${cat}»`).toBe(true);
    }
  });

  it("un gasto NO ordinario no da el aviso — si diera siempre, el aviso no diría nada", async () => {
    await sembrarCuatroUnidades();
    await sembrarEgreso("gasto-1", { category: "proveedores" });

    expect((await repartirEgreso(entrada(), UID)).avisoDobleCobro).toBe(false);
  });

  it("R6 · repartir NO escribe ningún asiento del libro", async () => {
    await sembrarCuatroUnidades();
    await sembrarEgreso("gasto-1");

    await repartirEgreso(entrada(), UID);

    expect((await db.collection("ledgerEntries").get()).size).toBe(0);
  });

  it("idempotencia · dos confirmaciones con la misma clave crean UNA corrida", async () => {
    await sembrarCuatroUnidades();
    await sembrarEgreso("gasto-1");

    const uno = await repartirEgreso(entrada(), UID);
    const dos = await repartirEgreso(entrada(), UID);

    expect(uno.created).toBe(true);
    expect(dos.created).toBe(false);
    expect(dos.campaignId).toBe(uno.campaignId);
    expect((await db.collection("billingStatements").get()).size).toBe(4);
  });

  it("R5 · repartir un egreso YA repartido se rechaza, y se permite al confirmarlo aparte", async () => {
    await sembrarCuatroUnidades();
    await sembrarEgreso("gasto-1");
    await repartirEgreso(entrada(), UID);

    await expect(repartirEgreso(entrada({ operationKey: "op-2" }), UID)).rejects.toThrow(/ya se repartió/i);

    const otra = await repartirEgreso(entrada({ operationKey: "op-2", confirmarRepetido: true }), UID);
    expect(otra.created).toBe(true);
    expect((await db.collection("billingStatements").get()).size).toBe(8);
  });

  it("R5 · la vista previa del repetido NO se bloquea: tiene que poder enseñar el aviso", async () => {
    await sembrarCuatroUnidades();
    await sembrarEgreso("gasto-1");
    await repartirEgreso(entrada(), UID);

    const previa = await repartirEgreso(entrada({ operationKey: "op-2", dryRun: true }), UID);
    expect(previa.yaRepartido).toHaveLength(1);
  });
});

describe("FLOW-001 · lo que debe fallar al repartir", () => {
  it("CF2 · un egreso anulado no se puede repartir", async () => {
    await sembrarCuatroUnidades();
    await sembrarEgreso("gasto-1", { status: "anulado" });

    await expect(repartirEgreso(entrada(), UID)).rejects.toThrow(/anulado/i);
    expect((await db.collection("billingStatements").get()).size).toBe(0);
  });

  it("CF1 · con la suma de coeficientes en 99,8% queda bloqueado", async () => {
    await sembrarCuatroUnidades();
    await db.collection("units").doc(`${T}-u0`).update({ coefficient: 24.8 });
    await sembrarEgreso("gasto-1");

    await expect(repartirEgreso(entrada(), UID)).rejects.toThrow(/100%/);
  });

  it("una unidad sin coeficiente bloquea y se la NOMBRA", async () => {
    await sembrarCuatroUnidades();
    await db.collection("units").doc(`${T}-u0`).update({ coefficient: FieldValue.delete() });
    await sembrarEgreso("gasto-1");

    await expect(repartirEgreso(entrada(), UID)).rejects.toThrow(/101/);
  });

  it("el egreso de OTRO conjunto no se puede repartir aquí", async () => {
    await sembrarCuatroUnidades();
    await sembrarEgreso("gasto-ajeno", { tenantId: OTRO });

    await expect(repartirEgreso(entrada({ expenseId: "gasto-ajeno" }), UID)).rejects.toThrow(/no pertenece/i);
  });

  it("un egreso sin importe no se reparte", async () => {
    await sembrarCuatroUnidades();
    await sembrarEgreso("gasto-1", { amount: 0 });

    await expect(repartirEgreso(entrada(), UID)).rejects.toThrow(/importe/i);
  });
});

describe("FLOW-001 · anular la corrida", () => {
  async function repartoHecho() {
    await sembrarCuatroUnidades();
    await sembrarEgreso("gasto-1");
    return repartirEgreso(entrada(), UID);
  }

  it("CA8 · anular sin pagos deja los cargos anulados y la corrida anulada", async () => {
    const r = await repartoHecho();

    const res = await anularCorrida({ tenantId: T, campaignId: r.campaignId!, reason: "Se repartió por error" }, UID);
    expect(res.cancelled).toBe(4);

    const cargos = await db.collection("billingStatements").where("campaignId", "==", r.campaignId).get();
    for (const d of cargos.docs) {
      const c = d.data();
      // Los DOS caminos a la vez: el estado y el saldo. Seis sitios del producto
      // no conocen el estado nuevo y suman por `!== "paid"`; el saldo en cero es
      // lo que hace que su número siga saliendo bien.
      expect(c.status).toBe("cancelled");
      expect(c.balance).toBe(0);
      expect(c.cancellationReason).toBe("Se repartió por error");
      // El importe NO se toca: se pierde la deuda, no la historia.
      expect(c.amount).toBe(250_000);
    }

    const corrida = await db.collection("billingCampaigns").doc(r.campaignId!).get();
    expect(corrida.data()!.status).toBe("anulada");
  });

  it("CA8 · tras anular, el egreso vuelve a figurar como NO repartido", async () => {
    const r = await repartoHecho();
    await anularCorrida({ tenantId: T, campaignId: r.campaignId!, reason: "error" }, UID);

    // Y por eso repetirlo ya no exige confirmación: no hay corrida viva.
    const otra = await repartirEgreso(entrada({ operationKey: "op-2" }), UID);
    expect(otra.yaRepartido).toHaveLength(0);
    expect(otra.created).toBe(true);
  });

  it("CF3 · una corrida con un cargo con PAGOS no se anula, y se nombra la unidad", async () => {
    const r = await repartoHecho();
    const uno = (await db.collection("billingStatements").where("campaignId", "==", r.campaignId).get()).docs[0];
    await uno.ref.update({ paymentAmount: 50_000, balance: 200_000 });

    await expect(
      anularCorrida({ tenantId: T, campaignId: r.campaignId!, reason: "da igual" }, UID),
    ).rejects.toThrow(new RegExp(uno.data().unitLabel as string));

    // Y no anuló NINGUNO: se miran todos antes de tocar uno.
    const cargos = await db.collection("billingStatements").where("campaignId", "==", r.campaignId).get();
    expect(cargos.docs.every((d) => d.data().status !== "cancelled")).toBe(true);
  });

  it("CF3 · un cargo cubierto con un ANTICIPO también bloquea la anulación", async () => {
    const r = await repartoHecho();
    const uno = (await db.collection("billingStatements").where("campaignId", "==", r.campaignId).get()).docs[0];
    // `advanceAppliedAmount` va aparte de `paymentAmount` desde FLOW-002. Mirar
    // solo el segundo dejaría anular un cargo ya cubierto, y el saldo a favor
    // se evaporaría sin dejar rastro.
    await uno.ref.update({ advanceAppliedAmount: 250_000, balance: 0 });

    await expect(
      anularCorrida({ tenantId: T, campaignId: r.campaignId!, reason: "da igual" }, UID),
    ).rejects.toThrow(/pagos aplicados/i);
  });

  it("CF4 · anular sin motivo se rechaza, y un motivo en blanco tampoco vale", async () => {
    const r = await repartoHecho();

    await expect(anularCorrida({ tenantId: T, campaignId: r.campaignId!, reason: "" }, UID)).rejects.toThrow(/motivo/i);
    await expect(anularCorrida({ tenantId: T, campaignId: r.campaignId!, reason: "   " }, UID)).rejects.toThrow(/motivo/i);
  });

  it("anular la corrida de OTRO conjunto se rechaza", async () => {
    const r = await repartoHecho();

    await expect(
      anularCorrida({ tenantId: OTRO, campaignId: r.campaignId!, reason: "motivo" }, UID),
    ).rejects.toThrow(/no pertenece/i);
  });

  it("anular dos veces es inocuo: la segunda no vuelve a tocar nada", async () => {
    const r = await repartoHecho();
    await anularCorrida({ tenantId: T, campaignId: r.campaignId!, reason: "motivo" }, UID);

    const segunda = await anularCorrida({ tenantId: T, campaignId: r.campaignId!, reason: "motivo" }, UID);
    expect(segunda.alreadyCancelled).toBe(true);
    expect(segunda.cancelled).toBe(0);
  });
});
