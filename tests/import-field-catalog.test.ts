import { describe, expect, it } from "vitest";

import {
  IMPORT_FIELDS,
  fieldsFor,
  missingRequired,
  normalizeHeader,
  requiredFieldsFor,
  suggestMapping,
  valueFor,
  type ImportEntity,
} from "@/lib/import/field-catalog";

/**
 * El catálogo centraliza lo que antes vivía duplicado en los dos asistentes de
 * importación. Estas pruebas protegen las dos cosas que ese cambio puede
 * romper sin que se note: que los alias de siempre sigan resolviendo igual
 * (`PRD-V-FEAT-002`, `CA-06`), y que la ambigüedad de `tipo` entre unidad y
 * persona no vuelva.
 */

describe("el catálogo no se contradice a sí mismo", () => {
  it("no repite una clave", () => {
    const claves = IMPORT_FIELDS.map((f) => f.key);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("no repite un alias DENTRO de la misma entidad", () => {
    // Repetirlo haría el mapeo ambiguo: dos campos destino se disputarían la
    // misma columna y ganaría el orden de declaración, que nadie leyó.
    for (const entity of ["unit", "person"] as ImportEntity[]) {
      const alias = fieldsFor(entity).flatMap((f) => f.aliases);
      expect(new Set(alias).size, `alias repetido en ${entity}`).toBe(alias.length);
    }
  });

  it("los alias ya vienen normalizados", () => {
    // Un alias con mayúscula o acento no casaría nunca, y el fallo sería
    // silencioso: el campo simplemente no se sugiere.
    for (const field of IMPORT_FIELDS) {
      for (const alias of field.aliases) {
        expect(normalizeHeader(alias), `${field.key} → "${alias}"`).toBe(alias);
      }
    }
  });
});

describe("«tipo» significa cosas distintas y no se mezclan", () => {
  it("en unidades sugiere el tipo de unidad", () => {
    const mapa = suggestMapping(["nombre", "tipo"], "unit");
    expect(mapa["unit.type"]).toBe("tipo");
  });

  it("en personas sugiere el rol", () => {
    const mapa = suggestMapping(["nombre", "tipo"], "person");
    expect(mapa["person.role"]).toBe("tipo");
    // Y no existe ningún campo de persona que se llame «tipo de persona»
    expect(Object.keys(mapa)).not.toContain("unit.type");
  });
});

describe("los alias de siempre siguen resolviendo igual", () => {
  it("unidades: la plantilla de hoy se mapea entera y sola", () => {
    const mapa = suggestMapping(["nombre", "torre", "tipo", "estado"], "unit");
    expect(mapa).toEqual({
      "unit.displayName": "nombre",
      "unit.tower": "torre",
      "unit.type": "tipo",
      "unit.status": "estado",
    });
  });

  it("personas: la plantilla de hoy se mapea entera y sola", () => {
    const mapa = suggestMapping(
      ["nombre", "email", "telefono", "documento", "unidad", "rol"],
      "person",
    );
    expect(mapa).toEqual({
      "person.fullName": "nombre",
      "person.email": "email",
      "person.phone": "telefono",
      "person.documentNumber": "documento",
      "person.unitLabel": "unidad",
      "person.role": "rol",
    });
  });

  it("acepta las variantes en inglés y los acentos y mayúsculas del archivo", () => {
    const mapa = suggestMapping(["Nombre", "Correo", "Teléfono", "Unit", "Role"], "person");
    expect(mapa["person.fullName"]).toBe("Nombre");
    expect(mapa["person.email"]).toBe("Correo");
    expect(mapa["person.phone"]).toBe("Teléfono");
    expect(mapa["person.unitLabel"]).toBe("Unit");
    expect(mapa["person.role"]).toBe("Role");
  });
});

describe("lo que antes no tenía salida", () => {
  it("un encabezado desconocido deja el campo sin mapear, no lo inventa", () => {
    const mapa = suggestMapping(["Depto", "Nombre del propietario"], "person");
    expect(mapa["person.fullName"]).toBeNull();
    expect(mapa["person.unitLabel"]).toBeNull();
  });

  it("y el mapeo hecho a mano sí lo resuelve", () => {
    const mapa = { ...suggestMapping(["Depto"], "person"), "person.unitLabel": "Depto" };
    expect(valueFor({ Depto: "T1-101" }, mapa, "person.unitLabel")).toBe("T1-101");
  });

  it("dice qué obligatorios faltan, que es lo que bloquea avanzar", () => {
    const mapa = suggestMapping(["Depto"], "person");
    const faltan = missingRequired(mapa, "person").map((f) => f.key);
    expect(faltan).toContain("person.fullName");
    expect(faltan).toContain("person.email");
    expect(faltan).toContain("person.unitLabel");
    expect(faltan).toContain("person.role");
    // El teléfono no es obligatorio: faltar no puede bloquear.
    expect(faltan).not.toContain("person.phone");
  });
});

describe("una columna no alimenta dos campos", () => {
  it("«unidad» va al nombre de la unidad o a la unidad de la persona, no a los dos", () => {
    // En personas, «nombre» y «unidad» son alias que compiten: «unidad» es
    // alias de `person.unitLabel`, y `person.fullName` no lo lleva. Aun así se
    // comprueba que ningún encabezado quede asignado dos veces.
    const mapa = suggestMapping(["nombre", "unidad"], "person");
    const asignados = Object.values(mapa).filter(Boolean);
    expect(new Set(asignados).size).toBe(asignados.length);
  });
});

describe("valueFor", () => {
  it("devuelve cadena vacía si el campo no está mapeado", () => {
    expect(valueFor({ a: "1" }, { "person.phone": null }, "person.phone")).toBe("");
  });

  it("recorta los espacios, como hacía getField", () => {
    expect(valueFor({ tel: "  300  " }, { "person.phone": "tel" }, "person.phone")).toBe("300");
  });
});

describe("requiredFieldsFor", () => {
  it("unidades exige nombre, tipo y estado, pero no torre", () => {
    const claves = requiredFieldsFor("unit").map((f) => f.key);
    expect(claves).toEqual(["unit.displayName", "unit.type", "unit.status"]);
  });
});

describe("summarizeMapping · lo que alimenta la telemetría", () => {
  it("separa lo que resolvió el alias de lo que puso la persona", async () => {
    const { summarizeMapping } = await import("@/lib/import/field-catalog");
    const headers = ["nombre", "Depto", "Saldo"];
    // «nombre» lo resuelve el alias; «Depto» lo asigna la persona; «Saldo» sobra.
    const mapping = {
      ...suggestMapping(headers, "person"),
      "person.unitLabel": "Depto",
    };
    const r = summarizeMapping(headers, "person", mapping);
    expect(r.camposPorAlias).toBe(1);
    expect(r.camposAMano).toBe(1);
    expect(r.encabezadosSinUsar).toEqual(["Saldo"]);
  });

  it("una columna que nadie usa queda listada — es el trabajo del mapeo asistido", async () => {
    const { summarizeMapping } = await import("@/lib/import/field-catalog");
    const r = summarizeMapping(["Depto", "RFC", "Régimen"], "person", suggestMapping(["Depto"], "person"));
    expect(r.encabezadosSinUsar).toEqual(["Depto", "RFC", "Régimen"]);
    expect(r.camposPorAlias + r.camposAMano).toBe(0);
  });
});
