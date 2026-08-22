import { describe, expect, it } from "vitest";

import { sembrarPlanDeCuentas } from "../src/plan-de-cuentas-siembra";
import { SEMILLA_PLAN_DE_CUENTAS, docIdDeCuenta } from "../src/plan-de-cuentas";

/**
 * La siembra del plan de cuentas (R1).
 *
 * Se prueba contra un Firestore de mentira minúsculo porque lo que hay que
 * comprobar **no es que escriba**, que eso es E/S: es **qué decide no escribir**.
 * La forma barata de hacer idempotente una siembra es un `set()` sobre un id
 * derivado, y esa forma **borra el nombre que el administrador le haya puesto a
 * una cuenta**. Es un daño silencioso: nadie mira el plan justo después de un
 * alta repetida.
 */

type Escritura = { id: string; data: Record<string, unknown> };

function firestoreDeMentira(existentes: string[] = []) {
  const escrituras: Escritura[] = [];
  let commits = 0;

  const db = {
    collection(nombre: string) {
      if (nombre !== "chartOfAccounts") throw new Error(`colección inesperada: ${nombre}`);
      return {
        where(campo: string, op: string, _valor: string) {
          if (campo !== "tenantId" || op !== "==") throw new Error("consulta inesperada");
          return { get: async () => ({ docs: existentes.map((id) => ({ id })) }) };
        },
        doc: (id: string) => ({ __id: id }),
      };
    },
    batch() {
      return {
        set(ref: { __id: string }, data: Record<string, unknown>) {
          escrituras.push({ id: ref.__id, data });
        },
        commit: async () => {
          commits += 1;
        },
      };
    },
  };

  // El módulo tipa contra `Firestore` de firebase-admin; aquí solo se usan estos
  // tres métodos y darle el tipo entero al doble no aportaría nada.
  return { db: db as never, escrituras, commits: () => commits };
}

const TENANT = "conjunto-x";

describe("sembrarPlanDeCuentas · conjunto nuevo", () => {
  it("escribe las 18 cuentas de la semilla", async () => {
    const { db, escrituras } = firestoreDeMentira();
    const r = await sembrarPlanDeCuentas(db, TENANT);
    expect(r.creadas).toBe(18);
    expect(r.creadas).toBe(SEMILLA_PLAN_DE_CUENTAS.length);
    expect(escrituras).toHaveLength(18);
  });

  it("el id de cada documento es DERIVADO del código, no aleatorio", async () => {
    const { db, escrituras } = firestoreDeMentira();
    await sembrarPlanDeCuentas(db, TENANT);
    for (const e of escrituras) {
      expect(e.id).toBe(docIdDeCuenta(TENANT, e.data.code as string));
    }
  });

  // La regla de Firestore compara `docId` contra `tenantId + '_' + code`. Si el
  // documento no llevara `code`, la comparación no se puede hacer y la regla
  // rechaza la escritura entera.
  it("cada cuenta lleva su código, su conjunto y nace activa", async () => {
    const { db, escrituras } = firestoreDeMentira();
    await sembrarPlanDeCuentas(db, TENANT);
    for (const e of escrituras) {
      expect(e.data.tenantId).toBe(TENANT);
      expect(typeof e.data.code).toBe("string");
      expect(e.data.status).toBe("active");
    }
  });

  it("las dieciséis cuentas de sistema llevan systemKey y las dos padre no", async () => {
    const { db, escrituras } = firestoreDeMentira();
    await sembrarPlanDeCuentas(db, TENANT);
    const conSystemKey = escrituras.filter((e) => e.data.systemKey !== undefined);
    expect(conSystemKey).toHaveLength(16);
    const padres = escrituras.filter((e) => e.data.code === "1" || e.data.code === "2");
    expect(padres).toHaveLength(2);
    for (const p of padres) expect(p.data.systemKey).toBeUndefined();
  });
});

describe("sembrarPlanDeCuentas · reejecutada sobre un conjunto que ya tiene plan", () => {
  it("no reescribe nada si ya están las 18", async () => {
    const todas = SEMILLA_PLAN_DE_CUENTAS.map((c) => docIdDeCuenta(TENANT, c.code));
    const { db, escrituras, commits } = firestoreDeMentira(todas);
    const r = await sembrarPlanDeCuentas(db, TENANT);
    expect(r.creadas).toBe(0);
    expect(r.existentes).toBe(18);
    expect(escrituras).toHaveLength(0);
    // Ni siquiera se commitea un batch vacío.
    expect(commits()).toBe(0);
  });

  // **Este es el caso que justifica la consulta previa.** Un `set()` ciego sobre
  // el id derivado dejaría «Multas» donde el administrador había escrito «Multas
  // y sanciones», y no fallaría nada.
  it("respeta una cuenta que ya existe y solo completa las que faltan", async () => {
    const { db, escrituras } = firestoreDeMentira([docIdDeCuenta(TENANT, "1.3")]);
    const r = await sembrarPlanDeCuentas(db, TENANT);
    expect(r.creadas).toBe(17);
    expect(escrituras.some((e) => e.data.code === "1.3")).toBe(false);
  });
});

describe("sembrarPlanDeCuentas · con batch del llamante", () => {
  // El alta escribe varias cosas; poder acumular en su batch es lo que permite
  // que la siembra viaje con ellas en vez de ser una escritura suelta.
  it("acumula en el batch recibido y NO commitea: decide quien llama", async () => {
    const { db, escrituras, commits } = firestoreDeMentira();
    const ajeno = { set: (ref: { __id: string }, data: Record<string, unknown>) => escrituras.push({ id: ref.__id, data }) };
    const r = await sembrarPlanDeCuentas(db, TENANT, undefined, ajeno as never);
    expect(r.creadas).toBe(18);
    expect(escrituras).toHaveLength(18);
    expect(commits()).toBe(0);
  });
});
