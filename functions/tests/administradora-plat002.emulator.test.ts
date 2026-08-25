import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { asociarConjunto, guardarAdministradora } from "../src/management-companies";

/**
 * **`PLAT-002` §7.1 — la empresa administradora.**
 *
 * Contra el emulador y no en unitarias porque todo lo que decide aquí son
 * LECTURAS de Firestore: si el conjunto existe, si ya tiene dueño, si la
 * administradora existe. Un mock probaría el mock.
 *
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const A = "plat002-adm-conjunto-a";
const B = "plat002-adm-conjunto-b";
const SUPER = "plat002-super";

let db: Firestore;

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  db = getFirestore();
});

async function limpiar(col: string) {
  const snap = await db.collection(col).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

beforeEach(async () => {
  for (const c of ["managementCompanies", "tenants"]) await limpiar(c);
  await db.collection("tenants").doc(A).set({ name: "Conjunto A", status: "active" });
  await db.collection("tenants").doc(B).set({ name: "Conjunto B", status: "active" });
});

describe("alta y edición de la administradora", () => {
  it("da de alta con lo mínimo y devuelve su id", async () => {
    const r = await guardarAdministradora({ name: "Administra S.A.", country: "CO" }, SUPER);
    expect(r.ok).toBe(true);
    const doc = await db.collection("managementCompanies").doc(r.id).get();
    expect(doc.data()).toMatchObject({ name: "Administra S.A.", country: "CO", status: "active", createdBy: SUPER });
  });

  it("exige nombre y país", async () => {
    await expect(guardarAdministradora({ country: "CO" }, SUPER)).rejects.toThrow(/nombre/i);
    await expect(guardarAdministradora({ name: "Sin país" }, SUPER)).rejects.toThrow(/país/i);
  });

  it("editar una que no existe no la crea de rebote", async () => {
    await expect(
      guardarAdministradora({ id: "no-existe", name: "X", country: "CO" }, SUPER),
    ).rejects.toThrow(/no existe/i);
    expect((await db.collection("managementCompanies").doc("no-existe").get()).exists).toBe(false);
  });

  /**
   * El precio de haber desnormalizado el nombre en `tenants`. Sin esto, el
   * residente vería para siempre el nombre viejo y nadie se enteraría.
   */
  it("al renombrar, el nombre se propaga a SUS conjuntos y solo a esos", async () => {
    const r = await guardarAdministradora({ name: "Vieja S.A.", country: "CO" }, SUPER);
    await asociarConjunto({ tenantId: A, managementCompanyId: r.id });

    const renombrada = await guardarAdministradora({ id: r.id, name: "Nueva S.A.", country: "CO" }, SUPER);
    expect(renombrada.conjuntosRenombrados).toBe(1);

    expect((await db.collection("tenants").doc(A).get()).data()?.managementCompanyName).toBe("Nueva S.A.");
    // El conjunto suelto no se toca.
    expect((await db.collection("tenants").doc(B).get()).data()?.managementCompanyName).toBeUndefined();
  });

  it("guardar sin cambiar el nombre no reescribe ningún conjunto", async () => {
    const r = await guardarAdministradora({ name: "Igual S.A.", country: "CO" }, SUPER);
    await asociarConjunto({ tenantId: A, managementCompanyId: r.id });
    const otra = await guardarAdministradora({ id: r.id, name: "Igual S.A.", country: "MX" }, SUPER);
    expect(otra.conjuntosRenombrados).toBe(0);
  });
});

describe("R5 · un conjunto pertenece a lo sumo a UNA administradora", () => {
  it("asocia y deja el nombre a mano de los miembros", async () => {
    const r = await guardarAdministradora({ name: "Administra S.A.", country: "CO" }, SUPER);
    const res = await asociarConjunto({ tenantId: A, managementCompanyId: r.id });
    expect(res.cambiado).toBe(true);
    expect((await db.collection("tenants").doc(A).get()).data()).toMatchObject({
      managementCompanyId: r.id,
      managementCompanyName: "Administra S.A.",
    });
  });

  /** CF7. Se rechaza en vez de reasignar en silencio. */
  it("mover un conjunto a una SEGUNDA administradora se rechaza", async () => {
    const una = await guardarAdministradora({ name: "Una S.A.", country: "CO" }, SUPER);
    const otra = await guardarAdministradora({ name: "Otra S.A.", country: "CO" }, SUPER);
    await asociarConjunto({ tenantId: A, managementCompanyId: una.id });

    await expect(
      asociarConjunto({ tenantId: A, managementCompanyId: otra.id }),
    ).rejects.toThrow(/ya pertenece a otra/i);

    // Y no quedó a medias.
    expect((await db.collection("tenants").doc(A).get()).data()?.managementCompanyId).toBe(una.id);
  });

  it("pero desasociando primero sí se puede mover", async () => {
    const una = await guardarAdministradora({ name: "Una S.A.", country: "CO" }, SUPER);
    const otra = await guardarAdministradora({ name: "Otra S.A.", country: "CO" }, SUPER);
    await asociarConjunto({ tenantId: A, managementCompanyId: una.id });
    await asociarConjunto({ tenantId: A, managementCompanyId: null });
    await asociarConjunto({ tenantId: A, managementCompanyId: otra.id });

    expect((await db.collection("tenants").doc(A).get()).data()).toMatchObject({
      managementCompanyId: otra.id,
      managementCompanyName: "Otra S.A.",
    });
  });

  it("desasociar deja el conjunto SUELTO, sin rastro", async () => {
    const r = await guardarAdministradora({ name: "Administra S.A.", country: "CO" }, SUPER);
    await asociarConjunto({ tenantId: A, managementCompanyId: r.id });
    await asociarConjunto({ tenantId: A, managementCompanyId: null });

    const t = (await db.collection("tenants").doc(A).get()).data()!;
    expect(t.managementCompanyId).toBeUndefined();
    expect(t.managementCompanyName).toBeUndefined();
  });

  it("no asocia a una administradora inexistente", async () => {
    await expect(
      asociarConjunto({ tenantId: A, managementCompanyId: "no-existe" }),
    ).rejects.toThrow(/no existe/i);
    expect((await db.collection("tenants").doc(A).get()).data()?.managementCompanyId).toBeUndefined();
  });

  it("ni toca un conjunto inexistente", async () => {
    const r = await guardarAdministradora({ name: "Administra S.A.", country: "CO" }, SUPER);
    await expect(
      asociarConjunto({ tenantId: "conjunto-fantasma", managementCompanyId: r.id }),
    ).rejects.toThrow(/no existe/i);
  });
});

describe("lo que la asociación NO hace", () => {
  /**
   * **R6.** La asociación es comercial y el acceso es operativo. Mezclarlos
   * daría acceso a quince conjuntos por una decisión de facturación.
   */
  it("R6 · no crea ni borra ninguna membresía", async () => {
    const antes = (await db.collection("tenantUsers").get()).size;
    const r = await guardarAdministradora({ name: "Administra S.A.", country: "CO" }, SUPER);
    await asociarConjunto({ tenantId: A, managementCompanyId: r.id });
    await asociarConjunto({ tenantId: A, managementCompanyId: null });
    expect((await db.collection("tenantUsers").get()).size).toBe(antes);
  });

  /**
   * **R4 y CA9.** Es la regla que impide cortarle el servicio a un conjunto que
   * paga por un problema comercial de su administradora — y el cliente de ese
   * conjunto no es la administradora.
   */
  it("R4 · una administradora `inactive` no cambia el estado de sus conjuntos", async () => {
    const r = await guardarAdministradora({ name: "Administra S.A.", country: "CO" }, SUPER);
    await asociarConjunto({ tenantId: A, managementCompanyId: r.id });
    await guardarAdministradora({ id: r.id, name: "Administra S.A.", country: "CO", status: "inactive" }, SUPER);

    expect((await db.collection("tenants").doc(A).get()).data()?.status).toBe("active");
  });

  /** CA8. Es la condición de que esto no rompa a los nueve conjuntos actuales. */
  it("CA8 · un conjunto sin administradora queda exactamente como estaba", async () => {
    const r = await guardarAdministradora({ name: "Administra S.A.", country: "CO" }, SUPER);
    await asociarConjunto({ tenantId: A, managementCompanyId: r.id });

    const b = (await db.collection("tenants").doc(B).get()).data()!;
    expect(b.managementCompanyId).toBeUndefined();
    expect(b).toMatchObject({ name: "Conjunto B", status: "active" });
  });
});
