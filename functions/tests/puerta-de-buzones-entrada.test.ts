import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `PRD-V-PLAT-006` · la puerta de ENTRADA **del lado del servidor**: `assertBuzonAdmisible`.
 *
 * **Es la mitad que `firestore.rules` no puede cubrir.** Las callables van con Admin SDK, que no
 * evalúa las reglas, así que `users` y `tenantUsers` —que solo se escriben por callable— quedarían
 * fuera de la puerta si esto no existiera. Es exactamente la forma de `CF8`: el producto se negaba
 * a facturarle a un conjunto suspendido y le dejaba cobrar, porque el invariante vivía solo en las
 * reglas.
 */

type Doc = Record<string, unknown> | undefined;
let base: Record<string, Doc> = {};

function snap(ruta: string) {
  return { exists: base[ruta] !== undefined, data: () => base[ruta] };
}

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: { now: () => ({ __ts: true }) },
  getFirestore: () => ({
    collection: (col: string) => ({
      doc: (id: string) => ({ __ruta: `${col}/${id}`, get: async () => snap(`${col}/${id}`) }),
    }),
    getAll: async (...refs: { __ruta: string }[]) => refs.map((r) => snap(r.__ruta)),
  }),
}));

const MARCADO = "tenant-marcado";
const CON_CLIENTE = "tenant-con-cliente";

function sembrar(opts: { bandera?: boolean; equipo?: { dominios?: string[]; direcciones?: string[] } } = {}) {
  base = {
    "featureFlags/_global": {},
    "featureFlags/producto-puerta-de-buzones": { enabled: opts.bandera ?? true },
    [`tenants/${MARCADO}`]: { sinClienteDetras: true, isExample: true },
    [`tenants/${CON_CLIENTE}`]: { isExample: true, trialEndsAt: "2026-09-20" },
    "config/correosDelEquipo": { dominios: opts.equipo?.dominios ?? [], direcciones: opts.equipo?.direcciones ?? [] },
  };
}

describe("PLAT-006 · assertBuzonAdmisible — la puerta que las reglas no alcanzan", () => {
  beforeEach(() => { vi.resetModules(); sembrar({ equipo: { dominios: ["qintilab.com"] } }); });
  afterEach(() => { vi.restoreAllMocks(); });

  const assert = async (tenantId: string | null | undefined, email: string | null | undefined) => {
    const { assertBuzonAdmisible } = await import("../src/buzones-admisibles");
    return assertBuzonAdmisible(tenantId, email);
  };

  it("CA1 · conjunto marcado + gmail: LANZA `failed-precondition` con motivo legible", async () => {
    await expect(assert(MARCADO, "alguien@gmail.com")).rejects.toMatchObject({
      code: "failed-precondition",
    });
    await expect(assert(MARCADO, "alguien@gmail.com")).rejects.toThrow(/demostración/);
  });

  it("CA2 · dominio inerte: no lanza", async () => {
    await expect(assert(MARCADO, "x@ejemplo.vivaru.app")).resolves.toBeUndefined();
  });

  it("CA3 · dominio del equipo: no lanza", async () => {
    await expect(assert(MARCADO, "dev@qintilab.com")).resolves.toBeUndefined();
  });

  it("CA3 · el `+alias` no listado sí lanza", async () => {
    sembrar({ equipo: { direcciones: ["dave@hotmail.com"] } });
    await expect(assert(MARCADO, "dave@hotmail.com")).resolves.toBeUndefined();
    await expect(assert(MARCADO, "dave+res1@hotmail.com")).rejects.toThrow();
  });

  it("CA4 · el conjunto de TRIAL sigue funcionando con el correo real del prospecto", async () => {
    // Lleva `isExample` y `trialEndsAt`, y NO está marcado. Si la puerta derivara
    // la marca de cualquiera de los dos, esto rechazaría al prospecto — que es el
    // criterio imposible con el que se apuntó el chip.
    await expect(assert(CON_CLIENTE, "prospecto@gmail.com")).resolves.toBeUndefined();
  });

  it("CA6 · con la bandera APAGADA no lanza nada", async () => {
    sembrar({ bandera: false });
    await expect(assert(MARCADO, "alguien@gmail.com")).resolves.toBeUndefined();
  });

  it("sin correo no hay nada que juzgar", async () => {
    await expect(assert(MARCADO, undefined)).resolves.toBeUndefined();
    await expect(assert(MARCADO, "")).resolves.toBeUndefined();
  });

  it("sin conjunto tampoco lanza: no puede saber de qué conjunto es", async () => {
    await expect(assert(null, "alguien@gmail.com")).resolves.toBeUndefined();
  });

  it("un conjunto que no existe NO se trata como marcado", async () => {
    await expect(assert("no-existe", "alguien@gmail.com")).resolves.toBeUndefined();
  });
});

describe("PLAT-006 · las cuatro callables de alta llaman a la puerta", () => {
  // Barrido del código, no lista escrita a mano: la lista envejece.
  const CALLABLES = [
    "createTenantAdmin",
    "createTenantOperationalUser",
    "provisionResidentTemporaryAccess",
    "resendAccountInvite",
  ];

  it("cada camino de alta con correo pasa por `assertBuzonAdmisible`", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "..", "src", "index.ts"), "utf8");

    const sinPuerta = CALLABLES.filter((nombre) => {
      const i = src.indexOf(`export const ${nombre} = onCall`);
      if (i < 0) return true;
      // El cuerpo, hasta el siguiente `export const`.
      const j = src.indexOf("\nexport const ", i + 1);
      return !src.slice(i, j < 0 ? undefined : j).includes("assertBuzonAdmisible(");
    });
    expect(sinPuerta, "callables de alta que NO comprueban el buzón").toEqual([]);
  });

  it("CONTROL · el barrido encuentra las cuatro callables en el fichero", async () => {
    // Si un renombrado dejara de encontrarlas, el caso de arriba pasaría en verde
    // vigilando un conjunto vacío.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "..", "src", "index.ts"), "utf8");
    for (const n of CALLABLES) expect(src, `no se encontró ${n}`).toContain(`export const ${n} = onCall`);
  });

  it("CONTROL · y el trial NO la lleva, a propósito", async () => {
    // `createTrialWorkspace` y `createTenantFromLead` dan de alta a un prospecto
    // con su correo real. Si alguien les pusiera la puerta, `CA4` se rompería y
    // ningún otro caso lo notaría.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "..", "src", "index.ts"), "utf8");
    for (const n of ["createTrialWorkspace", "createTenantFromLead"]) {
      const i = src.indexOf(`export const ${n} = onCall`);
      const j = src.indexOf("\nexport const ", i + 1);
      expect(src.slice(i, j < 0 ? undefined : j), `${n} no debe llevar la puerta`).not.toContain("assertBuzonAdmisible(");
    }
  });
});
