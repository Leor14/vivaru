import { describe, expect, it } from "vitest";

import { agruparConjuntosPorAdministradora } from "@/features/superadmin/conjuntos-por-administradora";

/**
 * `PRD-V-PLAT-002` entrega 2 · la lista de «Conjuntos con acceso» de la pestaña Admins.
 *
 * **La administradora es un ATAJO para marcar** (E2-D1, E2-R10): agrupa sus conjuntos y
 * ofrece «Marcar los N de …», pero no da acceso por sí misma ni sigue a los conjuntos que
 * se le asocien después. Por eso el agrupador solo ordena lo que ya hay: no inventa
 * vínculos persona–administradora.
 */

const t = (id: string, name: string, managementCompanyId?: string, managementCompanyName?: string) => ({
  id,
  name,
  managementCompanyId,
  managementCompanyName,
});

describe("agruparConjuntosPorAdministradora", () => {
  it("un grupo por administradora, con sus conjuntos por nombre", () => {
    const grupos = agruparConjuntosPorAdministradora([
      t("c2", "Zafiro", "sayil", "Sayil"),
      t("c1", "Alcázar", "sayil", "Sayil"),
    ]);
    expect(grupos).toEqual([{ administradora: { id: "sayil", nombre: "Sayil" }, conjuntos: [t("c1", "Alcázar", "sayil", "Sayil"), t("c2", "Zafiro", "sayil", "Sayil")] }]);
  });

  it("los conjuntos sueltos van al final, en su propio grupo sin administradora", () => {
    const grupos = agruparConjuntosPorAdministradora([t("s1", "Suelto"), t("c1", "Alcázar", "sayil", "Sayil")]);
    expect(grupos.map((g) => g.administradora?.nombre ?? null)).toEqual(["Sayil", null]);
    expect(grupos[1].conjuntos.map((c) => c.id)).toEqual(["s1"]);
  });

  it("las administradoras van por nombre", () => {
    const grupos = agruparConjuntosPorAdministradora([
      t("b1", "Uno", "b", "Beta"),
      t("a1", "Dos", "a", "Alfa"),
    ]);
    expect(grupos.map((g) => g.administradora?.nombre)).toEqual(["Alfa", "Beta"]);
  });

  it("sin nombre copiado, la administradora se nombra por su id, no se pierde", () => {
    const grupos = agruparConjuntosPorAdministradora([t("c1", "Alcázar", "sayil")]);
    expect(grupos[0].administradora).toEqual({ id: "sayil", nombre: "sayil" });
  });

  it("sin conjuntos, sin grupos", () => {
    expect(agruparConjuntosPorAdministradora([])).toEqual([]);
  });
});
