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

/**
 * `AI-ONB-001` · los huecos que la exploración del 1 de septiembre de 2026 midió
 * contra este mismo código, y que no necesitaban IA para taparse.
 *
 * **Lo que estas pruebas protegen no es «que mapee mejor»**, que se ve solo en
 * la sonda: es que los dos alias nuevos no hayan comprado ese acierto a cambio
 * de meter dato mutilado en silencio, que es la peor clase de fallo del
 * importador y la que el propio registro de la exploración nombra primero.
 */
describe("AI-ONB-001 · los alias que faltaban", () => {
  const ACEPTADOS_PERSONA = {
    "person.role": ["propietario", "inquilino", "arrendatario", "residente", "otro"],
  };
  const ACEPTADOS_UNIDAD = {
    "unit.type": ["apartamento", "casa", "oficina", "otro"],
    "unit.status": ["activo", "inactivo"],
  };

  it("un padrón mixto ya no propone el INMUEBLE como nombre de la persona", () => {
    // El caso P3 de la sonda, formato Habitanto. Antes «Inmueble» ganaba el
    // nombre por variedad y la unidad se quedaba sin mapear: sugerencia
    // equivocada, y en silencio.
    const headers = ["Inmueble", "Coeficiente", "Propietario", "Teléfono", "Email"];
    const rows = [
      { Inmueble: "T1-101", Coeficiente: "1,25%", Propietario: "Ana Pérez", "Teléfono": "3001112233", Email: "ana@x.com" },
      { Inmueble: "T1-102", Coeficiente: "1,25%", Propietario: "Luis Gómez", "Teléfono": "3004445566", Email: "luis@x.com" },
      { Inmueble: "T2-201", Coeficiente: "2,10%", Propietario: "Carla Soto", "Teléfono": "3007778899", Email: "carla@x.com" },
    ];
    const m = suggestMapping(headers, "person", { rows, accepted: ACEPTADOS_PERSONA });
    expect(m["person.unitLabel"]).toBe("Inmueble");
    expect(m["person.fullName"]).toBe("Propietario");
  });

  it("«Apto» alimenta la unidad de la persona, y lo hace EL ALIAS", () => {
    // **Una sola fila a propósito.** Con dos o más, la pasada de variedad
    // rescata «Apto» ella sola y la prueba pasaría igual sin el alias: sería un
    // guardián redundante, de los que dan verde sin vigilar nada. Con una fila
    // esa pasada no corre —`variedad` pide dos valores— y lo único que puede
    // resolver la columna es el nombre.
    const headers = ["Apto", "Nombre Completo", "Correo"];
    const rows = [{ Apto: "101", "Nombre Completo": "Ana Pérez", Correo: "ana@x.com" }];
    const m = suggestMapping(headers, "person", { rows, accepted: ACEPTADOS_PERSONA });
    expect(m["person.unitLabel"]).toBe("Apto");
  });

  it("una agrupación llamada «Bloque» es la torre de la unidad", () => {
    const headers = ["Inmueble", "Bloque", "Uso"];
    const rows = [
      { Inmueble: "A-101", Bloque: "A", Uso: "apartamento" },
      { Inmueble: "A-102", Bloque: "A", Uso: "apartamento" },
      { Inmueble: "B-201", Bloque: "B", Uso: "casa" },
    ];
    const m = suggestMapping(headers, "unit", { rows, accepted: ACEPTADOS_UNIDAD });
    expect(m["unit.tower"]).toBe("Bloque");
    expect(m["unit.displayName"]).toBe("Inmueble");
  });
});

describe("AI-ONB-001 · repetir la unidad no es sospechoso, partirla sí", () => {
  const ACEPTADOS_PERSONA = {
    "person.role": ["propietario", "inquilino", "arrendatario", "residente", "otro"],
  };

  it("una FAMILIA en la misma unidad no bloquea nada", async () => {
    // `cardinality: "alta"` en `person.unitLabel` es para SUGERIR. Sin
    // `repeticionEsNormal`, esto disparaba «repite el mismo valor en todas las
    // filas, así que no puede ser este dato» sobre un archivo impecable.
    const { mappingIssues } = await import("@/lib/import/field-catalog");
    const rows = [
      { Unidad: "T1-101", Nombre: "Ana Pérez", Correo: "ana@x.com", Rol: "propietario" },
      { Unidad: "T1-101", Nombre: "Luis Pérez", Correo: "luis@x.com", Rol: "residente" },
      { Unidad: "T1-101", Nombre: "Carla Pérez", Correo: "carla@x.com", Rol: "residente" },
    ];
    const mapping = suggestMapping(Object.keys(rows[0]), "person", { rows, accepted: ACEPTADOS_PERSONA });
    expect(mapping["person.unitLabel"]).toBe("Unidad");
    expect(mappingIssues(rows, "person", mapping, ACEPTADOS_PERSONA)["person.unitLabel"]).toBeUndefined();
  });

  it("Torre y Apto separados que FUNDEN dos unidades bloquean, y dicen cuáles son las columnas", async () => {
    // Sin este aviso el alias «Apto» compra el mapeo al precio de meter a la
    // 101 de la torre 1 y a la 101 de la torre 2 en la misma unidad, con ✔.
    const { mappingIssues, hayBloqueantes } = await import("@/lib/import/field-catalog");
    const rows = [
      { Torre: "1", Apto: "101", Nombre: "Ana Pérez", Correo: "ana@x.com", Rol: "propietario" },
      { Torre: "1", Apto: "102", Nombre: "Luis Gómez", Correo: "luis@x.com", Rol: "inquilino" },
      { Torre: "2", Apto: "101", Nombre: "Carla Soto", Correo: "carla@x.com", Rol: "propietario" },
    ];
    const mapping = suggestMapping(Object.keys(rows[0]), "person", { rows, accepted: ACEPTADOS_PERSONA });
    expect(mapping["person.unitLabel"]).toBe("Apto");

    const avisos = mappingIssues(rows, "person", mapping, ACEPTADOS_PERSONA);
    expect(avisos["person.unitLabel"]?.nivel).toBe("bloquea");
    expect(avisos["person.unitLabel"]?.mensaje).toContain("Torre");
    expect(avisos["person.unitLabel"]?.mensaje).toContain("Apto");
    expect(hayBloqueantes(avisos)).toBe(true);
  });

  it("y si NINGUNA unidad se funde, no molesta: el aviso mide la fusión, no la sospecha", async () => {
    // Mismas dos columnas, pero los números de apartamento no se repiten entre
    // torres. La etiqueta pierde la torre y aun así identifica sin ambigüedad,
    // así que el archivo entra. Es el límite declarado de este guardián.
    const { mappingIssues } = await import("@/lib/import/field-catalog");
    const rows = [
      { Torre: "1", Apto: "101", Nombre: "Ana Pérez", Correo: "ana@x.com", Rol: "propietario" },
      { Torre: "1", Apto: "102", Nombre: "Luis Gómez", Correo: "luis@x.com", Rol: "inquilino" },
      { Torre: "2", Apto: "201", Nombre: "Carla Soto", Correo: "carla@x.com", Rol: "propietario" },
    ];
    const mapping = suggestMapping(Object.keys(rows[0]), "person", { rows, accepted: ACEPTADOS_PERSONA });
    expect(mappingIssues(rows, "person", mapping, ACEPTADOS_PERSONA)["person.unitLabel"]).toBeUndefined();
  });

  it("la fusión se busca en TODAS las filas, no en la muestra de ocho", async () => {
    // Un padrón viene ordenado por torre: las ocho primeras filas caen dentro
    // de la torre 1 y la colisión aparece mucho más abajo.
    const { mappingIssues } = await import("@/lib/import/field-catalog");
    const rows = Array.from({ length: 12 }, (_, i) => ({
      Torre: i < 10 ? "1" : "2",
      Apto: `10${i < 10 ? i : i - 10}`,
      Nombre: `Persona ${i}`,
      Correo: `p${i}@x.com`,
      Rol: "propietario",
    }));
    const mapping = suggestMapping(Object.keys(rows[0]), "person", { rows, accepted: ACEPTADOS_PERSONA });
    expect(mapping["person.unitLabel"]).toBe("Apto");
    expect(mappingIssues(rows, "person", mapping, ACEPTADOS_PERSONA)["person.unitLabel"]?.nivel).toBe("bloquea");
  });
});
