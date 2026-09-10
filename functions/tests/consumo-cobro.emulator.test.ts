import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { generarCorridaDeConsumo } from "../src/medicion-de-consumos";

/**
 * `PRD-V-FEAT-008` entrega 2 — el cobro derivado del consumo. `CA4`, `CA5`,
 * `CA6` y `CA15`.
 *
 * **Contra el emulador y no con dobles, porque lo que hay que comprobar no es
 * que llame a Firestore: es QUÉ QUEDA ESCRITO.** El cargo lleva el consumo
 * congelado, la campaña lleva su base de reparto y las lecturas pasan a
 * `cobrado` — tres colecciones que tienen que quedar coherentes o el período se
 * puede cobrar dos veces.
 */

const T = "consumo-conjunto";
const SERVICIO = "consumo-agua";
const ADMIN = "consumo-admin";
const P = "2026-10";

let db: Firestore;

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  db = getFirestore();
});

async function limpiar(col: string, campo = "tenantId") {
  const s = await db.collection(col).where(campo, "==", T).get();
  await Promise.all(s.docs.map((d) => d.ref.delete()));
}

async function sembrar(lecturas: Array<{ unitId: string; consumption: number; foto?: boolean; base?: boolean }>) {
  await Promise.all([
    limpiar("meterReadings"), limpiar("billingStatements"),
    limpiar("billingCampaigns"), limpiar("units"),
  ]);
  await db.collection("meteredServices").doc(SERVICIO).set({
    tenantId: T, name: "Agua fría", unit: "m3", rate: 3200, accountCode: "1.11", active: true,
  });
  for (const u of ["u-101", "u-102", "u-103"]) {
    await db.collection("units").doc(`${T}--${u}`).set({
      tenantId: T, status: "active", displayName: u.toUpperCase().replace("U-", "EA-"),
    });
  }
  for (const l of lecturas) {
    await db.collection("meterReadings").doc(`${T}_${SERVICIO}_${l.unitId}_${P}`).set({
      tenantId: T, serviceId: SERVICIO, unitId: `${T}--${l.unitId}`, period: P,
      previous: 1000, current: 1000 + l.consumption, consumption: l.consumption,
      esLineaBase: l.base ?? false, status: "abierto",
      ...(l.foto === false ? {} : { photoUrl: "https://ejemplo/medidor.jpg" }),
    });
  }
}

const correr = (dryRun = false) =>
  generarCorridaDeConsumo({ tenantId: T, serviceId: SERVICIO, period: P, dryRun }, ADMIN);

describe("FEAT-008 · `CA4` y `CA5` · la corrida", () => {
  beforeEach(() => sembrar([
    { unitId: "u-101", consumption: 47 },
    { unitId: "u-102", consumption: 12.5 },
  ]));

  it("`CA5` · cobra consumo × tarifa a cada unidad", async () => {
    const r = await correr();
    expect(r.total).toBe(190400);
    const cargos = await db.collection("billingStatements").where("tenantId", "==", T).get();
    const porUnidad = Object.fromEntries(cargos.docs.map((d) => [d.data().unitLabel, d.data().amount]));
    expect(porUnidad).toEqual({ "EA-101": 150400, "EA-102": 40000 });
  });

  it("🔴 `CA6` · el cargo cae en la cuenta de CONSUMOS MEDIDOS, no en «otros ingresos»", async () => {
    // Si el concepto no existiera en el catálogo, `cuentaParaConcepto` caería en
    // 1.8 y la cuenta 1.11 se quedaría vacía para siempre.
    await correr();
    const cargos = await db.collection("billingStatements").where("tenantId", "==", T).get();
    for (const d of cargos.docs) {
      expect(d.data().accountCode).toBe("1.11");
      expect(d.data().concept).toBe("consumo_medido");
    }
  });

  it("el consumo viaja CONGELADO en el cargo", async () => {
    // Si mañana se corrige la lectura, el cargo sigue explicando por qué vale lo
    // que vale. Es lo mismo que hace el coeficiente en la corrida hermana.
    await correr();
    const cargos = await db.collection("billingStatements").where("tenantId", "==", T).get();
    const valores = cargos.docs.map((d) => d.data().distributionBasisValue).sort((a, b) => a - b);
    expect(valores).toEqual([12.5, 47]);
  });

  it("la campaña declara su base de reparto y su total", async () => {
    const r = await correr();
    const c = await db.collection("billingCampaigns").doc(r.campaignId!).get();
    expect(c.data()!.distributionBasis).toBe("consumption");
    expect(c.data()!.totalDistributed).toBe(190400);
    expect(c.data()!.unitCount).toBe(2);
    // `unitAmount` en 0 a propósito: esta corrida no tiene importe plano.
    expect(c.data()!.unitAmount).toBe(0);
  });

  it("`RN-05` · las lecturas pasan a `cobrado` y quedan selladas con su corrida", async () => {
    const r = await correr();
    const ls = await db.collection("meterReadings").where("tenantId", "==", T).get();
    for (const d of ls.docs) {
      expect(d.data().status).toBe("cobrado");
      expect(d.data().billingCampaignId).toBe(r.campaignId);
    }
  });

  it("`CA4` · NOMBRA la unidad activa que se quedó sin lectura", async () => {
    const r = await correr();
    expect(r.sinLectura).toEqual(["EA-103"]);
  });
});

describe("FEAT-008 · `CA15` · no se cobra dos veces", () => {
  beforeEach(() => sembrar([{ unitId: "u-101", consumption: 47 }]));

  it("la segunda corrida devuelve la que ya existe y NO crea cargos nuevos", async () => {
    const primera = await correr();
    expect(primera.created).toBe(true);

    const segunda = await correr();
    expect(segunda.created).toBe(false);
    expect(segunda.campaignId).toBe(primera.campaignId);

    // Lo que de verdad importa: que no haya dos cargos sobre la misma unidad.
    const cargos = await db.collection("billingStatements").where("tenantId", "==", T).get();
    expect(cargos.size).toBe(1);
  });
});

describe("FEAT-008 · la vista previa no escribe", () => {
  beforeEach(() => sembrar([{ unitId: "u-101", consumption: 47 }]));

  it("`dryRun` calcula el reparto y deja las tres colecciones intactas", async () => {
    const r = await correr(true);
    expect(r.dryRun).toBe(true);
    expect(r.total).toBe(150400);
    expect(r.campaignId).toBeUndefined();

    const [cargos, campanas, lecturas] = await Promise.all([
      db.collection("billingStatements").where("tenantId", "==", T).get(),
      db.collection("billingCampaigns").where("tenantId", "==", T).get(),
      db.collection("meterReadings").where("tenantId", "==", T).get(),
    ]);
    expect(cargos.size).toBe(0);
    expect(campanas.size).toBe(0);
    // Y las lecturas siguen editables.
    expect(lecturas.docs.every((d) => d.data().status === "abierto")).toBe(true);
  });
});

describe("FEAT-008 · lo que debe fallar", () => {
  it("`RN-09` · no cobra si falta alguna foto, y NOMBRA la unidad", async () => {
    await sembrar([
      { unitId: "u-101", consumption: 47 },
      { unitId: "u-102", consumption: 10, foto: false },
    ]);
    await expect(correr()).rejects.toMatchObject({ code: "failed-precondition" });
    // Y no dejó nada a medias.
    const cargos = await db.collection("billingStatements").where("tenantId", "==", T).get();
    expect(cargos.size).toBe(0);
  });

  it("`RN-05` · no cobra lecturas ya cobradas cuya corrida ya no existe", async () => {
    // El caso raro, que es para lo que queda `RN-05` tras invertir el orden: un
    // dato inconsistente —lecturas selladas sin su corrida— merece error, no una
    // corrida nueva sobre un período que alguien ya cobró.
    await sembrar([{ unitId: "u-101", consumption: 47 }]);
    const primera = await correr();
    await db.collection("billingCampaigns").doc(primera.campaignId!).delete();
    await expect(correr()).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("no cobra un período sin ninguna lectura", async () => {
    await sembrar([]);
    await expect(correr()).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("no cobra si NADIE tiene consumo — sería una corrida de cargos en cero", async () => {
    await sembrar([{ unitId: "u-101", consumption: 0 }]);
    await expect(correr()).rejects.toMatchObject({ code: "failed-precondition" });
  });
});
