import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `PRD-V-PLAT-002` entrega 2 · las dos pantallas.
 *
 * Guardianes de texto sobre las fuentes **sin comentarios**: un guardián que busca una
 * palabra la encuentra en el comentario que lo explica, y documentar la regla lo rompe.
 */
function fuenteSinComentarios(ruta: string): string {
  return fs
    .readFileSync(path.resolve(ruta), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("E2-R9 · /admin/users lista las MEMBRESÍAS del conjunto", () => {
  const pagina = fuenteSinComentarios("src/app/(admin)/admin/users/page.tsx");

  it("lee tenantUsers, no users por users.tenantId", () => {
    expect(pagina).toContain('collection(db, "tenantUsers")');
    expect(pagina).not.toContain('collection(db, "users")');
  });

  it("y a una cuenta compartida no le ofrece las acciones que el servidor rechaza", () => {
    expect(pagina).toMatch(/if \(item\.compartida\)/);
  });
});

describe("E2-D1 · la pestaña Admins da conjuntos con una lista para marcar", () => {
  const pagina = fuenteSinComentarios("src/app/(superadmin)/superadmin/admin-users/page.tsx");

  it("ya no tiene el selector de UN conjunto", () => {
    expect(pagina).not.toContain('register("tenantId")');
  });

  it("usa la lista de «Conjuntos con acceso»", () => {
    expect(pagina).toContain("<ConjuntosConAcceso");
  });

  it("pide el plan al servidor (simular) antes de confirmar un cambio de conjuntos", () => {
    expect(pagina).toMatch(/simular:\s*true/);
    expect(pagina).toContain("setTenantAdminAccessWorkspace(");
  });

  it("el botón de desactivar dice que es de TODOS sus conjuntos", () => {
    expect(pagina).toMatch(/todos sus conjuntos/);
  });
});
