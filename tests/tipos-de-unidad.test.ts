import { describe, expect, it } from "vitest";

import {
  mappingIssues,
  hayBloqueantes,
  suggestMapping,
} from "@/lib/import/field-catalog";
import {
  ALIAS_DE_TIPO,
  ETIQUETA_DE_TIPO,
  PALABRAS_CON_ROTULO,
  TIPOS_DE_UNIDAD,
  rotuloDeTipo,
} from "@/lib/units/tipos";
import { unitSchema } from "@/features/admin/schemas";

/**
 * `AI-ONB-001` · el vocabulario de tipos de unidad.
 *
 * **Lo que estas pruebas protegen es que las piezas no se separen.** El
 * vocabulario vivía escrito a mano en SIETE sitios y ya había derivado: el mapa
 * de rótulos conocía `parking` y `storage` mientras el esquema los rechazaba.
 * El compilador ata los que pasan por `UnitType`; lo que NO ata —el `z.enum`
 * que valida, y qué palabras acepta un archivo— se ata aquí.
 */

const UNIDAD_VALIDA = {
  displayName: "PQ-001",
  tower: "Sótano 1",
  status: "active" as const,
};

describe("el vocabulario de tipos no se separa de quien lo valida", () => {
  it("el esquema acepta TODOS los tipos del catálogo", () => {
    for (const tipo of TIPOS_DE_UNIDAD) {
      const r = unitSchema.safeParse({ ...UNIDAD_VALIDA, type: tipo });
      expect(r.success, `el esquema rechaza «${tipo}», que sí está en el catálogo`).toBe(true);
    }
  });

  it("y sigue rechazando uno que no existe", () => {
    // Sin esto, la prueba de arriba pasaría con un esquema que aceptara
    // cualquier cadena: comprobaría que no hay puerta, no que la puerta filtra.
    expect(unitSchema.safeParse({ ...UNIDAD_VALIDA, type: "helipuerto" }).success).toBe(false);
  });

  it("todo tipo tiene rótulo, y ninguno se quedó con el nombre en inglés", () => {
    for (const tipo of TIPOS_DE_UNIDAD) {
      expect(ETIQUETA_DE_TIPO[tipo]?.trim()).toBeTruthy();
      expect(ETIQUETA_DE_TIPO[tipo]).not.toBe(tipo);
    }
  });

  it("todo tipo se puede escribir en un archivo: ninguno se queda sin alias", () => {
    // Un tipo sin alias existe en el desplegable y es **imposible de importar**.
    const conAlias = new Set(Object.values(ALIAS_DE_TIPO));
    for (const tipo of TIPOS_DE_UNIDAD) {
      expect(conAlias.has(tipo), `«${tipo}» no tiene ninguna palabra que lo nombre`).toBe(true);
    }
  });

  it("y ningún alias apunta a un tipo que el esquema rechazaría", () => {
    for (const [palabra, tipo] of Object.entries(ALIAS_DE_TIPO)) {
      expect(unitSchema.safeParse({ ...UNIDAD_VALIDA, type: tipo }).success,
        `«${palabra}» resuelve a «${tipo}», que el esquema no acepta`).toBe(true);
    }
  });
});

describe("un archivo de parqueaderos y bodegas ya no bloquea", () => {
  // El caso U1 de la sonda, con la tabla de alias REAL y no una copia a mano.
  const ACEPTADOS = {
    "unit.type": Object.keys(ALIAS_DE_TIPO),
    "unit.status": ["active", "activo", "inactive", "inactivo"],
  };
  const rows = [
    { Unidad: "PQ-001", "Agrupación": "Sótano 1", Tipo: "parqueadero", Estado: "activo" },
    { Unidad: "PQ-002", "Agrupación": "Sótano 1", Tipo: "parqueadero", Estado: "activo" },
    { Unidad: "BD-001", "Agrupación": "Sótano 2", Tipo: "bodega", Estado: "activo" },
  ];

  it("el archivo entero entra, en vez de pararse por una palabra", () => {
    // Antes del 1 de septiembre de 2026 esto bloqueaba: «Tipo» no parece este
    // dato: dice «parqueadero», que no es un valor válido aquí. Y no marcaba
    // esas tres filas — paraba el archivo completo.
    const mapping = suggestMapping(Object.keys(rows[0]), "unit", { rows, accepted: ACEPTADOS });
    expect(mapping["unit.type"]).toBe("Tipo");

    // **Ni un aviso, ni siquiera de duda.** Con solo `hayBloqueantes` esta
    // prueba era ciega a la mitad del caso: si «parqueadero» desapareciera de
    // los alias, encajaría 1 de 3 valores y saldría «duda» en vez de
    // «bloquea» — el archivo dejaría de entrar limpio y esto seguiría en verde.
    const avisos = mappingIssues(rows, "unit", mapping, ACEPTADOS);
    expect(avisos["unit.type"]).toBeUndefined();
    expect(hayBloqueantes(avisos)).toBe(false);
  });

  it("y cada fila cuaja en el tipo que le toca", () => {
    expect(ALIAS_DE_TIPO["parqueadero"]).toBe("parking");
    expect(ALIAS_DE_TIPO["bodega"]).toBe("storage");
  });
});

/**
 * El resto de la deriva del 1 de septiembre de 2026.
 *
 * El mapa de rótulos de la página de residentes conservaba `commercial` y
 * `local`, y cada uno estaba mal por un motivo distinto:
 *
 *   · `commercial` no lo puede escribir NADIE. No es un tipo válido y ningún
 *     archivo lo resuelve: era un rótulo esperando un valor imposible.
 *   · `local` sí es una palabra que un archivo escribe — pero `ALIAS_DE_TIPO` la
 *     resuelve a `office`. Importada se veía «Oficina»; guardada cruda, «Local
 *     comercial». La misma palabra con dos respuestas.
 *
 * Se contó antes de tocar nada: cero unidades con cualquiera de los dos en
 * producción (93) y en staging (87).
 *
 * **Y el arreglo no fue retirar las dos entradas, sino DERIVAR el mapa entero
 * de `ALIAS_DE_TIPO`.** Retirarlas curaba el caso y dejaba viva la causa: un
 * mapa a mano al lado de un catálogo. Ahora una palabra no puede tener aquí una
 * respuesta distinta de la que tiene allí porque no hay dónde escribirla, y de
 * paso `apto`, `garaje`, `deposito` y `otra` —alias que degradaban a «Apto» o
 * «Garaje» teniendo rótulo bueno a mano— se pintan como su tipo.
 *
 * Estas tres pruebas ya no vigilan el contenido del mapa: vigilan que **siga
 * derivándose**. La primera enrojece si alguien vuelve a escribir una entrada a
 * mano; la segunda, si la derivación se rompe o se queda corta.
 */
describe("lo que se PINTA no se separa de lo que se puede guardar", () => {
  it("el mapa no conoce ninguna palabra que el sistema no pueda producir", () => {
    // Producible = o el esquema lo acepta, o un archivo lo escribe y se resuelve.
    // Derivado, esto se cumple solo; escrito a mano, era donde entró `commercial`.
    const producibles = new Set([...TIPOS_DE_UNIDAD, ...Object.keys(ALIAS_DE_TIPO)]);
    for (const palabra of PALABRAS_CON_ROTULO) {
      expect(
        producibles.has(palabra),
        `«${palabra}» tiene rótulo y nada puede dejarla guardada: ni es un tipo válido ni una palabra que un archivo resuelva`,
      ).toBe(true);
    }
  });

  it("y TODA palabra que un archivo acepta se pinta igual venga como venga", () => {
    // Esta prueba nació débil —solo exigía no contradecir— porque con el mapa a
    // mano `apto` degradaba a «Apto» y no se podía pedir más. Con el mapa
    // derivado se puede exigir lo fuerte: cobertura, no solo coherencia.
    for (const [palabra, tipo] of Object.entries(ALIAS_DE_TIPO)) {
      expect(
        rotuloDeTipo(palabra),
        `«${palabra}» importada resuelve a «${tipo}» y se pinta «${ETIQUETA_DE_TIPO[tipo]}», pero guardada cruda se pinta «${rotuloDeTipo(palabra)}»`,
      ).toBe(ETIQUETA_DE_TIPO[tipo]);
    }
  });

  it("y `local` dice lo mismo por los dos caminos, que es la incoherencia que abrió esto", () => {
    // El caso concreto, clavado aparte: si alguien vuelve a darle rótulo propio,
    // el mensaje de arriba habla de alias en general y este nombra el defecto.
    expect(ALIAS_DE_TIPO["local"]).toBe("office");
    expect(rotuloDeTipo("local")).toBe("Oficina");
    expect(rotuloDeTipo("  LOCAL  ")).toBe("Oficina");
  });

  it("y lo que no es ni tipo ni alias degrada legible, en vez de quedarse en blanco", () => {
    // `commercial` sale ya sin rótulo propio: nada lo resuelve, así que degrada.
    expect(rotuloDeTipo("commercial")).toBe("Commercial");
    expect(rotuloDeTipo("helipuerto")).toBe("Helipuerto");
    expect(rotuloDeTipo(null)).toBe("-");
    expect(rotuloDeTipo("")).toBe("-");
  });
});

describe("las dos palabras que tumbaban padrones enteros", () => {
  it("«departamento» es un apartamento — así se dice en MX, EC, PE y CL", () => {
    // Un inventario impecable BLOQUEABA entero por esta palabra.
    expect(ALIAS_DE_TIPO["departamento"]).toBe("apartment");
  });

  it("«estacionamiento» es un parqueadero", () => {
    // Sin ella encajaban 2 de 6 valores: no llegaba a bloquear, así que entraba
    // con las unidades mal tipadas — que es peor que pararse.
    expect(ALIAS_DE_TIPO["estacionamiento"]).toBe("parking");
  });

  it("y un archivo de departamentos entra sin un solo aviso", () => {
    const ACEPTADOS = {
      "unit.type": Object.keys(ALIAS_DE_TIPO),
      "unit.status": ["activo", "inactivo"],
    };
    const rows = [
      { Unidad: "A-101", Torre: "A", Tipo: "Departamento", Estado: "activo" },
      { Unidad: "A-102", Torre: "A", Tipo: "Departamento", Estado: "activo" },
      { Unidad: "B-201", Torre: "B", Tipo: "Estacionamiento", Estado: "activo" },
      { Unidad: "B-202", Torre: "B", Tipo: "Departamento", Estado: "activo" },
    ];
    const mapping = suggestMapping(Object.keys(rows[0]), "unit", { rows, accepted: ACEPTADOS });
    expect(mapping["unit.type"]).toBe("Tipo");
    expect(mappingIssues(rows, "unit", mapping, ACEPTADOS)["unit.type"]).toBeUndefined();
  });
});
