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
  it("un encabezado que no se parece a nada deja el campo sin mapear, no lo inventa", () => {
    // Desde el 14 de agosto la coincidencia es por contención, así que «Depto» y
    // «Nombre del propietario» SÍ se reconocen — es el arreglo. Aquí se usan
    // encabezados que de verdad no dicen nada.
    const mapa = suggestMapping(["Columna 1", "Zzz"], "person");
    expect(mapa["person.fullName"]).toBeNull();
    expect(mapa["person.unitLabel"]).toBeNull();
  });

  it("y por contención sí reconoce los encabezados largos de un archivo real", () => {
    const mapa = suggestMapping(["Depto", "Nombre del propietario"], "person");
    expect(mapa["person.unitLabel"]).toBe("Depto");
    expect(mapa["person.fullName"]).toBe("Nombre del propietario");
  });

  it("y el mapeo hecho a mano sí lo resuelve", () => {
    const mapa = { ...suggestMapping(["Depto"], "person"), "person.unitLabel": "Depto" };
    expect(valueFor({ Depto: "T1-101" }, mapa, "person.unitLabel")).toBe("T1-101");
  });

  it("dice qué obligatorios faltan, que es lo que bloquea avanzar", () => {
    const mapa = suggestMapping(["Columna 1"], "person");
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
    const headers = ["nombre", "Columna X", "Saldo"];
    // «nombre» lo resuelve el alias; «Columna X» la asigna la persona; «Saldo» sobra.
    const mapping = {
      ...suggestMapping(headers, "person"),
      "person.unitLabel": "Columna X",
    };
    const r = summarizeMapping(headers, "person", mapping);
    expect(r.camposPorAlias).toBe(1);
    expect(r.camposAMano).toBe(1);
    expect(r.encabezadosSinUsar).toEqual(["Saldo"]);
  });

  it("una columna que nadie usa queda listada — es el trabajo del mapeo asistido", async () => {
    const { summarizeMapping } = await import("@/lib/import/field-catalog");
    const sinNada = ["Columna 1", "RFC", "Zzz"];
    const r = summarizeMapping(sinNada, "person", suggestMapping(sinNada, "person"));
    expect(r.encabezadosSinUsar).toEqual(sinNada);
    expect(r.camposPorAlias + r.camposAMano).toBe(0);
  });
});

/**
 * Los dos archivos reales del 14 de agosto de 2026, con los que se descubrió
 * que el paso de columnas era un examen y no una revisión: de seis campos solo
 * se reconocía «Celular», y un mapeo cruzado pasaba sin aviso.
 */
describe("los archivos que rompieron el paso de columnas", () => {
  const ACEPTADOS_UNIDAD = {
    "unit.type": ["apartment", "apartamento", "apto", "house", "casa", "office", "oficina", "local", "other", "otro", "otra"],
    "unit.status": ["active", "activo", "activa", "inactive", "inactivo", "inactiva"],
  };
  const ACEPTADOS_PERSONA = {
    "person.role": ["owner_occupant", "propietario", "dueno", "owner", "tenant", "inquilino", "arrendatario", "residente", "investor", "inversionista", "other", "otro", "otra"],
  };

  const unidades = {
    headers: ["Identificador", "Edificio", "Clase", "Situación"],
    rows: [
      { Identificador: "EB-201", Edificio: "Edificio A", Clase: "apartamento", "Situación": "activo" },
      { Identificador: "EB-202", Edificio: "Edificio A", Clase: "apartamento", "Situación": "activo" },
      { Identificador: "EB-203", Edificio: "Edificio A", Clase: "casa", "Situación": "activo" },
    ],
  };

  const personas = {
    headers: ["No. Depto", "NOMBRE DEL PROPIETARIO", "Correo electrónico", "Celular", "RFC", "Régimen"],
    rows: [
      { "No. Depto": "EA-101", "NOMBRE DEL PROPIETARIO": "Ana Pérez Ruiz", "Correo electrónico": "ana@correo.com", Celular: "5544332211", RFC: "PEAN850312AB1", "Régimen": "propietario" },
      { "No. Depto": "EA-102", "NOMBRE DEL PROPIETARIO": "Luis Gómez Salas", "Correo electrónico": "luis@correo.com", Celular: "5544332212", RFC: "GOSL900211CD2", "Régimen": "inquilino" },
    ],
  };

  it("el contenido reconoce tipo y estado aunque las columnas se llamen «Clase» y «Situación»", async () => {
    const { suggestMapping } = await import("@/lib/import/field-catalog");
    const m = suggestMapping(unidades.headers, "unit", {
      rows: unidades.rows,
      accepted: ACEPTADOS_UNIDAD,
    });
    // Son justo los dos que el 14 de agosto salieron cruzados.
    expect(m["unit.type"]).toBe("Clase");
    expect(m["unit.status"]).toBe("Situación");
  });

  it("el CSV de residentes pasa de reconocer 1 de 6 a reconocer 5", async () => {
    const { suggestMapping } = await import("@/lib/import/field-catalog");
    const m = suggestMapping(personas.headers, "person", {
      rows: personas.rows,
      accepted: ACEPTADOS_PERSONA,
    });
    expect(m["person.unitLabel"]).toBe("No. Depto");
    expect(m["person.fullName"]).toBe("NOMBRE DEL PROPIETARIO");
    expect(m["person.email"]).toBe("Correo electrónico");
    expect(m["person.phone"]).toBe("Celular");
    expect(m["person.role"]).toBe("Régimen");
    // «RFC» no se reconoce y está bien: documento es opcional, así que no bloquea.
    expect(m["person.documentNumber"]).toBeNull();
  });

  it("y con eso ya no falta ningún obligatorio: se puede continuar", async () => {
    const { suggestMapping, missingRequired } = await import("@/lib/import/field-catalog");
    const m = suggestMapping(personas.headers, "person", {
      rows: personas.rows,
      accepted: ACEPTADOS_PERSONA,
    });
    expect(missingRequired(m, "person")).toHaveLength(0);
  });

  it("el mapeo cruzado que pasó sin aviso ahora BLOQUEA", async () => {
    const { mappingIssues, hayBloqueantes } = await import("@/lib/import/field-catalog");
    // Exactamente lo de la captura: Estado ← Clase, Tipo ← Situación.
    const cruzado = {
      "unit.displayName": "Edificio",
      "unit.tower": "Identificador",
      "unit.type": "Situación",
      "unit.status": "Clase",
    };
    const avisos = mappingIssues(unidades.rows, "unit", cruzado, ACEPTADOS_UNIDAD);
    expect(avisos["unit.status"]?.nivel).toBe("bloquea");
    expect(avisos["unit.status"]?.mensaje).toContain("apartamento");
    expect(hayBloqueantes(avisos)).toBe(true);
  });

  it("un mapeo correcto no molesta con avisos", async () => {
    const { suggestMapping, mappingIssues, hayBloqueantes } = await import("@/lib/import/field-catalog");
    const m = {
      ...suggestMapping(unidades.headers, "unit", { rows: unidades.rows, accepted: ACEPTADOS_UNIDAD }),
      "unit.displayName": "Identificador",
      "unit.tower": "Edificio",
    };
    expect(hayBloqueantes(mappingIssues(unidades.rows, "unit", m, ACEPTADOS_UNIDAD))).toBe(false);
  });
});

/**
 * El fallo que quedó vivo tras el arreglo del contenido: «Nombre de la unidad»
 * apuntando a una columna que decía «Edificio A» tres veces. Pasó la revisión
 * como «3 válidas» y habría creado tres unidades con el mismo nombre.
 */
describe("texto libre: lo que distingue un identificador de una agrupación", () => {
  const headers = ["Identificador", "Edificio", "Clase", "Situación"];
  const rows = [
    { Identificador: "EB-201", Edificio: "Edificio A", Clase: "apartamento", "Situación": "activo" },
    { Identificador: "EB-202", Edificio: "Edificio A", Clase: "apartamento", "Situación": "activo" },
    { Identificador: "EB-203", Edificio: "Edificio A", Clase: "casa", "Situación": "activo" },
  ];
  const ACEPTADOS = {
    "unit.type": ["apartamento", "casa", "oficina", "otro"],
    "unit.status": ["activo", "inactivo"],
  };

  it("ahora el archivo entero se mapea solo, y bien", async () => {
    const { suggestMapping } = await import("@/lib/import/field-catalog");
    const m = suggestMapping(headers, "unit", { rows, accepted: ACEPTADOS });
    // Lo que la persona tuvo que asignar a mano —y asignó al revés—.
    expect(m["unit.displayName"]).toBe("Identificador");
    expect(m["unit.tower"]).toBe("Edificio");
    // Y lo que ya resolvía el contenido.
    expect(m["unit.type"]).toBe("Clase");
    expect(m["unit.status"]).toBe("Situación");
  });

  it("y si aun así se cruzan, el nombre repetido BLOQUEA", async () => {
    const { mappingIssues, hayBloqueantes } = await import("@/lib/import/field-catalog");
    const cruzado = {
      "unit.displayName": "Edificio",
      "unit.tower": "Identificador",
      "unit.type": "Clase",
      "unit.status": "Situación",
    };
    const avisos = mappingIssues(rows, "unit", cruzado, ACEPTADOS);
    expect(avisos["unit.displayName"]?.nivel).toBe("bloquea");
    expect(hayBloqueantes(avisos)).toBe(true);
    // La torre toda distinta solo levanta una duda: un conjunto pequeño puede
    // tener de verdad una unidad por agrupación.
    expect(avisos["unit.tower"]?.nivel).toBe("duda");
  });

  it("un conjunto con torres de verdad no dispara nada", async () => {
    const conTorres = [
      { nombre: "101", torre: "T1" },
      { nombre: "102", torre: "T1" },
      { nombre: "201", torre: "T2" },
    ];
    const { suggestMapping, mappingIssues, hayBloqueantes } = await import("@/lib/import/field-catalog");
    const m = suggestMapping(["nombre", "torre"], "unit", { rows: conTorres });
    expect(m["unit.displayName"]).toBe("nombre");
    expect(m["unit.tower"]).toBe("torre");
    expect(hayBloqueantes(mappingIssues(conTorres, "unit", m, {}))).toBe(false);
  });
});

describe("pickBestSheet · abrir la hoja que sirve, no la primera", () => {
  const ACEPTADOS = {
    "unit.type": ["apartamento", "casa", "oficina", "otro"],
    "unit.status": ["activo", "inactivo"],
  };
  // El libro real de la prueba: la buena está en medio.
  const libro = [
    { name: "Saldos", headers: ["unidad", "saldo"], rows: [{ unidad: "EA-101", saldo: "120000" }] },
    {
      name: "Inventario",
      headers: ["Identificador", "Edificio", "Clase", "Situación"],
      rows: [
        { Identificador: "EB-201", Edificio: "Edificio A", Clase: "apartamento", "Situación": "activo" },
        { Identificador: "EB-202", Edificio: "Edificio A", Clase: "apartamento", "Situación": "activo" },
      ],
    },
    { name: "Notas", headers: ["nota"], rows: [{ nota: "revisar" }] },
  ];

  it("elige «Inventario» aunque «Saldos» vaya primera", async () => {
    const { pickBestSheet } = await import("@/lib/import/field-catalog");
    expect(pickBestSheet(libro, "unit", ACEPTADOS)).toBe("Inventario");
  });

  it("en empate gana la primera del libro, que es el orden que eligió quien lo hizo", async () => {
    const { pickBestSheet } = await import("@/lib/import/field-catalog");
    const iguales = [
      { name: "A", headers: ["nota"], rows: [{ nota: "x" }] },
      { name: "B", headers: ["otra"], rows: [{ otra: "y" }] },
    ];
    expect(pickBestSheet(iguales, "unit", ACEPTADOS)).toBe("A");
  });

  it("un libro de una sola hoja devuelve esa", async () => {
    const { pickBestSheet } = await import("@/lib/import/field-catalog");
    expect(pickBestSheet([libro[0]], "unit", ACEPTADOS)).toBe("Saldos");
  });
});
