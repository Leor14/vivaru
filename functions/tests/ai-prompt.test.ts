import { describe, expect, it } from "vitest";

import { findOperation, type OperationDefinition } from "../src/ai/catalog";
import { buildFormatInstruction, buildProviderPrompt } from "../src/ai/prompt";

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
    const texto = buildFormatInstruction(OP);
    expect(texto.length).toBeLessThan(2000);
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
