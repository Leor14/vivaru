import fs from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `PRD-V-PLAT-002` entrega 2 · **E2-R8 — desde un conjunto no se toca una cuenta que
 * tiene acceso a otros.**
 *
 * `setOperationalUserStatus`, `updateOperationalUser` y `deleteOperationalUser` actúan
 * sobre la CUENTA entera: deshabilitan la de Auth, reescriben `users.role` y el claim, o
 * la borran. Mientras nadie tenía dos conjuntos era inofensivo; con la entrega 2, el
 * administrador de un conjunto dejaría fuera de TODOS al admin que comparte con otros.
 */

type Doc = Record<string, unknown>;
let base: Record<string, Doc> = {};

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (col: string) => ({
      doc: (id: string) => ({ get: async () => ({ exists: `${col}/${id}` in base, data: () => base[`${col}/${id}`] }) }),
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

import { MENSAJE_CUENTA_COMPARTIDA, tieneAccesoAOtrosConjuntos } from "../src/tenant-membership";

beforeEach(() => {
  base = {};
});

describe("tieneAccesoAOtrosConjuntos", () => {
  it("una persona de un solo conjunto: no", async () => {
    base["tenantUsers/t-a_u1"] = { uid: "u1", tenantId: "t-a", role: "tenant_admin" };
    await expect(tieneAccesoAOtrosConjuntos("u1", "t-a")).resolves.toBe(false);
  });

  it("con membresía en otro conjunto, de cualquier rol: sí", async () => {
    base["tenantUsers/t-a_u1"] = { uid: "u1", tenantId: "t-a", role: "tenant_admin" };
    base["tenantUsers/t-b_u1"] = { uid: "u1", tenantId: "t-b", role: "resident" };
    await expect(tieneAccesoAOtrosConjuntos("u1", "t-a")).resolves.toBe(true);
  });

  // Una membresía sin conjunto no identifica ninguno: no puede bloquear, igual que en
  // `planearRevocacion` no puede salvar una cuenta.
  it("una membresía sin tenantId no cuenta", async () => {
    base["tenantUsers/t-a_u1"] = { uid: "u1", tenantId: "t-a", role: "tenant_admin" };
    base["tenantUsers/basura_u1"] = { uid: "u1", tenantId: "", role: "tenant_admin" };
    await expect(tieneAccesoAOtrosConjuntos("u1", "t-a")).resolves.toBe(false);
  });

  it("el mensaje dice quién la gestiona y no nombra los otros conjuntos", () => {
    expect(MENSAJE_CUENTA_COMPARTIDA).toMatch(/Vivaru/);
    expect(MENSAJE_CUENTA_COMPARTIDA).not.toMatch(/t-b|conjunto B/);
  });
});

/**
 * **El cableado**, leyendo las fuentes sin comentarios: un guardián que busca texto lo
 * encuentra en el comentario que lo explica.
 */
const fuente = fs
  .readFileSync(path.resolve(__dirname, "../src/index.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

function cuerpoDe(nombre: string): string {
  const inicio = fuente.indexOf(`export const ${nombre} = onCall`);
  const fin = fuente.indexOf("\nexport const ", inicio + 1);
  return inicio === -1 ? "" : fuente.slice(inicio, fin === -1 ? undefined : fin);
}

describe("E2-R8 · las tres acciones de /admin/users preguntan ANTES de escribir", () => {
  const casos: Array<[string, string]> = [
    ["setOperationalUserStatus", "batch.commit()"],
    ["updateOperationalUser", "batch.commit()"],
    ["deleteOperationalUser", "deleteUser("],
  ];

  for (const [callable, primeraEscritura] of casos) {
    it(`${callable} comprueba si la cuenta tiene otros conjuntos antes de ${primeraEscritura}`, () => {
      const cuerpo = cuerpoDe(callable);
      expect(cuerpo.length).toBeGreaterThan(100);
      const guarda = cuerpo.indexOf("tieneAccesoAOtrosConjuntos(");
      expect(guarda).toBeGreaterThan(-1);
      expect(guarda).toBeLessThan(cuerpo.indexOf(primeraEscritura));
    });
  }
});

describe("E2-R2 · solo el superadmin da o quita acceso de admin", () => {
  it("CF12 · setTenantAdminAccess exige superadmin antes de aplicar nada", () => {
    const cuerpo = cuerpoDe("setTenantAdminAccess");
    const guarda = cuerpo.indexOf("assertSuperadmin(");
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(cuerpo.indexOf("aplicarAccesoDeAdministrador("));
  });
});

describe("E2-R1 · la edición ya no muda a nadie", () => {
  // `updateTenantAdmin` borraba la membresía del conjunto anterior al cambiar el
  // selector. Dar y quitar conjuntos vive ahora en `setTenantAdminAccess`.
  it("updateTenantAdmin no borra ninguna membresía", () => {
    const cuerpo = cuerpoDe("updateTenantAdmin");
    expect(cuerpo.length).toBeGreaterThan(100);
    expect(cuerpo).not.toMatch(/\.delete\(/);
  });

  it("ni reescribe el conjunto del claim", () => {
    expect(cuerpoDe("updateTenantAdmin")).not.toContain("setCustomUserClaims(");
  });
});
