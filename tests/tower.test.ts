import { describe, expect, it } from "vitest";

import { DEFAULT_TOWER, distinctTowers, normalizeTower } from "@/utils/tower";

describe("normalizeTower", () => {
  it("consolida todas las variantes de torre numérica", () => {
    for (const variant of ["T1", "t1", "torre 1", "torre1", "TORRE 1", "Torre-1", "t_1"]) {
      expect(normalizeTower(variant)).toBe("Torre 1");
    }
  });

  it("consolida bloques y manzanas", () => {
    expect(normalizeTower("bloque a")).toBe("Bloque A");
    expect(normalizeTower("B-A")).toBe("Bloque A");
    expect(normalizeTower("manzana 3")).toBe("Manzana 3");
  });

  it("aplica Title Case a valores libres", () => {
    expect(normalizeTower("TORRE CENTRAL")).toBe("Torre Central");
    expect(normalizeTower("  edificio   norte ")).toBe("Edificio Norte");
  });

  it("vacío/nulo → cadena vacía", () => {
    expect(normalizeTower("")).toBe("");
    expect(normalizeTower(null)).toBe("");
    expect(normalizeTower(undefined)).toBe("");
  });

  it("DEFAULT_TOWER es Principal", () => {
    expect(DEFAULT_TOWER).toBe("Principal");
  });
});

describe("distinctTowers", () => {
  it("colapsa duplicados por variante y ordena", () => {
    const input = ["T1", "torre 1", "torre1", "T2", "TORRE CENTRAL", "", null];
    expect(distinctTowers(input)).toEqual(["Torre 1", "Torre 2", "Torre Central"]);
  });

  it("orden numérico natural (Torre 2 antes que Torre 10)", () => {
    expect(distinctTowers(["torre 10", "t2", "T1"])).toEqual(["Torre 1", "Torre 2", "Torre 10"]);
  });
});
