import { describe, expect, it } from "vitest";

import {
  mappingIssues,
  hayBloqueantes,
  suggestMapping,
} from "@/lib/import/field-catalog";
import {
  ALIAS_DE_TIPO,
  ETIQUETA_DE_TIPO,
  TIPOS_DE_UNIDAD,
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
