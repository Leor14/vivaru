import { describe, expect, it } from "vitest";

import { findOperation, type OperationDefinition } from "../src/ai/catalog";
import {
  buildFormatInstruction,
  buildProviderPrompt,
  CONTEXTO_CON_AGRUPACIONES,
  CONTEXTO_EDIFICIO_UNICO,
} from "../src/ai/prompt";

/**
 * Instrucción de formato — Paso 1.4-real de docs/hoja-de-ruta-ia.md.
 *
 * Lo que se protege aquí es la separación: la plataforma pone el FORMATO,
 * derivado del esquema del catálogo; el prompt de TAREA —cómo se redacta bien
 * una comunicación— es el Paso 2.3 y todavía no existe.
 */

const OP = findOperation("comunicaciones-redactar") as OperationDefinition;
const ENTRADA = {
  proposito: "Avisar del corte de agua del sábado",
  hechos: ["De 8:00 a 14:00", "Afecta a las torres 1 y 2"],
  tono: "informativo",
};

describe("instrucción de formato", () => {
  it("se deriva del esquema, así que no puede desincronizarse del validador", () => {
    // Si el contrato cambia y esto no, el modelo recibiría instrucciones de
    // devolver algo que el validador después rechaza.
    const texto = buildFormatInstruction(OP);
    for (const campo of ["title", "body", "notificationSummary", "missingInformation", "assumptions"]) {
      expect(texto).toContain(campo);
    }
  });

  it("dice las tres reglas duras además de validarlas", () => {
    // Validarlas es lo que las hace ciertas; decirlas ahorra rechazos.
    const texto = buildFormatInstruction(OP);
    expect(texto).toContain("assumptions");
    expect(texto).toMatch(/no lo inventes/i);
    expect(texto).toMatch(/no a[ñn]adas claves/i);
  });

  it("pide JSON y nada más", () => {
    const texto = buildFormatInstruction(OP);
    expect(texto).toMatch(/[ÚU]NICAMENTE con un objeto JSON/);
    expect(texto).toMatch(/sin bloque de c[óo]digo/i);
  });

  it("no contiene un prompt de tarea: eso es el Paso 2.3", () => {
    // Si alguien empieza a meter aquí «escribe en tono cordial y breve», el
    // prompt deja de ser versionable y la evaluación offline pierde sentido.
    //
    // El tope subió de 2.000 a 3.000 al categorizar `missingInformation`
    // (contrato v2): el esquema creció con cinco categorías y sus
    // descripciones, que viajan al modelo A PROPÓSITO. Es crecimiento del
    // contrato, no guía de redacción colada por la puerta de atrás.
    //
    // **El tope no es lo que protege de eso, y conviene no confundirse:** un
    // número redondo solo avisa de que alguien escribió mucho. Quien de verdad
    // guarda la puerta es la expresión de abajo, y por eso el número se puede
    // subir cuando el esquema crece, pero la expresión no se toca.
    const texto = buildFormatInstruction(OP);
    expect(texto.length).toBeLessThan(3000);
    expect(texto).not.toMatch(/eres un asistente|act[úu]a como|redacta de forma/i);
  });
});

describe("mensaje completo al proveedor", () => {
  it("lleva el formato y los datos de la persona", () => {
    const prompt = buildProviderPrompt(OP, ENTRADA);
    expect(prompt).toContain("Datos proporcionados");
    expect(prompt).toContain("Avisar del corte de agua del sábado");
    expect(prompt).toContain("torres 1 y 2");
  });

  it("no revienta con una entrada rara", () => {
    expect(() => buildProviderPrompt(OP, undefined)).not.toThrow();
    expect(() => buildProviderPrompt(OP, { raro: Number.NaN })).not.toThrow();
  });
});

/**
 * Contexto del conjunto — 14 de agosto de 2026.
 *
 * El modelo recibe si el conjunto tiene torres o es un edificio único, para que
 * deje de preguntar «¿a qué torres afecta?» donde no hay torres. Seis de los
 * ocho fallos que le quedaban a `v2-estructura` incluían esa pregunta.
 */
describe("contexto del conjunto", () => {
  it("sin contexto, el mensaje es EL MISMO de antes del cambio", () => {
    // Esta es la prueba que hace posible volver a medir el suelo. Si el mensaje
    // se moviera aunque fuera un carácter, la corrida de referencia dejaría de
    // ser comparable con las seis anteriores y no habría con qué contrastar el
    // efecto del contexto — que es justo el error que el contrato v2 documentó
    // el 12 de agosto de 2026.
    const base = buildProviderPrompt(OP, ENTRADA);
    expect(buildProviderPrompt(OP, ENTRADA, undefined, {})).toBe(base);
    expect(buildProviderPrompt(OP, ENTRADA, undefined, { tieneAgrupaciones: undefined })).toBe(base);
  });

  it("dice cómo es el conjunto, y lo dice como un hecho", () => {
    const conTorres = buildProviderPrompt(OP, ENTRADA, undefined, { tieneAgrupaciones: true });
    const unico = buildProviderPrompt(OP, ENTRADA, undefined, { tieneAgrupaciones: false });

    expect(conTorres).toContain(CONTEXTO_CON_AGRUPACIONES);
    expect(unico).toContain(CONTEXTO_EDIFICIO_UNICO);
    expect(conTorres).not.toContain(CONTEXTO_EDIFICIO_UNICO);
    expect(unico).not.toContain(CONTEXTO_CON_AGRUPACIONES);
  });

  it("NO le prohíbe preguntar por el alcance", () => {
    // La decisión de producto, escrita como prueba. Una instrucción del tipo
    // «no preguntes por el alcance» mataría también «¿qué zonas comunes
    // afecta?», que en un edificio de once pisos es una pregunta buena: el
    // corpus de Quito no dice «torre» ni una vez y dice «piso» 109 veces.
    const unico = buildProviderPrompt(OP, ENTRADA, undefined, { tieneAgrupaciones: false });
    expect(unico).not.toMatch(/no (le )?preguntes|no pidas|omite el alcance|evita preguntar/i);
    // Y dice en voz alta lo que el edificio SÍ tiene, que es lo que deja viva la
    // pregunta legítima.
    expect(unico).toMatch(/pisos y zonas comunes/i);
  });

  it("el contexto va separado de los hechos del administrador", () => {
    // Mezclarlo con los hechos invitaría al modelo a devolverlo como si se lo
    // hubieran dictado, y a escribir «el edificio no tiene torres» dentro de un
    // aviso a residentes.
    const unico = buildProviderPrompt(OP, ENTRADA, undefined, { tieneAgrupaciones: false });
    expect(unico.indexOf(CONTEXTO_EDIFICIO_UNICO)).toBeLessThan(unico.indexOf("Datos proporcionados"));
    expect(unico).toContain("lo sabe Vivaru, no lo escribió el administrador");
  });
});
