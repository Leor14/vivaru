import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { runGateway, type GatewayRequest } from "../src/ai/gateway";
import { fakeAiProvider } from "../src/ai/provider";
import { AI_QUOTA_COLLECTION, counterIds } from "../src/ai/quota";
import { AI_USAGE_COLLECTION } from "../src/ai/usage";

/**
 * Las pruebas que importan — Paso 1.7 de docs/hoja-de-ruta-ia.md.
 *
 * Cierran la puerta G3: «cuando falle —va a fallar— ¿qué se rompe y cómo lo
 * apagamos?». No prueban piezas sueltas, que ya están probadas: prueban la
 * COSTURA entre ellas, que es donde sobreviven los fallos cuando cada unidad
 * está verde.
 *
 * Cuatro preguntas, en orden de gravedad:
 *   1. ¿Puede un conjunto ejecutar como otro? (fuga entre conjuntos)
 *   2. ¿El kill switch cierra de verdad?
 *   3. ¿Qué pasa cuando el proveedor no responde?
 *   4. ¿La telemetría filtra contenido?
 *
 * Necesita el emulador:
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const OPERACION = "comunicaciones-redactar";
const BANDERA_OPERACION = "ai-communications-draft";

const ENTRADA = {
  proposito: "Avisar del corte de agua programado para el sábado",
  hechos: ["El corte va de 8:00 a 14:00", "Afecta a las torres 1 y 2"],
  tono: "informativo" as const,
};

const SALIDA_VALIDA = JSON.stringify({
  title: "Corte de agua programado",
  body: "El sábado habrá corte de agua de 8:00 a 14:00.",
  notificationSummary: "Corte de agua el sábado",
  missingInformation: [],
  qualityFlags: [],
  assumptions: [],
});

let db: Firestore;
let n = 0;
const nuevoConjunto = () => `g3-${Date.now()}-${n++}`;

/** Sesión válida: claims + membresía viva en el conjunto. */
async function sembrarAdmin(tenantId: string, uid = "admin-1") {
  await db.collection("tenantUsers").doc(`${tenantId}_${uid}`).set({
    uid,
    tenantId,
    role: "tenant_admin",
    status: "active",
  });
}

function peticion(tenantId: string, uid = "admin-1", data: unknown = { operationKey: OPERACION, input: ENTRADA }): GatewayRequest {
  return { app: {}, auth: { uid, token: { tenantId, role: "tenant_admin" } }, data };
}

const proveedorBueno = () => fakeAiProvider({ text: SALIDA_VALIDA });

async function ponerBandera(id: string, data: Record<string, unknown>) {
  await db.collection("featureFlags").doc(id).set(data, { merge: true });
}

async function filasDeUso(tenantId: string) {
  const snap = await db.collection(AI_USAGE_COLLECTION).where("tenantId", "==", tenantId).get();
  return snap.docs.map((d) => d.data());
}

beforeAll(async () => {
  if (getApps().length === 0) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  db = getFirestore();

  try {
    await db.collection("__ping").doc("ping").set({ ok: true });
  } catch (error) {
    throw new Error(
      `No hay emulador de Firestore en ${process.env.FIRESTORE_EMULATOR_HOST}. ` +
        `Levántalo con: firebase emulators:start --only firestore --project hogaru-1-test\n${error}`,
    );
  }
});

beforeEach(async () => {
  // Estado de partida: plataforma y capacidad encendidas, sin kill switches.
  await ponerBandera("_global", { killSwitch: false });
  await ponerBandera("ai-gateway", { enabled: true, killSwitch: false });
  await ponerBandera(BANDERA_OPERACION, { enabled: true, killSwitch: false });
});

describe("G3 · ¿puede un conjunto ejecutar como otro?", () => {
  it("rechaza el tenantId ajeno en la petición, y ni siquiera cobra cuota", async () => {
    const propio = nuevoConjunto();
    const ajeno = nuevoConjunto();
    await sembrarAdmin(propio);

    const outcome = await runGateway(
      peticion(propio, "admin-1", { operationKey: OPERACION, input: ENTRADA, tenantId: ajeno }),
      { provider: proveedorBueno() },
    );

    expect(outcome).toMatchObject({ ok: false, reason: "tenant_en_la_peticion" });

    // Y no dejó rastro en ninguno de los dos conjuntos.
    const ids = counterIds(OPERACION, propio, "admin-1");
    expect((await db.collection(AI_QUOTA_COLLECTION).doc(ids.conjuntoDia).get()).exists).toBe(false);
    expect(await filasDeUso(ajeno)).toHaveLength(0);
  });

  it("la cuota y la telemetría se escriben SIEMPRE con el conjunto de la sesión", async () => {
    // El corazón del aislamiento: aunque todo lo demás fallara, lo que se
    // contabiliza y se factura tiene que ser el conjunto de quien llamó.
    const tenantId = nuevoConjunto();
    await sembrarAdmin(tenantId);

    const outcome = await runGateway(peticion(tenantId), { provider: proveedorBueno() });
    expect(outcome.ok).toBe(true);

    const ids = counterIds(OPERACION, tenantId, "admin-1");
    const contador = await db.collection(AI_QUOTA_COLLECTION).doc(ids.conjuntoDia).get();
    expect(contador.data()).toMatchObject({ tenantId, count: 1 });

    const filas = await filasDeUso(tenantId);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ tenantId, uid: "admin-1", operationKey: OPERACION, outcome: "ok" });
  });

  it("un usuario sin membresía en el conjunto de sus claims no pasa", async () => {
    // Claims que sobrevivieron a una baja: el documento manda.
    const tenantId = nuevoConjunto();

    const outcome = await runGateway(peticion(tenantId), { provider: proveedorBueno() });
    expect(outcome).toMatchObject({ ok: false, reason: "sin_membresia" });
  });

  it("agotar el conjunto de al lado no afecta al propio", async () => {
    const vecino = nuevoConjunto();
    const propio = nuevoConjunto();
    await sembrarAdmin(vecino);
    await sembrarAdmin(propio);

    // El vecino consume varias.
    for (let i = 0; i < 3; i++) {
      await runGateway(peticion(vecino), { provider: proveedorBueno() });
    }

    const outcome = await runGateway(peticion(propio), { provider: proveedorBueno() });
    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.cuotaRestante.conjuntoDia).toBe(49);
  });
});

describe("G3 · ¿el kill switch cierra de verdad?", () => {
  it("el kill switch MAESTRO cierra la puerta con todo lo demás en orden", async () => {
    // Nadie había comprobado que el cable estuviera conectado: las banderas
    // tenían pruebas de precedencia y la puerta tenía pruebas de decisión, pero
    // la costura entre Firestore y el rechazo, no.
    const tenantId = nuevoConjunto();
    await sembrarAdmin(tenantId);

    await ponerBandera("_global", { killSwitch: true, reason: "prueba G3" });

    const outcome = await runGateway(peticion(tenantId), { provider: proveedorBueno() });
    expect(outcome).toMatchObject({ ok: false, reason: "puerta_apagada" });
    expect(outcome.ok === false && outcome.message).toBeTruthy();
  });

  it("surte efecto en la siguiente llamada, sin reiniciar ni desplegar nada", async () => {
    // Si hubiera caché, apagar sería «apagar dentro de un rato».
    const tenantId = nuevoConjunto();
    await sembrarAdmin(tenantId);

    expect((await runGateway(peticion(tenantId), { provider: proveedorBueno() })).ok).toBe(true);

    await ponerBandera("_global", { killSwitch: true });
    expect((await runGateway(peticion(tenantId), { provider: proveedorBueno() })).ok).toBe(false);

    await ponerBandera("_global", { killSwitch: false });
    expect((await runGateway(peticion(tenantId), { provider: proveedorBueno() })).ok).toBe(true);
  });

  it("el kill switch de la bandera gana a un override que la encendía", async () => {
    const tenantId = nuevoConjunto();
    await sembrarAdmin(tenantId);

    await db.collection("featureFlagOverrides").doc(tenantId).set({ flags: { "ai-gateway": true } });
    await ponerBandera("ai-gateway", { enabled: true, killSwitch: true });

    const outcome = await runGateway(peticion(tenantId), { provider: proveedorBueno() });
    expect(outcome).toMatchObject({ ok: false, reason: "puerta_apagada" });
  });

  it("apagar una capacidad no apaga la plataforma", async () => {
    const tenantId = nuevoConjunto();
    await sembrarAdmin(tenantId);

    await ponerBandera(BANDERA_OPERACION, { enabled: false });

    const outcome = await runGateway(peticion(tenantId), { provider: proveedorBueno() });
    expect(outcome).toMatchObject({ ok: false, reason: "capacidad_apagada" });
  });

  it("se puede apagar para un conjunto y dejarla al vecino", async () => {
    const apagado = nuevoConjunto();
    const encendido = nuevoConjunto();
    await sembrarAdmin(apagado);
    await sembrarAdmin(encendido);

    await db.collection("featureFlagOverrides").doc(apagado).set({ flags: { [BANDERA_OPERACION]: false } });

    expect((await runGateway(peticion(apagado), { provider: proveedorBueno() })).ok).toBe(false);
    expect((await runGateway(peticion(encendido), { provider: proveedorBueno() })).ok).toBe(true);
  });

  it("con la puerta apagada no se cobra cuota", async () => {
    const tenantId = nuevoConjunto();
    await sembrarAdmin(tenantId);
    await ponerBandera("_global", { killSwitch: true });

    await runGateway(peticion(tenantId), { provider: proveedorBueno() });

    const ids = counterIds(OPERACION, tenantId, "admin-1");
    expect((await db.collection(AI_QUOTA_COLLECTION).doc(ids.conjuntoDia).get()).exists).toBe(false);
  });
});

describe("G3 · ¿qué pasa cuando el proveedor no responde?", () => {
  it("proveedor caído: devuelve la cuota, registra el fallo y manda al flujo manual", async () => {
    const tenantId = nuevoConjunto();
    await sembrarAdmin(tenantId);

    const outcome = await runGateway(peticion(tenantId), {
      provider: fakeAiProvider({ throws: new Error("503 del proveedor") }),
    });

    expect(outcome).toMatchObject({ ok: false, code: "unavailable", reason: "proveedor_error" });
    expect(outcome.ok === false && outcome.message).toContain("proceso manual");

    // Cuota devuelta: un proveedor caído no puede dejar al conjunto sin cuota.
    const ids = counterIds(OPERACION, tenantId, "admin-1");
    expect((await db.collection(AI_QUOTA_COLLECTION).doc(ids.conjuntoDia).get()).data()?.count).toBe(0);

    // Pero el fallo SÍ queda registrado.
    const filas = await filasDeUso(tenantId);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ outcome: "proveedor_error" });
  });

  it("contrato incumplido: la cuota NO se devuelve, porque los tokens se gastaron", async () => {
    const tenantId = nuevoConjunto();
    await sembrarAdmin(tenantId);

    const conSupuestos = JSON.stringify({ ...JSON.parse(SALIDA_VALIDA), assumptions: ["me lo inventé"] });
    const outcome = await runGateway(peticion(tenantId), { provider: fakeAiProvider({ text: conSupuestos }) });

    expect(outcome).toMatchObject({ ok: false, reason: "salida_incumple_contrato" });

    const ids = counterIds(OPERACION, tenantId, "admin-1");
    expect((await db.collection(AI_QUOTA_COLLECTION).doc(ids.conjuntoDia).get()).data()?.count).toBe(1);
  });

  it("ningún fallo devuelve una salida a medias", async () => {
    const tenantId = nuevoConjunto();
    await sembrarAdmin(tenantId);

    const outcome = await runGateway(peticion(tenantId), { provider: fakeAiProvider({ text: "no soy JSON" }) });

    expect(outcome.ok).toBe(false);
    expect(outcome).not.toHaveProperty("output");
  });
});

describe("G3 · ¿la telemetría filtra contenido?", () => {
  it("la fila de uso NO contiene nada de lo que escribió el administrador", async () => {
    // La regla del Paso 0 es «metadatos sí, contenido no». Aquí se comprueba
    // sobre el documento real, no sobre la buena intención del tipo.
    const tenantId = nuevoConjunto();
    await sembrarAdmin(tenantId);

    await runGateway(peticion(tenantId), { provider: proveedorBueno() });

    const filas = await filasDeUso(tenantId);
    const serializada = JSON.stringify(filas[0]);

    expect(serializada).not.toContain("corte de agua");
    expect(serializada).not.toContain("Corte de agua");
    expect(serializada).not.toContain("torres 1 y 2");
    expect(serializada).not.toContain("8:00");
  });

  it("registra costo y latencia para poder responder cuánto se gastó", async () => {
    const tenantId = nuevoConjunto();
    await sembrarAdmin(tenantId);

    await runGateway(peticion(tenantId), { provider: proveedorBueno() });

    const fila = (await filasDeUso(tenantId))[0];
    expect(fila).toHaveProperty("estimatedCostUsd");
    expect(fila).toHaveProperty("priceTableVersion");
    expect(typeof fila.latencyMs).toBe("number");
  });
});

describe("G3 · la cuota corta y el flujo manual sigue", () => {
  it("al agotarse la cuota se rechaza sin llamar al proveedor", async () => {
    const tenantId = nuevoConjunto();
    await sembrarAdmin(tenantId);

    // 20 es el tope por usuario del catálogo.
    for (let i = 0; i < 20; i++) {
      expect((await runGateway(peticion(tenantId), { provider: proveedorBueno() })).ok).toBe(true);
    }

    let llamado = false;
    const espia = fakeAiProvider({ text: SALIDA_VALIDA });
    const proveedorEspia = {
      name: espia.name,
      generate: async (r: Parameters<typeof espia.generate>[0]) => {
        llamado = true;
        return espia.generate(r);
      },
    };

    const outcome = await runGateway(peticion(tenantId), { provider: proveedorEspia });

    expect(outcome).toMatchObject({ ok: false, code: "resource-exhausted" });
    expect(outcome.ok === false && outcome.message).toContain("proceso manual");
    // Lo que protege el bolsillo: la cuota corta ANTES de gastar.
    expect(llamado).toBe(false);
  });
});

/**
 * El contexto del conjunto llega hasta el modelo — 14 de agosto de 2026.
 *
 * Cada pieza está probada por su cuenta: el módulo que deduce el dato (puro) y
 * el que lo escribe en el mensaje (puro). **Lo que aquí se prueba es la costura**
 * —Firestore → puerta → prompt—, que es donde el Paso 1.7 descubrió que el kill
 * switch estaba bien «por suerte, no por prueba».
 */
describe("el contexto del conjunto sale de la base de datos y llega al prompt", () => {
  /** Provoca una llamada y devuelve el mensaje exacto que recibió el proveedor. */
  async function promptDe(tenantId: string): Promise<string> {
    let capturado = "";
    const base = fakeAiProvider({ text: SALIDA_VALIDA });
    const espia = {
      name: base.name,
      generate: async (r: Parameters<typeof base.generate>[0]) => {
        capturado = r.prompt;
        return base.generate(r);
      },
    };
    const outcome = await runGateway(peticion(tenantId), { provider: espia });
    expect(outcome.ok).toBe(true);
    return capturado;
  }

  async function sembrarUnidades(tenantId: string, torres: string[]) {
    await Promise.all(
      torres.map((tower, i) =>
        db.collection("units").doc(`${tenantId}-u${i}`).set({ tenantId, tower, displayName: `${tower} ${i}` }),
      ),
    );
  }

  it("un conjunto con varias torres recibe que las tiene", async () => {
    const tenantId = nuevoConjunto();
    await sembrarAdmin(tenantId);
    await sembrarUnidades(tenantId, ["Torre 1", "Torre 2", "Torre 1"]);

    expect(await promptDe(tenantId)).toContain("dividido en varias agrupaciones");
  });

  it("un edificio de un solo bloque recibe que no las tiene", async () => {
    const tenantId = nuevoConjunto();
    await sembrarAdmin(tenantId);
    await sembrarUnidades(tenantId, ["Principal", "Principal"]);

    const prompt = await promptDe(tenantId);
    expect(prompt).toContain("edificio único");
    expect(prompt).toContain("pisos y zonas comunes");
  });

  it("un conjunto sin unidades no recibe nada, y el borrador sale igual", async () => {
    // Un conjunto recién dado de alta no es un edificio único: no se sabe. Y no
    // saberlo no puede impedir que alguien redacte un aviso.
    const tenantId = nuevoConjunto();
    await sembrarAdmin(tenantId);

    const prompt = await promptDe(tenantId);
    expect(prompt).not.toContain("edificio único");
    expect(prompt).not.toContain("dividido en varias agrupaciones");
  });

  it("las unidades del vecino no cuentan", async () => {
    // Misma garantía de aislamiento que el resto de la puerta, aplicada al dato
    // nuevo: el conjunto de la sesión es el único que se lee.
    const conTorres = nuevoConjunto();
    const unico = nuevoConjunto();
    await sembrarAdmin(conTorres);
    await sembrarAdmin(unico);
    await sembrarUnidades(conTorres, ["Torre 1", "Torre 2"]);
    await sembrarUnidades(unico, ["Principal"]);

    expect(await promptDe(unico)).toContain("edificio único");
    expect(await promptDe(conTorres)).toContain("dividido en varias agrupaciones");
  });
});
