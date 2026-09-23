import { describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import {
  inventarioDeSupresion,
  normalizarEmail,
  resumenParaConfirmar,
  veredicto,
  type Inventario,
} from "../src/supresion-de-interesado";

/**
 * `PRD-V-PLAT-007` · el barrido previo a suprimir a un interesado. Lo que se prueba es la
 * distinción que salió de medir producción: **una persona que solo es interesado se puede borrar;
 * una que además usa el producto, no**, porque sus rastros son de la comunidad y no suyos.
 */

/** Firestore de mentira con la forma que usa el módulo: `collection(x).where(campo, "==", v).get()`. */
function firestoreFalso(datos: Record<string, Array<{ id: string; campos: Record<string, unknown> }>>): Firestore {
  return {
    collection(nombre: string) {
      const docs = datos[nombre] ?? [];
      return {
        where(campo: string, _op: string, valor: unknown) {
          const filtrados = docs.filter((d) => d.campos[campo] === valor);
          return {
            async get() {
              return {
                empty: filtrados.length === 0,
                size: filtrados.length,
                docs: filtrados.map((d) => ({ id: d.id, get: (c: string) => d.campos[c] })),
              };
            },
          };
        },
      };
    },
  } as unknown as Firestore;
}

const SOLO_INTERESADO = firestoreFalso({
  leads: [
    { id: "lead-1", campos: { email: "victoria@ejemplo.com", albertEnvio: { estado: "enviado" } } },
    { id: "lead-2", campos: { email: "victoria@ejemplo.com", albertEnvio: { estado: "simulado" } } },
    { id: "lead-otro", campos: { email: "otra@ejemplo.com" } },
  ],
  emailDeliveries: [{ id: "env-1", campos: { recipientEmail: "victoria@ejemplo.com" } }],
  users: [],
  tenantUsers: [],
  people: [],
  accountInvites: [],
});

const TAMBIEN_USUARIO = firestoreFalso({
  leads: [{ id: "lead-3", campos: { email: "david@ejemplo.com", albertEnvio: { estado: "enviado" } } }],
  emailDeliveries: [],
  users: [{ id: "u1", campos: { email: "david@ejemplo.com" } }],
  tenantUsers: [
    { id: "t1_u1", campos: { email: "david@ejemplo.com" } },
    { id: "t2_u1", campos: { email: "david@ejemplo.com" } },
  ],
  people: [{ id: "p1", campos: { email: "david@ejemplo.com" } }],
  accountInvites: [],
});

describe("normalizarEmail", () => {
  it("iguala mayúsculas y espacios, porque es la clave que agrupa a una persona", () => {
    expect(normalizarEmail("  Victoria@Ejemplo.COM ")).toBe("victoria@ejemplo.com");
    expect(normalizarEmail(undefined)).toBe("");
  });
});

describe("inventarioDeSupresion", () => {
  it("reúne TODAS las fichas de esa persona, no solo una, y deja fuera las ajenas", async () => {
    const inv = await inventarioDeSupresion(SOLO_INTERESADO, "Victoria@Ejemplo.com");
    expect(inv.leadIds.sort()).toEqual(["lead-1", "lead-2"]);
    expect(inv.entregasDeCorreo).toEqual(["env-1"]);
  });

  it("solo pide a Albert los leads que llegaron de verdad: un dryRun no dejó nada allí", async () => {
    const inv = await inventarioDeSupresion(SOLO_INTERESADO, "victoria@ejemplo.com");
    expect(inv.leadIdsEnAlbert).toEqual(["lead-1"]);
  });

  it("dice dónde aparece como usuario del producto", async () => {
    const inv = await inventarioDeSupresion(TAMBIEN_USUARIO, "david@ejemplo.com");
    expect(inv.comoUsuario).toEqual([
      { coleccion: "users", documentos: 1 },
      { coleccion: "tenantUsers", documentos: 2 },
      { coleccion: "people", documentos: 1 },
    ]);
  });

  it("un correo vacío es un error, no un barrido de todo", async () => {
    await expect(inventarioDeSupresion(SOLO_INTERESADO, "   ")).rejects.toThrow("email_vacio");
  });
});

describe("veredicto", () => {
  it("deja borrar a quien solo es interesado", async () => {
    const v = veredicto(await inventarioDeSupresion(SOLO_INTERESADO, "victoria@ejemplo.com"));
    expect(v.sePuede).toBe(true);
  });

  it("NIEGA borrar a quien además usa el producto, y nombra dónde aparece (CA2)", async () => {
    const v = veredicto(await inventarioDeSupresion(TAMBIEN_USUARIO, "david@ejemplo.com"));
    expect(v.sePuede).toBe(false);
    if (v.sePuede) return;
    expect(v.motivo).toBe("es_usuario_del_producto");
    expect(v.detalle).toContain("users (1)");
    expect(v.detalle).toContain("tenantUsers (2)");
  });

  it("basta UNA aparición como usuario para negarlo: la puerta no se negocia por mayoría", async () => {
    const soloUnaHuella = firestoreFalso({
      leads: [{ id: "l", campos: { email: "x@ejemplo.com" } }],
      emailDeliveries: [],
      users: [],
      tenantUsers: [],
      people: [{ id: "p", campos: { email: "x@ejemplo.com" } }],
      accountInvites: [],
    });
    const v = veredicto(await inventarioDeSupresion(soloUnaHuella, "x@ejemplo.com"));
    expect(v.sePuede).toBe(false);
  });

  it("sin ficha lo dice en vez de fingir que borró algo", async () => {
    const v = veredicto(await inventarioDeSupresion(SOLO_INTERESADO, "nadie@ejemplo.com"));
    expect(v).toMatchObject({ sePuede: false, motivo: "sin_rastro" });
  });
});

describe("resumenParaConfirmar", () => {
  it("enseña lo que se va a borrar, para que confirmar no sea firmar a ciegas", async () => {
    const lineas = resumenParaConfirmar(await inventarioDeSupresion(SOLO_INTERESADO, "victoria@ejemplo.com"));
    expect(lineas[0]).toContain("2 ficha(s)");
    expect(lineas[1]).toContain("1 contacto(s)");
    expect(lineas[2]).toContain("1 registro(s)");
  });

  it("dice explícitamente cuando no hay nada en el CRM ni correos", () => {
    const vacio: Inventario = { email: "x@y.com", leadIds: ["l"], leadIdsEnAlbert: [], entregasDeCorreo: [], comoUsuario: [] };
    const lineas = resumenParaConfirmar(vacio);
    expect(lineas[1]).toContain("nada en el CRM");
    expect(lineas[2]).toContain("ningún registro");
  });
});
