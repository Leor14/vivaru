import { describe, expect, it } from "vitest";

import { partirEnTramos, type FraseParaResaltar } from "@/lib/ai/frases-marcadas";

/**
 * El corte del borrador en tramos pintables — Fase 3 de `PRD-VAI-FEAT-002`.
 *
 * Lo que estas pruebas protegen no es el resaltado: es que **el resaltado no
 * pueda cambiar el texto**. El borrador es la salida del modelo tal cual, y la
 * regla del programa es que nadie lo reescribe en silencio; un corte que
 * pierda, duplique o reordene una letra rompería esa regla desde presentación.
 */

const frase = (texto: string, desde: number): FraseParaResaltar => ({
  texto,
  desde,
  hasta: desde + texto.length,
});

/** La invariante de todo el módulo: concatenar los tramos devuelve el borrador. */
function concatenado(borrador: string, frases: FraseParaResaltar[]): string {
  return partirEnTramos(borrador, frases)
    .map((t) => t.texto)
    .join("");
}

describe("partirEnTramos", () => {
  it("sin frases marcadas, un solo tramo sin marcar: la pantalla de siempre", () => {
    const borrador = "Hemos recibido su reporte. ¿Podría indicarnos su unidad?";
    expect(partirEnTramos(borrador, [])).toEqual([{ texto: borrador, marcado: false }]);
  });

  it("una frase en medio parte en tres, y el marcado es exactamente la frase", () => {
    const borrador = "Estimado residente. Estamos verificando con el equipo. Saludos.";
    const tramos = partirEnTramos(borrador, [frase("Estamos verificando", 20)]);

    expect(tramos).toEqual([
      { texto: "Estimado residente. ", marcado: false },
      { texto: "Estamos verificando", marcado: true },
      { texto: " con el equipo. Saludos.", marcado: false },
    ]);
  });

  /**
   * El caso de dos frases es real: en la corrida de la v1 del 16 de agosto de
   * 2026 hubo un borrador con «Estamos verificando» y «se ha gestionado».
   */
  it("dos frases alternan tramos y se conserva cada letra", () => {
    const borrador = "Estamos verificando el caso. Además, se ha gestionado con el proveedor.";
    const frases = [frase("Estamos verificando", 0), frase("se ha gestionado", 37)];
    const tramos = partirEnTramos(borrador, frases);

    expect(tramos.filter((t) => t.marcado).map((t) => t.texto)).toEqual([
      "Estamos verificando",
      "se ha gestionado",
    ]);
    expect(concatenado(borrador, frases)).toBe(borrador);
  });

  it("frase al principio o al final no deja tramos vacíos", () => {
    const alPrincipio = partirEnTramos("Estamos verificando.", [frase("Estamos verificando", 0)]);
    expect(alPrincipio).toEqual([
      { texto: "Estamos verificando", marcado: true },
      { texto: ".", marcado: false },
    ]);

    const alFinal = partirEnTramos("Le informamos que ya notificamos", [frase("ya notificamos", 18)]);
    expect(alFinal).toEqual([
      { texto: "Le informamos que ", marcado: false },
      { texto: "ya notificamos", marcado: true },
    ]);
    for (const tramos of [alPrincipio, alFinal]) {
      expect(tramos.every((t) => t.texto.length > 0)).toBe(true);
    }
  });

  it("frases desordenadas se ordenan por posición", () => {
    const borrador = "Estamos verificando el caso. Además, se ha gestionado con el proveedor.";
    const tramos = partirEnTramos(borrador, [frase("se ha gestionado", 37), frase("Estamos verificando", 0)]);
    expect(tramos[0]).toEqual({ texto: "Estamos verificando", marcado: true });
  });

  /**
   * La defensa de la ventana de despliegue: el frente sale con el push y las
   * functions a mano, así que puede llegar una posición medida sobre OTRO
   * texto. Resaltar palabras inocentes es peor que no resaltar — un resaltado
   * que señala lo que no es se deja de creer a los tres tickets.
   */
  it("descarta la frase cuya posición no corta exactamente su texto", () => {
    const borrador = "Hemos recibido su reporte y lo agradecemos.";
    const tramos = partirEnTramos(borrador, [{ texto: "Estamos verificando", desde: 0, hasta: 19 }]);
    expect(tramos).toEqual([{ texto: borrador, marcado: false }]);
  });

  it("descarta posiciones fuera de rango, invertidas o no enteras", () => {
    const borrador = "Hemos recibido su reporte.";
    const fueraDeRango = [
      { texto: "reporte.", desde: 18, hasta: 40 },
      { texto: "Hemos", desde: -2, hasta: 3 },
      { texto: "", desde: 5, hasta: 5 },
      { texto: "recibido", desde: 6.5, hasta: 14.5 },
    ];
    expect(partirEnTramos(borrador, fueraDeRango)).toEqual([{ texto: borrador, marcado: false }]);
  });

  it("descarta el solapado en vez de duplicar texto en pantalla", () => {
    const borrador = "Estamos verificando ya";
    const tramos = partirEnTramos(borrador, [
      frase("Estamos verificando", 0),
      { texto: "verificando ya", desde: 8, hasta: 22 },
    ]);
    expect(concatenado(borrador, [frase("Estamos verificando", 0), { texto: "verificando ya", desde: 8, hasta: 22 }])).toBe(
      borrador,
    );
    expect(tramos.filter((t) => t.marcado)).toEqual([{ texto: "Estamos verificando", marcado: true }]);
  });

  it("borrador vacío devuelve vacío", () => {
    expect(partirEnTramos("", [])).toEqual([]);
  });

  /** La invariante, contra los casos de todos los tests anteriores a la vez. */
  it("concatenar los tramos SIEMPRE devuelve el borrador letra a letra", () => {
    const borrador = "Estimado residente. Estamos verificando el caso; se ha gestionado además.";
    const combinaciones: FraseParaResaltar[][] = [
      [],
      [frase("Estamos verificando", 20)],
      [frase("Estamos verificando", 20), frase("se ha gestionado", 49)],
      [{ texto: "no cuadra", desde: 3, hasta: 12 }],
      [frase("se ha gestionado", 49), frase("Estamos verificando", 20)],
    ];
    for (const frases of combinaciones) {
      expect(concatenado(borrador, frases)).toBe(borrador);
    }
  });
});
