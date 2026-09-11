import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `PRD-V-FIX-004` · `D-B` — «Quitar acceso» sobre una ficha cuyo `authUid` apunta FUERA.
 *
 * `people.authUid` lo podía escribir el admin del conjunto desde el navegador, y la
 * revocación lo tomaba como la cuenta a cerrar sin preguntar de quién era. Si esa cuenta
 * no tenía membresía en ningún conjunto —la del superadmin—, el plan salía «revocar-y-borrar»
 * y se borraba entera. Con cualquier otra cuenta ajena, se le reapuntaba el claim y se le
 * cerraban las sesiones.
 *
 * **Se prueba la función que ESCRIBE, no solo el plan**: el daño está en lo que se llama
 * contra Auth, y eso es lo que estas pruebas cuentan. Cada escritura queda anotada en
 * `escrituras`, así que «no tocó la cuenta» es que esa lista siga vacía — no que el plan
 * diga una palabra concreta.
 */

type Doc = Record<string, unknown>;
let base: Record<string, Doc> = {};
let cuentas: Record<string, { customClaims?: Record<string, unknown> }> = {};
let escrituras: string[] = [];

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (col: string) => ({
      doc: (id: string) => ({
        id,
        get: async () => ({ exists: `${col}/${id}` in base, data: () => base[`${col}/${id}`] }),
        delete: async () => {
          escrituras.push(`borra ${col}/${id}`);
          delete base[`${col}/${id}`];
        },
      }),
      where: (campo: string, _op: string, valor: unknown) => ({
        get: async () => ({
          docs: Object.entries(base)
            .filter(([ruta, d]) => ruta.startsWith(`${col}/`) && d[campo] === valor)
            .map(([ruta, d]) => ({ id: ruta.slice(col.length + 1), data: () => d })),
        }),
      }),
    }),
  }),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    getUser: async (uid: string) => {
      if (!(uid in cuentas)) throw Object.assign(new Error("no existe"), { code: "auth/user-not-found" });
      return { uid, customClaims: cuentas[uid].customClaims };
    },
    revokeRefreshTokens: async (uid: string) => {
      escrituras.push(`cierra sesiones ${uid}`);
    },
    setCustomUserClaims: async (uid: string, claims: unknown) => {
      escrituras.push(`claim ${uid} ${JSON.stringify(claims)}`);
    },
    deleteUser: async (uid: string) => {
      escrituras.push(`borra cuenta ${uid}`);
    },
  }),
}));

import { revocarAccesoDeResidente } from "../src/resident-access";

const CONJUNTO = "t-a";
const OTRO = "t-b";
const ACTOR = "uid-admin-de-a";

function fichaQueApuntaA(authUid: string) {
  base["people/p1"] = { tenantId: CONJUNTO, fullName: "Ficha", authUid };
}

const quitarAcceso = () => revocarAccesoDeResidente({ tenantId: CONJUNTO, personId: "p1" }, ACTOR);

beforeEach(() => {
  base = {};
  cuentas = {};
  escrituras = [];
});

describe("FIX-004 · D-B · una ficha que apunta a una cuenta de FUERA no la toca", () => {
  it("CF6 · la del superadmin, que no tiene membresías: ni se borra, ni pierde el claim, ni las sesiones", async () => {
    fichaQueApuntaA("uid-superadmin");
    base["users/uid-superadmin"] = { role: "superadmin", email: "superadmin@hogaru.co" };
    cuentas["uid-superadmin"] = { customClaims: { role: "superadmin" } };

    const r = await quitarAcceso();

    expect(escrituras).toEqual([]);
    expect(r).toMatchObject({ revoked: false, accion: "sin-membresia" });
    expect(base["users/uid-superadmin"]).toBeDefined();
  });

  it("CF5 · la de un administrador de otro conjunto: ni claim reapuntado ni sesiones cerradas", async () => {
    fichaQueApuntaA("uid-admin-b");
    base["users/uid-admin-b"] = { role: "tenant_admin", tenantId: OTRO };
    base[`tenantUsers/${OTRO}_uid-admin-b`] = { uid: "uid-admin-b", tenantId: OTRO, role: "tenant_admin" };
    cuentas["uid-admin-b"] = { customClaims: { role: "tenant_admin", tenantId: OTRO } };

    const r = await quitarAcceso();

    expect(escrituras).toEqual([]);
    expect(r.accion).toBe("sin-membresia");
  });

  it("CF5 · ni la de un residente de otro conjunto", async () => {
    fichaQueApuntaA("uid-residente-b");
    base["users/uid-residente-b"] = { role: "resident", tenantId: OTRO };
    base[`tenantUsers/${OTRO}_uid-residente-b`] = { uid: "uid-residente-b", tenantId: OTRO, role: "resident" };
    cuentas["uid-residente-b"] = { customClaims: { role: "resident", tenantId: OTRO } };

    const r = await quitarAcceso();

    expect(escrituras).toEqual([]);
    expect(r.accion).toBe("sin-membresia");
  });
});

describe("FIX-004 · lo que se tiene que seguir cerrando como hoy", () => {
  it("CA4 · un residente de este conjunto sin otros: se cierra entero", async () => {
    fichaQueApuntaA("uid-r");
    base["users/uid-r"] = { role: "resident", tenantId: CONJUNTO };
    base[`tenantUsers/${CONJUNTO}_uid-r`] = { uid: "uid-r", tenantId: CONJUNTO, role: "resident" };
    cuentas["uid-r"] = { customClaims: { role: "resident", tenantId: CONJUNTO } };

    const r = await quitarAcceso();

    expect(r.accion).toBe("revocar-y-borrar");
    expect(escrituras).toContain(`borra tenantUsers/${CONJUNTO}_uid-r`);
    expect(escrituras).toContain("borra cuenta uid-r");
  });

  it("CA5 · un residente de este conjunto y de otro: se conserva y se reapunta al otro", async () => {
    fichaQueApuntaA("uid-r2");
    base["users/uid-r2"] = { role: "resident", tenantId: CONJUNTO };
    base[`tenantUsers/${CONJUNTO}_uid-r2`] = { uid: "uid-r2", tenantId: CONJUNTO, role: "resident" };
    base[`tenantUsers/${OTRO}_uid-r2`] = { uid: "uid-r2", tenantId: OTRO, role: "resident" };
    cuentas["uid-r2"] = { customClaims: { role: "resident", tenantId: CONJUNTO } };

    const r = await quitarAcceso();

    expect(r.accion).toBe("revocar-y-conservar");
    expect(escrituras).toContain(`claim uid-r2 ${JSON.stringify({ role: "resident", tenantId: OTRO })}`);
    expect(escrituras).not.toContain("borra cuenta uid-r2");
  });

  // El caso que la prueba vieja defendía, y con razón: una cuenta que se quedó sin
  // membresía por un alta a medias (el claim se escribe ANTES que los documentos) sigue
  // abriendo Storage, que concede por claim. Esa cuenta dice ella misma —en su claim, que
  // solo escribe el servidor— que es de este conjunto, y por eso se cierra.
  it("un alta a medias —sin membresía ni users, con el claim de ESTE conjunto— se sigue cerrando", async () => {
    fichaQueApuntaA("uid-medias");
    cuentas["uid-medias"] = { customClaims: { role: "resident", tenantId: CONJUNTO } };

    const r = await quitarAcceso();

    expect(r.accion).toBe("revocar-y-borrar");
    expect(escrituras).toContain("borra cuenta uid-medias");
  });

  it("datos viejos —sin membresía, con users de residente de ESTE conjunto— también", async () => {
    fichaQueApuntaA("uid-viejo");
    base["users/uid-viejo"] = { role: "resident", tenantId: CONJUNTO };
    cuentas["uid-viejo"] = {};

    const r = await quitarAcceso();

    expect(r.accion).toBe("revocar-y-borrar");
    expect(escrituras).toContain("borra cuenta uid-viejo");
  });

  it("CF7 · un admin de este conjunto: el rechazo de hoy, sin tocar nada", async () => {
    fichaQueApuntaA("uid-admin-a2");
    base[`tenantUsers/${CONJUNTO}_uid-admin-a2`] = { uid: "uid-admin-a2", tenantId: CONJUNTO, role: "tenant_admin" };
    cuentas["uid-admin-a2"] = { customClaims: { role: "tenant_admin", tenantId: CONJUNTO } };

    await expect(quitarAcceso()).rejects.toThrow(/Usuarios operativos/);
    expect(escrituras).toEqual([]);
  });
});
