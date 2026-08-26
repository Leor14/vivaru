import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { anularPazYSalvo, emitirPazYSalvo } from "../src/clearance-certificates";

/**
 * `PRD-V-FEAT-004` — el certificado de paz y salvo.
 *
 * **Lo que estas pruebas vigilan es que el documento NO se emita cuando no debe.**
 * Es un papel que se enseña ante un tercero: un falso positivo aquí no es un
 * número mal pintado, es el conjunto afirmando por escrito algo que no es cierto.
 * Por eso hay más criterios que fallan que que pasan, y por eso el saldo se lee
 * de `balance` —la misma cifra que enseñan la cartera y el estado de cuenta— y no
 * de una resta propia que podría divergir.
 *
 * Necesita el emulador:
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const T = "feat004-conjunto";
const OTRO = "feat004-otro";
const U = "feat004-unidad";
const UID = "feat004-admin";

let db: Firestore;

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  db = getFirestore();
});

async function limpiar(col: string) {
  const snap = await db.collection(col).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function sembrarCargo(
  id: string,
  extra: { balance?: number; status?: string; period?: string; unitId?: string; tenantId?: string } = {},
) {
  await db.collection("billingStatements").doc(id).set({
    tenantId: extra.tenantId ?? T,
    unitId: extra.unitId ?? U,
    unitLabel: "101",
    period: extra.period ?? "2026-01",
    amount: 100_000,
    paymentAmount: 100_000 - (extra.balance ?? 0),
    balance: extra.balance ?? 0,
    status: extra.status ?? (extra.balance ? "pending" : "paid"),
  });
}

const entrada = (extra: Partial<Parameters<typeof emitirPazYSalvo>[0]> = {}) => ({
  tenantId: T,
  unitId: U,
  issueDate: "2026-08-25",
  operationKey: "pys-1",
  ...extra,
});

beforeEach(async () => {
  for (const c of ["billingStatements", "clearanceCertificates", "advances", "units"]) await limpiar(c);
});

describe("FEAT-004 · emitir el paz y salvo", () => {
  it("CA4 · una unidad al día lo emite, con fecha y código", async () => {
    await sembrarCargo("c1", { balance: 0 });

    const r = await emitirPazYSalvo(entrada(), UID);

    expect(r.created).toBe(true);
    expect(r.balanceAtIssue).toBe(0);
    expect(r.code).toMatch(/^PYS-[A-Z0-9]{6}$/);

    const doc = await db.collection("clearanceCertificates").doc(r.certificateId).get();
    expect(doc.data()!.status).toBe("emitido");
    expect(doc.data()!.issuedAt).toBe("2026-08-25");
    // R6, la mitad que sí se implementa: el documento declara a qué fecha aplica.
    expect(doc.data()!.asOfDate).toBe("2026-08-25");
  });

  it("CA6 · una unidad SIN movimientos lo emite — no deber nada es no deber nada", async () => {
    const r = await emitirPazYSalvo(entrada(), UID);
    expect(r.created).toBe(true);
    expect(r.balanceAtIssue).toBe(0);
  });

  it("CA5/R4 · con saldo a FAVOR se emite, y el documento lo nombra", async () => {
    await sembrarCargo("c1", { balance: 0 });
    await db.collection("advances").doc("a1").set({ tenantId: T, unitId: U, status: "open", remaining: 45_000 });
    // Un anticipo agotado no debe sumar: si sumara, el papel diría que hay
    // dinero a favor que ya se gastó.
    await db.collection("advances").doc("a2").set({ tenantId: T, unitId: U, status: "closed", remaining: 30_000 });

    const r = await emitirPazYSalvo(entrada(), UID);

    expect(r.creditBalance).toBe(45_000);
    expect((await db.collection("clearanceCertificates").doc(r.certificateId).get()).data()!.creditBalance).toBe(45_000);
  });

  it("CA9/R5 · un cargo ANULADO no impide emitirlo", async () => {
    await sembrarCargo("c1", { balance: 0 });
    // Un anulado ya lleva `balance` en cero, así que este caso comprueba el
    // OTRO camino: que tampoco cuente por estado si alguien dejara el saldo.
    await db.collection("billingStatements").doc("c2").set({
      tenantId: T, unitId: U, unitLabel: "101", period: "2026-02",
      amount: 250_000, paymentAmount: 0, balance: 250_000, status: "cancelled",
    });

    const r = await emitirPazYSalvo(entrada(), UID);
    expect(r.created).toBe(true);
    expect(r.balanceAtIssue).toBe(0);
  });

  it("idempotencia · dos peticiones con la misma clave emiten UN certificado", async () => {
    await sembrarCargo("c1", { balance: 0 });

    const uno = await emitirPazYSalvo(entrada(), UID);
    const dos = await emitirPazYSalvo(entrada(), UID);

    expect(uno.created).toBe(true);
    expect(dos.created).toBe(false);
    expect(dos.certificateId).toBe(uno.certificateId);
    expect(dos.code).toBe(uno.code);
    expect((await db.collection("clearanceCertificates").get()).size).toBe(1);
  });

  it("el saldo de OTRA unidad no cuenta — si contara, nadie al día podría emitirlo", async () => {
    await sembrarCargo("mia", { balance: 0 });
    await sembrarCargo("vecina", { balance: 900_000, unitId: "otra-unidad" });

    const r = await emitirPazYSalvo(entrada(), UID);
    expect(r.created).toBe(true);
  });
});

describe("FEAT-004 · las DOS claves de unidad", () => {
  /**
   * En `billingStatements` conviven el id del documento de la unidad y su campo
   * `unitId`, que es un slug. Medido en producción: 197 cargos por id y 19 por
   * campo, con TRES conjuntos que tienen las dos. Mirar solo una dejaría fuera
   * la deuda escrita con la otra — y este documento afirma que no hay ninguna.
   */
  it("una deuda escrita con la clave ALTERNA bloquea igual: si no, se certifica al día a quien debe", async () => {
    await db.collection("units").doc(U).set({ tenantId: T, unitId: "slug-101", displayName: "101", status: "active" });
    // Al día por el id del documento…
    await sembrarCargo("porId", { balance: 0 });
    // …y debiendo por el slug, que es como estan escritos los cargos viejos.
    await sembrarCargo("porSlug", { balance: 75_000, unitId: "slug-101", period: "2026-02" });

    await expect(emitirPazYSalvo(entrada(), UID)).rejects.toThrow(/75000/);
  });

  it("y AL REVÉS: pidiéndolo con el slug, la deuda del id del documento también bloquea", async () => {
    // La primera version de esta guarda solo servia en un sentido: con el slug,
    // `units/{slug}` no existe y la clave alterna salia vacia. El agujero que
    // pretendia cerrar seguia abierto por el otro lado.
    await db.collection("units").doc(U).set({ tenantId: T, unitId: "slug-101", displayName: "101", status: "active" });
    await sembrarCargo("porId", { balance: 90_000, period: "2026-03" });
    await sembrarCargo("porSlug", { balance: 0, unitId: "slug-101" });

    await expect(emitirPazYSalvo(entrada({ unitId: "slug-101" }), UID)).rejects.toThrow(/90000/);
  });

  it("y con las dos claves en cero SÍ se emite — la guarda no puede quedarse pegada", async () => {
    await db.collection("units").doc(U).set({ tenantId: T, unitId: "slug-101", displayName: "101", status: "active" });
    await sembrarCargo("porId", { balance: 0 });
    await sembrarCargo("porSlug", { balance: 0, unitId: "slug-101", period: "2026-02" });

    const r = await emitirPazYSalvo(entrada(), UID);
    expect(r.created).toBe(true);
  });
});

describe("FEAT-004 · el cargo HUERFANO, que no casa con ninguna unidad", () => {
  /**
   * Medido en producción: `tenant-santa-maria` tiene la unidad `u-t1-101` con
   * sus cargos partidos en DOS claves —`u-t1-101` (3.360.000) y `unit-t1-101`
   * (3.580.000)— y la segunda no existe como unidad, ni por id ni por campo. La
   * deuda real de T1-101 es 6.940.000 y cualquier consulta por clave enseña
   * menos de la mitad.
   *
   * Lo único que ata esos cargos a su unidad es la ETIQUETA.
   */
  it("una deuda con `unitId` huérfano pero la MISMA etiqueta bloquea igual", async () => {
    await db.collection("units").doc(U).set({ tenantId: T, unitId: U, displayName: "101", status: "active" });
    await sembrarCargo("porClave", { balance: 0 });
    // Ni id ni campo: solo comparte etiqueta, como los cinco de produccion.
    await sembrarCargo("huerfano", { balance: 640_000, unitId: "clave-que-no-existe", period: "2026-05" });

    await expect(emitirPazYSalvo(entrada({ unitLabel: "101" }), UID)).rejects.toThrow(/640000/);
  });

  it("R4 · el saldo a favor guardado con la clave ALTERNA también se nombra", async () => {
    // El arreglo de la deuda dejo este consultando una sola clave: el papel
    // decia «a favor 0» a quien si tenia dinero puesto. El error va en la
    // direccion contraria —callar credito en vez de deuda— y por eso no bloquea
    // la emision, pero R4 obliga a NOMBRARLO.
    await db.collection("units").doc(U).set({ tenantId: T, unitId: "slug-101", displayName: "101", status: "active" });
    await sembrarCargo("c1", { balance: 0 });
    await db.collection("advances").doc("a1").set({ tenantId: T, unitId: "slug-101", status: "open", remaining: 33_000 });

    const r = await emitirPazYSalvo(entrada(), UID);
    expect(r.creditBalance).toBe(33_000);
  });

  it("y un cargo que llega por DOS vías no se cuenta dos veces", async () => {
    // Si se duplicara, un saldo de 0 seguiria siendo 0 y no se notaria; el caso
    // que lo delata es uno con saldo, que se contaria por clave Y por etiqueta.
    await db.collection("units").doc(U).set({ tenantId: T, unitId: U, displayName: "101", status: "active" });
    await sembrarCargo("porLasDos", { balance: 50_000, period: "2026-06" });

    await expect(emitirPazYSalvo(entrada({ unitLabel: "101" }), UID)).rejects.toThrow(/pendiente de 50000/);
  });
});

describe("FEAT-004 · lo que NO debe emitirse", () => {
  it("CF1 · con saldo pendiente NO se emite, y se dice cuánto y desde cuándo", async () => {
    await sembrarCargo("c1", { balance: 60_000, period: "2026-03" });

    await expect(emitirPazYSalvo(entrada(), UID)).rejects.toThrow(/60000/);
    await expect(emitirPazYSalvo(entrada(), UID)).rejects.toThrow(/2026-03/);
    expect((await db.collection("clearanceCertificates").get()).size).toBe(0);
  });

  it("CF1 · un saldo de UN peso también bloquea: la condición es cero, no «casi»", async () => {
    await sembrarCargo("c1", { balance: 1 });
    await expect(emitirPazYSalvo(entrada(), UID)).rejects.toThrow(/saldo pendiente/i);
  });

  it("el saldo de la unidad se suma entero: dos cargos a medias también bloquean", async () => {
    await sembrarCargo("c1", { balance: 0 });
    await sembrarCargo("c2", { balance: 30_000, period: "2026-02" });
    await sembrarCargo("c3", { balance: 20_000, period: "2026-04" });

    await expect(emitirPazYSalvo(entrada(), UID)).rejects.toThrow(/50000/);
  });
});

describe("FEAT-004 · anular el certificado", () => {
  async function emitido() {
    await sembrarCargo("c1", { balance: 0 });
    return emitirPazYSalvo(entrada(), UID);
  }

  it("CA10 · anular lo marca y conserva el motivo y el autor", async () => {
    const r = await emitido();

    const res = await anularPazYSalvo({ tenantId: T, certificateId: r.certificateId, reason: "Se emitió con la unidad equivocada" }, UID);
    expect(res.alreadyCancelled).toBe(false);

    const d = (await db.collection("clearanceCertificates").doc(r.certificateId).get()).data()!;
    expect(d.status).toBe("anulado");
    expect(d.anuladoMotivo).toBe("Se emitió con la unidad equivocada");
    expect(d.anuladoPor).toBe(UID);
    // No se borra: el papel ya salió del sistema y el conjunto tiene que poder
    // saber que existió y fue retirado.
    expect(d.code).toBe(r.code);
  });

  it("CF4 · anular sin motivo se rechaza, y en blanco tampoco vale", async () => {
    const r = await emitido();
    await expect(anularPazYSalvo({ tenantId: T, certificateId: r.certificateId, reason: "" }, UID)).rejects.toThrow(/motivo/i);
    await expect(anularPazYSalvo({ tenantId: T, certificateId: r.certificateId, reason: "  " }, UID)).rejects.toThrow(/motivo/i);
  });

  it("el certificado de OTRO conjunto no se puede anular desde aquí", async () => {
    const r = await emitido();
    await expect(
      anularPazYSalvo({ tenantId: OTRO, certificateId: r.certificateId, reason: "motivo" }, UID),
    ).rejects.toThrow(/no pertenece/i);
  });

  it("anular dos veces es inocuo", async () => {
    const r = await emitido();
    await anularPazYSalvo({ tenantId: T, certificateId: r.certificateId, reason: "motivo" }, UID);
    const segunda = await anularPazYSalvo({ tenantId: T, certificateId: r.certificateId, reason: "motivo" }, UID);
    expect(segunda.alreadyCancelled).toBe(true);
  });
});
