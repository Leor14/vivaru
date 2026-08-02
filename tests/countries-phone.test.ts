// tests/countries-phone.test.ts
// Catálogo de países y composición del teléfono. Lógica pura.

import { describe, expect, it } from "vitest";

import { composePhone } from "@/components/ui/phone-field";
import {
  COUNTRIES,
  PRIMARY_COUNTRIES,
  countryByCode,
  flagFor,
  orderedCountries,
  searchCountries,
} from "@/lib/countries";

describe("catálogo de países", () => {
  it("no repite códigos ISO", () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("todos traen nombre e indicativo numérico", () => {
    for (const c of COUNTRIES) {
      expect(c.code, c.code).toMatch(/^[A-Z]{2}$/);
      expect(c.name.length, c.code).toBeGreaterThan(1);
      expect(c.dial, c.code).toMatch(/^\d{1,4}$/);
    }
  });

  it("los mercados de Vivaru salen primero", () => {
    const first = orderedCountries().slice(0, 3).map((c) => c.code);
    expect(first).toEqual([...PRIMARY_COUNTRIES]);
  });

  it("no pierde ni duplica países al reordenar", () => {
    expect(orderedCountries()).toHaveLength(COUNTRIES.length);
    expect(new Set(orderedCountries().map((c) => c.code)).size).toBe(COUNTRIES.length);
  });

  it("los indicativos de los mercados son los correctos", () => {
    expect(countryByCode("MX")?.dial).toBe("52");
    expect(countryByCode("CO")?.dial).toBe("57");
    expect(countryByCode("EC")?.dial).toBe("593");
  });
});

describe("búsqueda de país", () => {
  it("encuentra sin acentos — quien busca teclea «mexico»", () => {
    expect(searchCountries("mexico").map((c) => c.code)).toContain("MX");
    expect(searchCountries("MÉXICO").map((c) => c.code)).toContain("MX");
  });

  it("ordena por relevancia: «co» es Colombia, no «mexiCO»", () => {
    // Un filtro a secas devolvía México primero, porque «co» está dentro de
    // «mexico». Quien teclea «co» quiere Colombia.
    expect(searchCountries("co")[0]?.code).toBe("CO");
    expect(searchCountries("co").map((c) => c.code)).toContain("MX");
  });

  it("el nombre que empieza por la consulta gana a la coincidencia suelta", () => {
    expect(searchCountries("chi")[0]?.code).toBe("CL");
  });

  it("encuentra por indicativo, con «+» o sin él", () => {
    expect(searchCountries("+593").map((c) => c.code)).toContain("EC");
    expect(searchCountries("593").map((c) => c.code)).toContain("EC");
  });

  it("sin consulta devuelve todo, en orden", () => {
    expect(searchCountries("  ")).toHaveLength(COUNTRIES.length);
  });

  it("devuelve vacío cuando nada coincide", () => {
    expect(searchCountries("zzzzz")).toHaveLength(0);
  });
});

describe("bandera desde el código", () => {
  it("mapea a indicadores regionales", () => {
    expect(flagFor("MX")).toBe("🇲🇽");
    expect(flagFor("co")).toBe("🇨🇴");
  });

  it("no revienta con un código inválido", () => {
    expect(flagFor("")).toBe("");
    expect(flagFor("XYZ")).toBe("");
  });
});

describe("composición del teléfono", () => {
  it("antepone el indicativo y descarta el formato", () => {
    expect(composePhone("MX", "55 1234 5678")).toBe("+525512345678");
    expect(composePhone("CO", "(300) 111-2233")).toBe("+573001112233");
  });

  it("no duplica el indicativo si el usuario ya lo pegó", () => {
    // Pegar el número completo desde otro sitio es lo más común del mundo.
    expect(composePhone("MX", "52 55 1234 5678")).toBe("+525512345678");
  });

  it("sin número no hay teléfono — un indicativo suelto no vale", () => {
    expect(composePhone("MX", "")).toBeUndefined();
    expect(composePhone("MX", "   ")).toBeUndefined();
  });
});
