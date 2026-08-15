import { describe, expect, it } from "vitest";

import {
  aplicarEvento,
  distanciaEdicion,
  FEEDBACK_INICIAL,
  paraEnviar,
  type EstadoFeedback,
} from "@/lib/ai/feedback-borrador";

/**
 * Lo que se manda al servidor sobre el borrador asistido — Paso 2.5.
 *
 * Dos cosas que pueden salir mal de forma cara, y por eso están aquí: que se
 * escape contenido del conjunto en una métrica, y que la métrica mienta.
 */

const encadenar = (...eventos: Parameters<typeof aplicarEvento>[1][]): EstadoFeedback =>
  eventos.reduce(aplicarEvento, FEEDBACK_INICIAL);

describe("lo que sale del navegador", () => {
  it("no lleva ni una frase, solo categorías y números", () => {
    const estado = encadenar(
      { tipo: "propuesta", mostrados: ["duracion", "fecha"] },
      { tipo: "descarte", categoria: "fecha" },
      { tipo: "respuesta", categoria: "duracion" },
      { tipo: "aplicada" },
      { tipo: "guardada", distanciaEdicion: 12 },
    );

    // La garantía no es una promesa en un comentario: se serializa lo que se
    // enviaría y se comprueba que ahí dentro no hay texto libre.
    const enviado = JSON.stringify(paraEnviar(estado));
    const valores = Object.values(JSON.parse(enviado) as Record<string, unknown>).flat();
    const textos = valores.filter((v) => typeof v === "string");
    expect(textos.every((t) => ["duracion", "fecha", "alcance", "accion", "otro"].includes(t as string))).toBe(true);
  });

  it("no manda nada si nunca pidió un borrador", () => {
    // Abrir el formulario y escribir a mano no es un dato de esta métrica.
    // Contarlo pondría una fila por cada comunicado y ensuciaría el denominador.
    expect(paraEnviar(FEEDBACK_INICIAL)).toBeNull();
    expect(paraEnviar(encadenar({ tipo: "propuesta", mostrados: [] }))).not.toBeNull();
  });
});

describe("lo que cuenta la métrica", () => {
  it("cuenta cada propuesta pedida", () => {
    const estado = encadenar(
      { tipo: "propuesta", mostrados: ["duracion"] },
      { tipo: "propuesta", mostrados: ["fecha"] },
    );
    expect(estado.propuestas).toBe(2);
  });

  it("al pedir otra versión olvida los descartes de la anterior", () => {
    // Si se acumularan, un descarte resuelto pidiendo otra versión seguiría
    // contando como que el modelo preguntó de más.
    const estado = encadenar(
      { tipo: "propuesta", mostrados: ["duracion", "fecha"] },
      { tipo: "descarte", categoria: "fecha" },
      { tipo: "propuesta", mostrados: ["alcance"] },
    );
    expect(estado.descartados).toEqual([]);
    expect(estado.mostrados).toEqual(["alcance"]);
  });

  it("separa contestar de descartar, que es lo que la primera sesión rompió", () => {
    // El 13 de agosto de 2026 el único descarte de la sesión fue `duracion`, y
    // no porque sobrara: el administrador no sabía dónde responder la pregunta.
    // Si las dos señales se sumaran, «preguntó de más» y «no supo contestar»
    // serían indistinguibles, y son lo contrario.
    const estado = encadenar(
      { tipo: "propuesta", mostrados: ["duracion", "fecha"] },
      { tipo: "respuesta", categoria: "duracion" },
      { tipo: "descarte", categoria: "fecha" },
    );
    expect(estado.respondidos).toEqual(["duracion"]);
    expect(estado.descartados).toEqual(["fecha"]);
  });

  it("al pedir otra versión olvida también las respuestas", () => {
    // El dato que contestó ya viajó dentro de los hechos de esa petición.
    // Arrastrarlo ocultaría preguntas nuevas que nunca vio.
    const estado = encadenar(
      { tipo: "propuesta", mostrados: ["duracion"] },
      { tipo: "respuesta", categoria: "duracion" },
      { tipo: "propuesta", mostrados: ["alcance"] },
    );
    expect(estado.respondidos).toEqual([]);
  });

  it("descartar dos veces la misma categoría son dos señales", () => {
    const estado = encadenar(
      { tipo: "propuesta", mostrados: ["fecha", "fecha"] },
      { tipo: "descarte", categoria: "fecha" },
      { tipo: "descarte", categoria: "fecha" },
    );
    expect(estado.descartados).toEqual(["fecha", "fecha"]);
  });

  it("volver a aplicar después de deshacer no deja a nadie marcado", () => {
    const estado = encadenar(
      { tipo: "propuesta", mostrados: [] },
      { tipo: "aplicada" },
      { tipo: "deshecha" },
      { tipo: "aplicada" },
    );
    expect(estado.aplicada).toBe(true);
    expect(estado.deshecha).toBe(false);
  });

  it("deshacer y no volver a aplicar sí queda anotado", () => {
    const estado = encadenar({ tipo: "propuesta", mostrados: [] }, { tipo: "aplicada" }, { tipo: "deshecha" });
    expect(estado.deshecha).toBe(true);
  });
});

describe("cuánto se editó", () => {
  it("no cambiar nada es cero", () => {
    const texto = "El sábado habrá corte de agua de 8:00 a 14:00 en la torre central.";
    expect(distanciaEdicion(texto, texto)).toBe(0);
  });

  it("una tilde o una coma no cuentan como edición", () => {
    // Si contaran, el piloto leería «lo reescriben entero» donde alguien solo
    // corrigió la ortografía.
    expect(distanciaEdicion("El sabado habra corte", "El sábado habrá corte,")).toBe(0);
  });

  it("borrar la propuesta entera es cien", () => {
    expect(distanciaEdicion("un texto propuesto", "")).toBe(100);
  });

  it("cambiar una palabra de cuatro es veinticinco", () => {
    expect(distanciaEdicion("corte de agua sábado", "corte de agua domingo")).toBe(25);
  });

  it("añadir al final cuenta lo añadido, no el texto entero", () => {
    // Distancia sobre palabras: si fuera por longitud, añadir una frase larga
    // parecería una reescritura completa.
    const propuesto = "uno dos tres cuatro cinco seis siete ocho";
    expect(distanciaEdicion(propuesto, `${propuesto} nueve diez`)).toBe(20);
  });

  it("dos textos sin nada en común es cien", () => {
    expect(distanciaEdicion("aviso de corte", "asamblea el jueves")).toBe(100);
  });
});
