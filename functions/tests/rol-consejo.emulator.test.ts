import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { aplicarMarcaDeConsejo } from "../src/rol-consejo";

/**
 * `PRD-V-PLAT-004` entrega 1 — conceder y retirar la marca de consejo.
 * Cubre `CA10`, `CA11`, `CA12`, `CA15`, `RN-02`, `RN-03`, `RN-05` y la
 * idempotencia de §5.
 *
 * **Por qué contra el emulador y no con dobles.** Lo que hay que comprobar no es
 * que la función llame a Firestore: es **qué queda escrito**. Al retirar la marca
 * se BORRAN dos campos con `FieldValue.delete()`, y un doble diría que sí
 * mientras el documento real conserva `committeeSince` — que es exactamente el
 * fallo que dejaría «consejo desde 2026» sobre alguien que ya no lo es.
 *
 *   export JAVA_HOME="$HOME/.local/jdk/jdk-21.0.12.1+1/Contents/Home"
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const T = "plat004-conjunto";
const OTRO = "plat004-ajeno";
const ADMIN = "plat004-admin";

let db: Firestore;

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  db = getFirestore();
});

const ref = (tenantId: string, uid: string) => db.collection("tenantUsers").doc(`${tenantId}_${uid}`);

async function sembrar() {
  const previas = await db.collection("tenantUsers").where("tenantId", "in", [T, OTRO]).get();
  await Promise.all(previas.docs.map((d) => d.ref.delete()));
  const gente: Array<[string, string, string, Record<string, unknown>?]> = [
    [T, ADMIN, "tenant_admin"],
    [T, "residente", "resident"],
    [T, "residente-inactivo", "resident", { status: "inactive" }],
    [T, "guardia", "security_guard"],
    [T, "ya-consejero", "resident", { isCommittee: true }],
    [OTRO, "residente-ajeno", "resident"],
  ];
  for (const [tenantId, uid, role, extra] of gente) {
    await ref(tenantId, uid).set({ uid, tenantId, role, status: "active", ...extra });
  }
}

beforeEach(sembrar);

const conceder = (targetUid: string, tenantId = T, actorUid = ADMIN) =>
  aplicarMarcaDeConsejo({ tenantId, actorUid, targetUid, quiereLaMarca: true });
const retirar = (targetUid: string, tenantId = T, actorUid = ADMIN) =>
  aplicarMarcaDeConsejo({ tenantId, actorUid, targetUid, quiereLaMarca: false });

describe("PLAT-004 · conceder la marca", () => {
  it("un residente activo la recibe, con quién y cuándo (`CA6`)", async () => {
    expect(await conceder("residente")).toEqual({ ok: true, cambiado: true });
    const d = (await ref(T, "residente").get()).data()!;
    expect(d.isCommittee).toBe(true);
    expect(d.committeeGrantedBy).toBe(ADMIN);
    expect(d.committeeSince).toBeDefined();
  });

  it("**y CONSERVA su rol de residente** — `RN-01`, que es el invariante de la ficha", async () => {
    await conceder("residente");
    // Si esto fuera `committee`, la persona perdería su unidad, su estado de
    // cuenta y el portal del residente entero. Es la comprobación que justifica
    // que la marca sea un atributo y no un rol.
    expect((await ref(T, "residente").get()).data()!.role).toBe("resident");
  });

  it("es idempotente: concederla dos veces no falla ni reescribe (§5)", async () => {
    expect(await conceder("ya-consejero")).toEqual({ ok: true, cambiado: false });
  });
});

describe("PLAT-004 · retirar la marca", () => {
  it("la quita y BORRA `committeeSince` y `committeeGrantedBy`", async () => {
    await conceder("residente");
    expect(await retirar("residente")).toEqual({ ok: true, cambiado: true });
    const d = (await ref(T, "residente").get()).data()!;
    expect(d.isCommittee).toBe(false);
    // El rastro histórico vive en la auditoría, no aquí: dejar la fecha pintaría
    // «consejo desde…» sobre alguien que ya no lo es.
    expect(d.committeeSince).toBeUndefined();
    expect(d.committeeGrantedBy).toBeUndefined();
  });

  it("`CA5` · **conserva todo lo de residente** al retirarla", async () => {
    await conceder("residente");
    await retirar("residente");
    const d = (await ref(T, "residente").get()).data()!;
    expect(d.role).toBe("resident");
    expect(d.status).toBe("active");
  });

  it("se puede retirar aunque la membresía esté INACTIVA", async () => {
    // Al revés no se podría limpiar nunca un permiso de alguien desactivado, y
    // quedaría un permiso sin dueño operable.
    await ref(T, "residente").set({ isCommittee: true }, { merge: true });
    await ref(T, "residente").set({ status: "inactive" }, { merge: true });
    expect(await retirar("residente")).toEqual({ ok: true, cambiado: true });
  });

  it("retirar a quien no la tiene es idempotente", async () => {
    expect(await retirar("residente")).toEqual({ ok: true, cambiado: false });
  });
});

describe("PLAT-004 · lo que debe fallar", () => {
  it("`CA12` · un `security_guard` NO la recibe", async () => {
    await expect(conceder("guardia")).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("`RN-03` · un `tenant_admin` tampoco: ya ve más", async () => {
    await expect(
      aplicarMarcaDeConsejo({ tenantId: T, actorUid: "otro-admin", targetUid: ADMIN, quiereLaMarca: true }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("`CA15` · una membresía INACTIVA no puede ser nombrada", async () => {
    await expect(conceder("residente-inactivo")).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("`CA11` · no se concede a alguien de OTRO conjunto", async () => {
    await expect(conceder("residente-ajeno")).rejects.toMatchObject({ code: "not-found" });
  });

  it("`CA10` · nadie se la concede a sí mismo", async () => {
    await expect(conceder(ADMIN, T, ADMIN)).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("`RN-05` · a quien no tiene membresía —está en el padrón pero sin cuenta— no se le puede poner", async () => {
    await expect(conceder("nadie-en-absoluto")).rejects.toMatchObject({ code: "not-found" });
  });
});
