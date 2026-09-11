import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `PRD-V-PLAT-002` entrega 2 (§16) — **el superadmin da acceso a varios conjuntos.**
 *
 * Hasta el 11 sep 2026 no había ninguna vía del producto: `createTenantAdmin` rechazaba
 * cualquier correo con cuenta y `updateTenantAdmin` MUDABA al admin, borrando la
 * membresía de su conjunto anterior. Lo único que daba varios conjuntos era un script.
 *
 * Dos capas, como en `resident-access`:
 *   - `planearAccesoDeAdministrador` decide sin escribir —qué membresías nacen, cuáles
 *     cambian de rol, cuáles se van, con qué rol y en qué conjunto queda la cuenta—, y
 *     es donde viven E2-R1…R7;
 *   - `aplicarAccesoDeAdministrador` lo ejecuta, y sus pruebas cuentan las escrituras,
 *     porque «no tocó nada» es que la lista siga vacía.
 */

type Doc = Record<string, unknown>;
let base: Record<string, Doc> = {};
let cuentas: Record<string, { customClaims?: Record<string, unknown> }> = {};
let escrituras: string[] = [];
const BORRAR = "__borrar__";

function aplicarEscritura(ruta: string, data: Doc, merge: boolean) {
  const siguiente: Doc = merge ? { ...(base[ruta] ?? {}) } : {};
  for (const [k, v] of Object.entries(data)) {
    if (v === BORRAR) delete siguiente[k];
    else siguiente[k] = v;
  }
  base[ruta] = siguiente;
}

vi.mock("firebase-admin/firestore", () => {
  const ref = (col: string, id: string) => ({
    id,
    __ruta: `${col}/${id}`,
    get: async () => ({ id, exists: `${col}/${id}` in base, data: () => base[`${col}/${id}`] }),
  });
  return {
    FieldValue: { delete: () => BORRAR },
    Timestamp: { now: () => "ahora" },
    getFirestore: () => ({
      collection: (col: string) => ({
        doc: (id: string) => ref(col, id),
        where: (campo: string, _op: string, valor: unknown) => ({
          get: async () => ({
            docs: Object.entries(base)
              .filter(([ruta, d]) => ruta.startsWith(`${col}/`) && d[campo] === valor)
              .map(([ruta, d]) => ({ id: ruta.slice(col.length + 1), data: () => d })),
          }),
        }),
      }),
      getAll: async (...refs: Array<{ id: string; __ruta: string }>) =>
        refs.map((r) => ({ id: r.id, exists: r.__ruta in base, data: () => base[r.__ruta] })),
      batch: () => {
        const ops: Array<() => void> = [];
        return {
          set: (r: { __ruta: string }, data: Doc, opts?: { merge?: boolean }) => {
            ops.push(() => {
              escrituras.push(`set ${r.__ruta}`);
              aplicarEscritura(r.__ruta, data, Boolean(opts?.merge));
            });
          },
          delete: (r: { __ruta: string }) => {
            ops.push(() => {
              escrituras.push(`borra ${r.__ruta}`);
              delete base[r.__ruta];
            });
          },
          commit: async () => ops.forEach((op) => op()),
        };
      },
    }),
  };
});

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    getUser: async (uid: string) => {
      if (!(uid in cuentas)) throw Object.assign(new Error("no existe"), { code: "auth/user-not-found" });
      return { uid, customClaims: cuentas[uid].customClaims };
    },
    setCustomUserClaims: async (uid: string, claims: Record<string, unknown>) => {
      escrituras.push(`claim ${uid} ${JSON.stringify(claims)}`);
      cuentas[uid] = { customClaims: claims };
    },
    revokeRefreshTokens: async (uid: string) => {
      escrituras.push(`cierra sesiones ${uid}`);
    },
  }),
}));

import {
  aplicarAccesoDeAdministrador,
  planearAccesoDeAdministrador,
  type EstadoDeLaCuenta,
} from "../src/acceso-de-administradores";

const CONJUNTOS: Record<string, string> = { "t-a": "Conjunto A", "t-b": "Conjunto B", "t-r": "Residencial R" };
const admin = (tenantId: string) => ({ tenantId, role: "tenant_admin" });
const residente = (tenantId: string, unitLabel = "T1-101") => ({ tenantId, role: "resident", unitLabel });

function estado(p: Partial<EstadoDeLaCuenta>): EstadoDeLaCuenta {
  return {
    uid: "uid-x",
    rol: "tenant_admin",
    membresias: [],
    fichasDeResidente: [],
    conjuntoEspejo: null,
    lastActiveTenantId: null,
    ...p,
  };
}

describe("planearAccesoDeAdministrador · lo que se da y lo que se quita (E2-R1)", () => {
  it("CA14 · marcar un conjunto más a un admin crea SOLO esa membresía y no toca las demás", () => {
    const plan = planearAccesoDeAdministrador(estado({ membresias: [admin("t-a")], conjuntoEspejo: "t-a" }), ["t-a", "t-b"], CONJUNTOS);
    expect(plan).toMatchObject({ crear: ["t-b"], quitar: [], convertir: [], devolverAResidente: [] });
    expect(plan).toMatchObject({ rolFinal: "tenant_admin", cambiaRol: false, requiereConfirmacion: false, conjuntoActivo: "t-a" });
  });

  it("CA16 · desmarcar uno quita SOLO ese", () => {
    const plan = planearAccesoDeAdministrador(estado({ membresias: [admin("t-a"), admin("t-b")], conjuntoEspejo: "t-a" }), ["t-a"], CONJUNTOS);
    expect(plan).toMatchObject({ crear: [], quitar: ["t-b"], conjuntoActivo: "t-a" });
  });

  it("CA17 · desmarcar su conjunto ACTIVO lo pasa a otro de los suyos (E2-R7)", () => {
    const plan = planearAccesoDeAdministrador(estado({ membresias: [admin("t-a"), admin("t-b")], conjuntoEspejo: "t-b" }), ["t-a"], CONJUNTOS);
    expect(plan).toMatchObject({ quitar: ["t-b"], conjuntoActivo: "t-a" });
  });

  it("volver a guardar lo mismo no cambia nada", () => {
    const plan = planearAccesoDeAdministrador(estado({ membresias: [admin("t-a")], conjuntoEspejo: "t-a" }), ["t-a"], CONJUNTOS);
    expect(plan).toMatchObject({ crear: [], quitar: [], convertir: [], devolverAResidente: [], cambiaRol: false });
  });

  it("un conjunto que no existe se rechaza", () => {
    expect(() =>
      planearAccesoDeAdministrador(estado({ membresias: [admin("t-a")] }), ["t-a", "t-fantasma"], CONJUNTOS),
    ).toThrow(/no existe/);
  });
});

describe("planearAccesoDeAdministrador · lo que se rechaza (E2-R3, E2-R6)", () => {
  it("CF9 · una cuenta de portería no recibe acceso de admin", () => {
    expect(() => planearAccesoDeAdministrador(estado({ rol: "security_guard" }), ["t-a"], CONJUNTOS)).toThrow(/portería/);
  });

  it("CF9 · tampoco con el alias viejo security", () => {
    expect(() => planearAccesoDeAdministrador(estado({ rol: "security" }), ["t-a"], CONJUNTOS)).toThrow(/portería/);
  });

  it("CF10 · la del superadmin tampoco", () => {
    expect(() => planearAccesoDeAdministrador(estado({ rol: "superadmin" }), ["t-a"], CONJUNTOS)).toThrow(/superadmin/);
  });

  it("un conjunto donde la persona es portería no se convierte en admin", () => {
    expect(() =>
      planearAccesoDeAdministrador(
        estado({ membresias: [admin("t-a"), { tenantId: "t-b", role: "security_guard" }] }),
        ["t-a", "t-b"],
        CONJUNTOS,
      ),
    ).toThrow(/portería/);
  });

  it("CF16 · un admin SIN lado de residente no se queda sin conjuntos: para eso está desactivar", () => {
    expect(() => planearAccesoDeAdministrador(estado({ membresias: [admin("t-a")] }), [], CONJUNTOS)).toThrow(/[Dd]esactív/);
  });
});

describe("planearAccesoDeAdministrador · el residente que pasa a admin (E2-D3, E2-R4, E2-R5)", () => {
  const unResidente = estado({
    rol: "resident",
    membresias: [residente("t-r")],
    fichasDeResidente: [{ tenantId: "t-r", unitId: "u-101" }],
    conjuntoEspejo: "t-r",
  });

  it("CA20 · en OTRO conjunto: nace la de admin, la de residente no se toca, y pide confirmación", () => {
    const plan = planearAccesoDeAdministrador(unResidente, ["t-b"], CONJUNTOS);
    expect(plan).toMatchObject({ crear: ["t-b"], convertir: [], quitar: [], devolverAResidente: [] });
    expect(plan).toMatchObject({ rolFinal: "tenant_admin", cambiaRol: true, requiereConfirmacion: true, conjuntoActivo: "t-b" });
  });

  it("el aviso nombra SU conjunto y SU unidad, y ofrece el otro correo", () => {
    const plan = planearAccesoDeAdministrador(unResidente, ["t-b"], CONJUNTOS);
    expect(plan.aviso).toContain("Residencial R");
    expect(plan.aviso).toContain("T1-101");
    expect(plan.aviso).toMatch(/otro correo/);
  });

  it("CA22 · en el MISMO conjunto: su membresía de residente pasa a admin, y pide confirmación", () => {
    const plan = planearAccesoDeAdministrador(unResidente, ["t-r"], CONJUNTOS);
    expect(plan).toMatchObject({ crear: [], convertir: ["t-r"], rolFinal: "tenant_admin", requiereConfirmacion: true });
  });

  it("CA21 · el ex-residente al que le quitan su último conjunto de admin vuelve a ser residente", () => {
    const plan = planearAccesoDeAdministrador(
      estado({
        membresias: [residente("t-r"), admin("t-b")],
        fichasDeResidente: [{ tenantId: "t-r", unitId: "u-101" }],
        conjuntoEspejo: "t-b",
      }),
      [],
      CONJUNTOS,
    );
    expect(plan).toMatchObject({ quitar: ["t-b"], rolFinal: "resident", cambiaRol: true, requiereConfirmacion: true, conjuntoActivo: "t-r" });
    expect(plan.aviso).toMatch(/[Vv]olverá a ser residente/);
  });

  it("CA22 · y si era del MISMO conjunto, esa membresía se DEVUELVE a residente, no se borra", () => {
    const plan = planearAccesoDeAdministrador(
      estado({
        membresias: [{ tenantId: "t-a", role: "tenant_admin", unitLabel: "T2-503" }],
        fichasDeResidente: [{ tenantId: "t-a", unitId: "u-503" }],
        conjuntoEspejo: "t-a",
      }),
      [],
      CONJUNTOS,
    );
    expect(plan).toMatchObject({ quitar: [], devolverAResidente: ["t-a"], rolFinal: "resident", conjuntoActivo: "t-a" });
  });

  it("un admin puro con una membresía de residente sobrante también confirma al convertirla", () => {
    const plan = planearAccesoDeAdministrador(
      estado({ membresias: [admin("t-a"), residente("t-r")], conjuntoEspejo: "t-a" }),
      ["t-a", "t-r"],
      CONJUNTOS,
    );
    expect(plan).toMatchObject({ convertir: ["t-r"], cambiaRol: false, requiereConfirmacion: true });
  });
});

const UID = "uid-x";

function sembrarConjuntos() {
  for (const [id, name] of Object.entries(CONJUNTOS)) base[`tenants/${id}`] = { name, status: "active" };
}

function sembrarAdmin(conjuntos: string[], espejo = conjuntos[0]) {
  base[`users/${UID}`] = { uid: UID, role: "tenant_admin", tenantId: espejo, fullName: "Ana Admin", email: "ana@x.test" };
  for (const t of conjuntos) base[`tenantUsers/${t}_${UID}`] = { uid: UID, tenantId: t, role: "tenant_admin", status: "active" };
  cuentas[UID] = { customClaims: { role: "tenant_admin", tenantId: espejo } };
}

function sembrarResidente(tenantId = "t-r") {
  base[`users/${UID}`] = { uid: UID, role: "resident", tenantId, unitId: "u-101", unitLabel: "T1-101", fullName: "Rosa Residente", email: "rosa@x.test" };
  base[`tenantUsers/${tenantId}_${UID}`] = { uid: UID, tenantId, role: "resident", status: "active", unitId: "u-101", unitLabel: "T1-101" };
  base["people/p-rosa"] = { tenantId, authUid: UID, unitId: "u-101", fullName: "Rosa Residente" };
  cuentas[UID] = { customClaims: { role: "resident", tenantId } };
}

beforeEach(() => {
  base = {};
  cuentas = {};
  escrituras = [];
  sembrarConjuntos();
});

describe("aplicarAccesoDeAdministrador · lo que escribe", () => {
  it("simular no escribe NADA y devuelve el plan con su aviso", async () => {
    sembrarResidente();
    const r = await aplicarAccesoDeAdministrador({ uid: UID, tenantIds: ["t-b"], simular: true });
    expect(escrituras).toEqual([]);
    expect(r.aplicado).toBe(false);
    expect(r.plan.aviso).toContain("Residencial R");
  });

  it("CF11 · sin la confirmación, un residente NO pasa a admin: el servidor la exige", async () => {
    sembrarResidente();
    await expect(aplicarAccesoDeAdministrador({ uid: UID, tenantIds: ["t-b"] })).rejects.toMatchObject({ code: "failed-precondition" });
    expect(escrituras).toEqual([]);
  });

  it("CF16 · quitarle todo a un admin puro se rechaza sin escribir", async () => {
    sembrarAdmin(["t-a"]);
    await expect(aplicarAccesoDeAdministrador({ uid: UID, tenantIds: [] })).rejects.toThrow(/[Dd]esactív/);
    expect(escrituras).toEqual([]);
  });

  it("CA14 · añadir un conjunto: nace la membresía, las dos quedan marcadas como compartidas y el claim no se toca", async () => {
    sembrarAdmin(["t-a"]);
    const r = await aplicarAccesoDeAdministrador({ uid: UID, tenantIds: ["t-a", "t-b"] });
    expect(r.aplicado).toBe(true);
    expect(base[`tenantUsers/t-b_${UID}`]).toMatchObject({ uid: UID, tenantId: "t-b", role: "tenant_admin", status: "active", compartida: true });
    expect(base[`tenantUsers/t-a_${UID}`]).toMatchObject({ role: "tenant_admin", compartida: true });
    expect(escrituras.some((e) => e.startsWith("claim"))).toBe(false);
  });

  it("CA17 · quitar el conjunto activo reapunta users, el claim y cierra sesiones para que se aplique", async () => {
    sembrarAdmin(["t-a", "t-b"], "t-b");
    base[`users/${UID}`].lastActiveTenantId = "t-b";
    await aplicarAccesoDeAdministrador({ uid: UID, tenantIds: ["t-a"] });
    expect(base[`tenantUsers/t-b_${UID}`]).toBeUndefined();
    expect(base[`users/${UID}`]).toMatchObject({ role: "tenant_admin", tenantId: "t-a", lastActiveTenantId: "t-a" });
    expect(escrituras).toContain(`claim ${UID} ${JSON.stringify({ role: "tenant_admin", tenantId: "t-a" })}`);
    expect(escrituras).toContain(`cierra sesiones ${UID}`);
    expect(base[`tenantUsers/t-a_${UID}`]).toMatchObject({ compartida: false });
  });

  it("CA20 · residente → admin de otro conjunto, confirmado: cuenta de admin, su membresía de residente intacta", async () => {
    sembrarResidente();
    await aplicarAccesoDeAdministrador({ uid: UID, tenantIds: ["t-b"], confirmarCambioDeRol: true });
    expect(base[`users/${UID}`]).toMatchObject({ role: "tenant_admin", tenantId: "t-b" });
    expect(base[`tenantUsers/t-r_${UID}`]).toMatchObject({ role: "resident", unitId: "u-101" });
    expect(base[`tenantUsers/t-b_${UID}`]).toMatchObject({ role: "tenant_admin" });
    expect(escrituras).toContain(`claim ${UID} ${JSON.stringify({ role: "tenant_admin", tenantId: "t-b" })}`);
  });

  it("CA21 · y quitarle su último conjunto de admin lo devuelve a residente de su unidad", async () => {
    sembrarResidente();
    await aplicarAccesoDeAdministrador({ uid: UID, tenantIds: ["t-b"], confirmarCambioDeRol: true });
    escrituras = [];
    await aplicarAccesoDeAdministrador({ uid: UID, tenantIds: [], confirmarCambioDeRol: true });
    expect(base[`tenantUsers/t-b_${UID}`]).toBeUndefined();
    expect(base[`users/${UID}`]).toMatchObject({ role: "resident", tenantId: "t-r", unitId: "u-101", unitLabel: "T1-101" });
    expect(escrituras).toContain(`claim ${UID} ${JSON.stringify({ role: "resident", tenantId: "t-r" })}`);
  });

  it("CA22 · en el mismo conjunto: la membresía pasa a admin conservando la unidad, y vuelve a residente", async () => {
    sembrarResidente("t-a");
    await aplicarAccesoDeAdministrador({ uid: UID, tenantIds: ["t-a"], confirmarCambioDeRol: true });
    expect(base[`tenantUsers/t-a_${UID}`]).toMatchObject({ role: "tenant_admin", unitId: "u-101" });
    expect(base[`users/${UID}`]).toMatchObject({ role: "tenant_admin", tenantId: "t-a" });

    await aplicarAccesoDeAdministrador({ uid: UID, tenantIds: [], confirmarCambioDeRol: true });
    expect(base[`tenantUsers/t-a_${UID}`]).toMatchObject({ role: "resident", unitId: "u-101" });
    expect(base[`tenantUsers/t-a_${UID}`]).not.toHaveProperty("compartida");
    expect(base[`users/${UID}`]).toMatchObject({ role: "resident", tenantId: "t-a" });
  });

  it("una cuenta sin perfil en users no se toca", async () => {
    await expect(aplicarAccesoDeAdministrador({ uid: "uid-fantasma", tenantIds: ["t-a"] })).rejects.toThrow(/no existe/);
    expect(escrituras).toEqual([]);
  });
});
