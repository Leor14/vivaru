import fs from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `PRD-V-FIX-004` · `D-A` — «Enviar acceso» solo reutiliza cuentas de residente.
 *
 * `upsertResidentTemporaryAccess` buscaba la cuenta por el correo de la ficha y, si
 * existía, **la reutilizaba sin mirar su rol**: le cambiaba la clave y le reescribía el
 * claim y `users` a residente del conjunto. Un administrador de otro conjunto perdía su
 * panel y el superadmin su consola. Y se disparaba sin querer: dar de alta una unidad con
 * su titular configura el acceso en el mismo paso.
 *
 * La decisión vive en `cuentaReutilizableParaResidente`, que mira las DOS fuentes del rol
 * —`users/{uid}.role` y el claim— porque las dos las escribe solo el servidor y basta con
 * que una diga «no residente» para que la cuenta sea de otra persona.
 */

type Doc = Record<string, unknown>;
let usuarios: Record<string, Doc> = {};
let cuentas: Record<string, { uid: string; customClaims?: Record<string, unknown> }> = {};
let errorDeAuth: Error | null = null;

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (col: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const d = col === "users" ? usuarios[id] : undefined;
          return { exists: d !== undefined, data: () => d };
        },
      }),
    }),
  }),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    getUserByEmail: async (email: string) => {
      if (errorDeAuth) throw errorDeAuth;
      const c = cuentas[email];
      if (!c) throw Object.assign(new Error("no existe"), { code: "auth/user-not-found" });
      return c;
    },
  }),
}));

import { MENSAJE_CUENTA_DE_OTRO_ROL, cuentaReutilizableParaResidente } from "../src/resident-access";

function cuenta(email: string, uid: string, opts: { users?: Doc; claims?: Record<string, unknown> } = {}) {
  cuentas[email] = { uid, customClaims: opts.claims };
  if (opts.users) usuarios[uid] = opts.users;
}

const rechazo = { code: "failed-precondition", message: MENSAJE_CUENTA_DE_OTRO_ROL };

beforeEach(() => {
  usuarios = {};
  cuentas = {};
  errorDeAuth = null;
});

describe("FIX-004 · D-A · lo que se reutiliza, como hoy", () => {
  it("CA1 · un correo sin cuenta: no hay nada que reutilizar", async () => {
    await expect(cuentaReutilizableParaResidente("nuevo@x.test")).resolves.toBeNull();
  });

  it("CA2 · la cuenta de un residente de este conjunto", async () => {
    cuenta("r@a.test", "uid-r", { users: { role: "resident", tenantId: "t-a" }, claims: { role: "resident", tenantId: "t-a" } });
    await expect(cuentaReutilizableParaResidente("r@a.test")).resolves.toMatchObject({ uid: "uid-r" });
  });

  it("CA3 · la de un residente de OTRO conjunto (`PLAT-002` §4 lo deja así)", async () => {
    cuenta("r@b.test", "uid-rb", { users: { role: "resident", tenantId: "t-b" }, claims: { role: "resident", tenantId: "t-b" } });
    await expect(cuentaReutilizableParaResidente("r@b.test")).resolves.toMatchObject({ uid: "uid-rb" });
  });

  it("una cuenta huérfana, sin users ni claim: reutilizarla es la única forma de recuperarla", async () => {
    cuenta("huerfana@x.test", "uid-h");
    await expect(cuentaReutilizableParaResidente("huerfana@x.test")).resolves.toMatchObject({ uid: "uid-h" });
  });
});

describe("FIX-004 · D-A · lo que se rechaza ANTES de escribir", () => {
  it("CF1 · la cuenta de un administrador de otro conjunto", async () => {
    cuenta("admin@b.test", "uid-b", {
      users: { role: "tenant_admin", tenantId: "t-b" },
      claims: { role: "tenant_admin", tenantId: "t-b" },
    });
    await expect(cuentaReutilizableParaResidente("admin@b.test")).rejects.toMatchObject(rechazo);
  });

  // El alias viejo que las reglas todavía aceptan. Sin él, la guarda tendría un agujero
  // del tamaño exacto de los conjuntos antiguos — el mismo razonamiento que la revocación.
  it("CF1 · también con el alias antiguo admin_tenant", async () => {
    cuenta("viejo@b.test", "uid-v", { users: { role: "admin_tenant", tenantId: "t-b" } });
    await expect(cuentaReutilizableParaResidente("viejo@b.test")).rejects.toMatchObject(rechazo);
  });

  it("CF2 · la del superadmin", async () => {
    cuenta("superadmin@hogaru.co", "uid-sa", { users: { role: "superadmin" }, claims: { role: "superadmin" } });
    await expect(cuentaReutilizableParaResidente("superadmin@hogaru.co")).rejects.toMatchObject(rechazo);
  });

  it("CF2 · aunque el rol esté SOLO en el claim, sin documento en users", async () => {
    cuenta("sa2@hogaru.co", "uid-sa2", { claims: { role: "superadmin" } });
    await expect(cuentaReutilizableParaResidente("sa2@hogaru.co")).rejects.toMatchObject(rechazo);
  });

  it("CF3 · la de portería", async () => {
    cuenta("porteria@a.test", "uid-g", { users: { role: "security_guard", tenantId: "t-a" } });
    await expect(cuentaReutilizableParaResidente("porteria@a.test")).rejects.toMatchObject(rechazo);
  });

  it("si users y el claim no coinciden, manda el que NO es de residente", async () => {
    cuenta("mixta@x.test", "uid-m", { users: { role: "resident", tenantId: "t-a" }, claims: { role: "tenant_admin", tenantId: "t-b" } });
    await expect(cuentaReutilizableParaResidente("mixta@x.test")).rejects.toMatchObject(rechazo);
  });

  it("un fallo de Auth que no es «no existe» sube tal cual: no se confunde con un correo libre", async () => {
    errorDeAuth = Object.assign(new Error("Auth caído"), { code: "auth/internal-error" });
    await expect(cuentaReutilizableParaResidente("x@x.test")).rejects.toThrow("Auth caído");
  });

  it("CF8 · el mensaje no revela el conjunto ni el rol exacto de la otra cuenta", () => {
    for (const palabra of ["superadmin", "tenant_admin", "admin_tenant", "security_guard", "t-b"]) {
      expect(MENSAJE_CUENTA_DE_OTRO_ROL).not.toContain(palabra);
    }
    expect(MENSAJE_CUENTA_DE_OTRO_ROL).toMatch(/otro correo/);
  });
});

/**
 * **El cableado.** Las pruebas de arriba prueban la guarda; esta, que la callable pase por
 * ella. Sin esto, alguien vuelve a escribir un `getUserByEmail` a pelo en
 * `upsertResidentTemporaryAccess` y todo lo de arriba sigue en verde.
 *
 * Se leen las fuentes **sin comentarios**: un guardián que busca texto lo encuentra en el
 * comentario que lo explica, y documentar la regla la rompería.
 */
describe("FIX-004 · la callable pasa por la guarda antes de tocar la cuenta", () => {
  const fuente = fs.readFileSync(path.resolve(__dirname, "../src/index.ts"), "utf8");
  const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const inicio = sinComentarios.indexOf("async function upsertResidentTemporaryAccess(");
  const fin = sinComentarios.indexOf("\nfunction ", inicio + 1);
  const cuerpo = sinComentarios.slice(inicio, fin);

  it("encuentra la función entera", () => {
    expect(inicio).toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(inicio);
    expect(cuerpo).toContain("updateUser(");
  });

  it("busca la cuenta con la guarda, no con getUserByEmail a pelo", () => {
    expect(cuerpo).toContain("cuentaReutilizableParaResidente(");
    expect(cuerpo).not.toContain("getUserByEmail(");
  });

  // Sin el primer `expect`, esta prueba pasaba EN VERDE contra el código viejo: sin la
  // llamada, `indexOf` da −1, y −1 es menor que cualquier posición. Lo cazó correrla en rojo.
  it("y la guarda va ANTES de cambiar la clave o el claim", () => {
    const guarda = cuerpo.indexOf("cuentaReutilizableParaResidente(");
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(cuerpo.indexOf("updateUser("));
    expect(guarda).toBeLessThan(cuerpo.indexOf("setCustomUserClaims("));
  });
});
