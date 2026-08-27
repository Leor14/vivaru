import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { pasadaDeCalendarioDeCobranza, type ClaseDeAviso } from "../src/cobranza-programada";

/**
 * `PRD-V-FLOW-003` §5.2 — la pasada diaria del calendario.
 *
 * **El envío se inyecta**, así que esto prueba la orquestación entera sin mandar un correo. Lo que
 * vigila no es «manda»: es **a quién NO le manda, y cuándo NO vuelve a mandar**.
 *
 * Necesita el emulador:
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const HOY = new Date("2026-09-05T09:00:00Z");
let db: Firestore;

beforeAll(() => {
  if (getApps().length === 0) initializeApp({ projectId: "hogaru-1-test" });
  db = getFirestore();
});

beforeEach(async () => {
  for (const col of ["tenantSettings", "tenants", "featureFlags", "featureFlagOverrides"]) {
    const snap = await db.collection(col).get();
    const batch = db.batch();
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  // La bandera, encendida en global salvo que una prueba diga lo contrario.
  await db.collection("featureFlags").doc("producto-calendario-de-cobranza").set({ enabled: true });
});

async function conjunto(id: string, cal: Record<string, unknown>, status = "active") {
  await db.collection("tenants").doc(id).set({ name: id, status });
  await db.collection("tenantSettings").doc(id).set({ tenantId: id, billingCalendar: cal });
}

/** Registra a quién se le habría mandado. `true` = de verdad salió algo. */
function espia(devuelve = true) {
  const llamadas: { tenantId: string; clase: ClaseDeAviso }[] = [];
  const fn = async (tenantId: string, clase: ClaseDeAviso) => {
    llamadas.push({ tenantId, clase });
    return devuelve;
  };
  return { llamadas, fn };
}

describe("FLOW-003 · la pasada del calendario", () => {
  it("manda el aviso al conjunto cuyo día es hoy", async () => {
    await conjunto("uno", { noticeDayOfMonth: 5 });
    const e = espia();
    const r = await pasadaDeCalendarioDeCobranza(db, HOY, e.fn);

    expect(e.llamadas).toEqual([{ tenantId: "uno", clase: "aviso" }]);
    expect(r.enviados).toHaveLength(1);
  });

  it("no mira siquiera a quien no tiene calendario configurado", async () => {
    await conjunto("uno", {});
    const e = espia();
    const r = await pasadaDeCalendarioDeCobranza(db, HOY, e.fn);
    expect(r.conjuntosMirados).toBe(0);
    expect(e.llamadas).toHaveLength(0);
  });

  /**
   * **La bandera comprobada EN EL SERVIDOR**, que es lo que la hace freno y no botón. Apagada, esta
   * pasada no existe — la conducta de hoy, porque los dos procesos programados nunca han tenido
   * calendario.
   */
  it("con la bandera apagada no manda nada", async () => {
    await db.collection("featureFlags").doc("producto-calendario-de-cobranza").set({ enabled: false });
    await conjunto("uno", { noticeDayOfMonth: 5 });

    const e = espia();
    const r = await pasadaDeCalendarioDeCobranza(db, HOY, e.fn);
    expect(e.llamadas).toHaveLength(0);
    expect(r.saltados[0]?.motivo).toBe("bandera apagada");
  });

  /**
   * **R8 · el conjunto que no opera no cobra.** Es más estricto que la regla de escritura a
   * propósito. Y se comprueba sin lanzar: aquí no hay un cliente al que responderle, hay un cron
   * que tiene que seguir con los demás.
   */
  it.each(["suspended", "expired"])("R8 · un conjunto %s no manda nada", async (status) => {
    await conjunto("uno", { noticeDayOfMonth: 5 }, status);
    const e = espia();
    const r = await pasadaDeCalendarioDeCobranza(db, HOY, e.fn);
    expect(e.llamadas).toHaveLength(0);
    expect(r.saltados[0]?.motivo).toBe(`conjunto ${status}`);
  });

  it("un conjunto en prueba SÍ manda: comunicaciones es libre en el trial", async () => {
    await conjunto("uno", { noticeDayOfMonth: 5 }, "trial");
    const e = espia();
    await pasadaDeCalendarioDeCobranza(db, HOY, e.fn);
    expect(e.llamadas).toHaveLength(1);
  });

  /**
   * **La prueba del duplicado**, que es el fallo que no ve nadie del equipo: lo ve el
   * destinatario. Un cron puede correr dos veces —un reintento, un redespliegue a la hora justa—.
   */
  it("dos pasadas el mismo día mandan UNA vez", async () => {
    await conjunto("uno", { noticeDayOfMonth: 5 });
    const e = espia();
    await pasadaDeCalendarioDeCobranza(db, HOY, e.fn);
    await pasadaDeCalendarioDeCobranza(db, HOY, e.fn);
    expect(e.llamadas).toHaveLength(1);
  });

  it("deja escrita la fecha del último envío", async () => {
    await conjunto("uno", { noticeDayOfMonth: 5 });
    await pasadaDeCalendarioDeCobranza(db, HOY, espia().fn);
    const cal = (await db.collection("tenantSettings").doc("uno").get()).data()?.billingCalendar;
    expect(cal?.lastNoticeSentAt).toBe("2026-09-05");
  });

  /**
   * **Un ciclo sin morosos NO consume el turno.** Si lo consumiera, el conjunto se quedaría sin
   * aviso justo el día que sí tenga cartera vencida — y nadie relacionaría una cosa con la otra.
   */
  it("si no había nada que mandar, no se marca la fecha", async () => {
    await conjunto("uno", { overdueCycleDays: 7 });
    const e = espia(false);
    await pasadaDeCalendarioDeCobranza(db, HOY, e.fn);

    const cal = (await db.collection("tenantSettings").doc("uno").get()).data()?.billingCalendar;
    expect(cal?.lastOverdueSentAt).toBeUndefined();

    // Y al día siguiente lo vuelve a intentar, en vez de esperar un ciclo entero.
    const e2 = espia(true);
    await pasadaDeCalendarioDeCobranza(db, new Date("2026-09-06T09:00:00Z"), e2.fn);
    expect(e2.llamadas).toEqual([{ tenantId: "uno", clase: "vencidas" }]);
  });

  it("respeta el ciclo entre dos avisos de vencidas", async () => {
    await conjunto("uno", { overdueCycleDays: 7, lastOverdueSentAt: "2026-09-01" });
    const e = espia();
    await pasadaDeCalendarioDeCobranza(db, HOY, e.fn); // 5 de septiembre: solo van 4 días
    expect(e.llamadas).toHaveLength(0);

    await pasadaDeCalendarioDeCobranza(db, new Date("2026-09-08T09:00:00Z"), e.fn);
    expect(e.llamadas).toEqual([{ tenantId: "uno", clase: "vencidas" }]);
  });

  it("los dos avisos pueden caer el mismo día sin pisarse la marca", async () => {
    await conjunto("uno", { noticeDayOfMonth: 5, overdueCycleDays: 7 });
    const e = espia();
    await pasadaDeCalendarioDeCobranza(db, HOY, e.fn);

    expect(e.llamadas.map((l) => l.clase)).toEqual(["aviso", "vencidas"]);
    const cal = (await db.collection("tenantSettings").doc("uno").get()).data()?.billingCalendar;
    // Las DOS marcas, no una pisando a la otra.
    expect(cal?.lastNoticeSentAt).toBe("2026-09-05");
    expect(cal?.lastOverdueSentAt).toBe("2026-09-05");
    expect(cal?.noticeDayOfMonth).toBe(5);
  });

  /**
   * **La prueba que faltaba, y la encontró la falsación.** Marcar la fecha ANTES de enviar pasaba
   * todas las demás: la suite no vigilaba la decisión que el módulo documenta. Y al escribirla
   * apareció un hueco de verdad — un envío que lanza abortaba la pasada entera y dejaba sin aviso
   * a los conjuntos que venían detrás en el bucle.
   */
  it("si el envío LANZA, no se marca la fecha y el mes que viene se reintenta", async () => {
    await conjunto("uno", { noticeDayOfMonth: 5 });
    const revienta = async () => {
      throw new Error("el proveedor dijo que no");
    };

    const r = await pasadaDeCalendarioDeCobranza(db, HOY, revienta);
    expect(r.enviados).toHaveLength(0);
    expect(r.saltados[0]?.motivo).toBe("falló el envío de aviso");

    const cal = (await db.collection("tenantSettings").doc("uno").get()).data()?.billingCalendar;
    expect(cal?.lastNoticeSentAt).toBeUndefined();
  });

  it("un envío que revienta no aborta la pasada: los demás conjuntos siguen", async () => {
    await conjunto("malo", { noticeDayOfMonth: 5 });
    await conjunto("bueno", { noticeDayOfMonth: 5 });
    const vistos: string[] = [];
    const fn = async (tenantId: string) => {
      vistos.push(tenantId);
      if (tenantId === "malo") throw new Error("revienta");
      return true;
    };

    await pasadaDeCalendarioDeCobranza(db, HOY, fn);
    expect(vistos.sort()).toEqual(["bueno", "malo"]);
    const cal = (await db.collection("tenantSettings").doc("bueno").get()).data()?.billingCalendar;
    expect(cal?.lastNoticeSentAt).toBe("2026-09-05");
  });

  it("un conjunto que falla no impide que sigan los demás", async () => {
    await conjunto("uno", { noticeDayOfMonth: 5 }, "suspended");
    await conjunto("dos", { noticeDayOfMonth: 5 });
    const e = espia();
    await pasadaDeCalendarioDeCobranza(db, HOY, e.fn);
    expect(e.llamadas).toEqual([{ tenantId: "dos", clase: "aviso" }]);
  });
});
