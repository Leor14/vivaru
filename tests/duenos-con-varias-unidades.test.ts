import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  duenosConVariasUnidades,
  mismoDocumentoNombresDistintos,
  type PersonaDelPadron,
} from "@/features/residents/duenos-con-varias-unidades";

const persona = (p: Partial<PersonaDelPadron> & { id: string }): PersonaDelPadron => ({
  fullName: "Sin nombre",
  ...p,
});

/**
 * `L-07` — «Un propietario puede tener varias unidades (apto + parqueadero + local). Debería poder
 * verlas juntas» (pág. 3).
 */
describe("L-07 · dueños con varias unidades", () => {
  it("junta por documento las tres unidades de un mismo propietario", () => {
    const grupos = duenosConVariasUnidades([
      persona({ id: "p1", fullName: "María Gómez", documentNumber: "111", unitId: "u-101", unitLabel: "APTO 101" }),
      persona({ id: "p2", fullName: "MARIA GOMEZ", documentNumber: "111", unitId: "u-p12", unitLabel: "PARQ 12" }),
      persona({ id: "p3", fullName: "maría  gómez", documentNumber: "111", unitId: "u-b3", unitLabel: "BODEGA 3" }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].por).toBe("documento");
    expect(grupos[0].registros.map((r) => r.unidad)).toEqual(["APTO 101", "BODEGA 3", "PARQ 12"]);
    expect(grupos[0].registros.map((r) => r.personaId)).toEqual(["p1", "p3", "p2"]);
  });

  /**
   * **El caso real que tumbó la primera versión** (visto en pantalla en producción el 17 sep 2026):
   * el panel dijo «David Cancelo, 2 unidades» y eran David Cancelo y Luis Otero, que comparten el
   * documento de relleno `65465465`.
   */
  it("un documento compartido por DOS NOMBRES no es un dueño: sale aparte, para revisar", () => {
    const padron = [
      persona({ id: "p-dc", fullName: "David Cancelo", documentNumber: "65465465", unitId: "u-102", unitLabel: "APARTAMENTO 102" }),
      persona({ id: "p-lo", fullName: "Luis Otero", documentNumber: "65465465", unitId: "u-301", unitLabel: "APARTAMENTO 301" }),
    ];
    expect(duenosConVariasUnidades(padron)).toEqual([]);
    const conflictos = mismoDocumentoNombresDistintos(padron);
    expect(conflictos).toHaveLength(1);
    expect(conflictos[0].documento).toBe("65465465");
    expect(conflictos[0].nombres).toEqual(["David Cancelo", "Luis Otero"]);
    expect(conflictos[0].registros.map((r) => r.unidad)).toEqual(["APARTAMENTO 102", "APARTAMENTO 301"]);
  });

  it("un nombre escrito de dos formas también va a revisar, no a «un dueño»: es el lado bueno del error", () => {
    const padron = [
      persona({ id: "p1", fullName: "María Gómez", documentNumber: "111", unitId: "u-101", unitLabel: "APTO 101" }),
      persona({ id: "p2", fullName: "María G.", documentNumber: "111", unitId: "u-p12", unitLabel: "PARQ 12" }),
    ];
    expect(duenosConVariasUnidades(padron)).toEqual([]);
    expect(mismoDocumentoNombresDistintos(padron)).toHaveLength(1);
  });

  it("un dueño limpio NO sale también entre los conflictos, ni por documento ni por nombre", () => {
    // Nació de falsar: con la condición de conflicto rota, todos los dueños salían dos veces y
    // ninguna prueba lo decía.
    const porDocumento = [
      persona({ id: "p1", fullName: "María Gómez", documentNumber: "111", unitId: "u-1", unitLabel: "APTO 1" }),
      persona({ id: "p2", fullName: "MARIA GOMEZ", documentNumber: "111", unitId: "u-2", unitLabel: "APTO 2" }),
    ];
    const porNombre = [
      persona({ id: "p3", fullName: "José Pérez", unitId: "u-3", unitLabel: "APTO 3" }),
      persona({ id: "p4", fullName: "Jose Perez", unitId: "u-4", unitLabel: "APTO 4" }),
    ];
    expect(duenosConVariasUnidades([...porDocumento, ...porNombre])).toHaveLength(2);
    expect(mismoDocumentoNombresDistintos([...porDocumento, ...porNombre])).toEqual([]);
  });

  it("un documento con nombres distintos en la MISMA unidad no es nada de esto", () => {
    expect(
      mismoDocumentoNombresDistintos([
        persona({ id: "p1", fullName: "Ana", documentNumber: "7", unitId: "u-1", unitLabel: "APTO 1" }),
        persona({ id: "p2", fullName: "Beto", documentNumber: "7", unitId: "u-1", unitLabel: "APTO 1" }),
      ]),
    ).toEqual([]);
  });

  it("sin documento agrupa por nombre normalizado: tildes y mayúsculas no separan", () => {
    const grupos = duenosConVariasUnidades([
      persona({ id: "p1", fullName: "Jose  PEREZ", unitId: "u-1", unitLabel: "APTO 1" }),
      persona({ id: "p2", fullName: "José Pérez", unitId: "u-2", unitLabel: "APTO 2" }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].por).toBe("nombre");
    expect(grupos[0].registros).toHaveLength(2);
  });

  it("una sola unidad NO es un dueño con varias, aunque el registro esté duplicado", () => {
    expect(
      duenosConVariasUnidades([
        persona({ id: "p1", fullName: "Ana Ruiz", documentNumber: "222", unitId: "u-1", unitLabel: "APTO 1" }),
        persona({ id: "p2", fullName: "Ana Ruiz", documentNumber: "222", unitId: "u-1", unitLabel: "APTO 1" }),
      ]),
    ).toEqual([]);
  });

  it("no cuenta a quien no tiene unidad, ni a un registro ya fusionado", () => {
    expect(
      duenosConVariasUnidades([
        persona({ id: "p1", fullName: "Ana Ruiz", documentNumber: "222", unitId: "u-1", unitLabel: "APTO 1" }),
        persona({ id: "p2", fullName: "Ana Ruiz", documentNumber: "222", unitId: "", unitLabel: "" }),
        persona({ id: "p3", fullName: "Ana Ruiz", documentNumber: "222", unitId: "u-2", unitLabel: "APTO 2", fusionadaEn: "2026-09-01" }),
      ]),
    ).toEqual([]);
  });

  it("el documento manda: un homónimo SIN documento no entra en el grupo del que sí lo tiene", () => {
    const grupos = duenosConVariasUnidades([
      persona({ id: "p1", fullName: "Luis Otero", documentNumber: "333", unitId: "u-1", unitLabel: "APTO 1" }),
      persona({ id: "p2", fullName: "Luis Otero", unitId: "u-2", unitLabel: "APTO 2" }),
    ]);
    expect(grupos).toEqual([]);
  });

  it("ordena de más unidades a menos", () => {
    const grupos = duenosConVariasUnidades([
      persona({ id: "a1", fullName: "Ana", documentNumber: "1", unitId: "u-1", unitLabel: "APTO 1" }),
      persona({ id: "a2", fullName: "Ana", documentNumber: "1", unitId: "u-2", unitLabel: "APTO 2" }),
      persona({ id: "b1", fullName: "Beto", documentNumber: "2", unitId: "u-3", unitLabel: "APTO 3" }),
      persona({ id: "b2", fullName: "Beto", documentNumber: "2", unitId: "u-4", unitLabel: "APTO 4" }),
      persona({ id: "b3", fullName: "Beto", documentNumber: "2", unitId: "u-5", unitLabel: "APTO 5" }),
    ]);
    expect(grupos.map((g) => g.nombre)).toEqual(["Beto", "Ana"]);
  });

  it("sin etiqueta de unidad enseña el id, que es peor pero es verdad", () => {
    const grupos = duenosConVariasUnidades([
      persona({ id: "p1", fullName: "Ana", documentNumber: "9", unitId: "u-1" }),
      persona({ id: "p2", fullName: "Ana", documentNumber: "9", unitId: "u-2" }),
    ]);
    expect(grupos[0].registros.map((r) => r.unidad)).toEqual(["u-1", "u-2"]);
  });
});

/**
 * **El guardián de la decisión: la lista es de MIRAR.** Si un día alguien le pone un botón de
 * fusionar, le quitará unidades al dueño — es exactamente lo que hace el panel de duplicados de al
 * lado, y el aviso tiene que seguir en pantalla.
 */
describe("L-07 · el panel no ofrece acciones", () => {
  const fuente = readFileSync("src/components/features/admin/residents/DuenosConVariasUnidadesPanel.tsx", "utf-8");

  it("no tiene botones ni llama a ninguna callable", () => {
    expect(fuente).not.toMatch(/<Button/);
    expect(fuente).not.toMatch(/Callable\(/);
    expect(fuente).not.toMatch(/onClick=/);
  });

  it("avisa en pantalla de que fusionar pierde unidades", () => {
    expect(fuente).toContain("No los fusiones");
  });

  it("enseña aparte los documentos con nombres distintos, y no los cuenta como dueños", () => {
    expect(fuente).toContain("mismoDocumentoNombresDistintos(comparables)");
    expect(fuente).toContain("Mismo documento, nombres distintos");
  });
});
