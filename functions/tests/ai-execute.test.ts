import { describe, expect, it } from "vitest";

import { findOperation, type OperationDefinition } from "../src/ai/catalog";
import { executeOperation } from "../src/ai/execute";
import { fakeAiProvider, stubAiProvider } from "../src/ai/provider";

/**
 * Adaptador del proveedor y validación de salida — Paso 1.4 de
 * docs/hoja-de-ruta-ia.md.
 *
 * El criterio del plan es: «una respuesta deliberadamente malformada se rechaza
 * y no llega al módulo». Aquí están las cuatro formas de salir mal, provocadas
 * a voluntad — que es justo lo que no se puede hacer con el modelo real.
 *
 * La regla que se protege: **se rechaza entero**. Media propuesta con la mitad
 * inventada es peor que ninguna, porque parece revisada.
 */

const OPERACION = findOperation("comunicaciones-redactar") as OperationDefinition;

const ENTRADA = {
  proposito: "Avisar del corte de agua programado para el sábado",
  hechos: ["El corte va de 8:00 a 14:00", "Afecta a las torres 1 y 2"],
  tono: "informativo" as const,
};

function salidaValida() {
  return {
    title: "Corte de agua programado",
    body: "El sábado habrá corte de agua de 8:00 a 14:00 en las torres 1 y 2.",
    notificationSummary: "Corte de agua el sábado de 8:00 a 14:00",
    missingInformation: [],
    qualityFlags: [],
    assumptions: [],
  };
}

describe("camino feliz", () => {
  it("el simulador devuelve algo que cumple el contrato", async () => {
    // Si el simulador no pasara su propio validador, el camino feliz no se
    // podría recorrer entero antes de tener proveedor real.
    const resultado = await executeOperation(OPERACION, ENTRADA, stubAiProvider);

    expect(resultado.ok).toBe(true);
    expect(resultado.ok && resultado.usage.model).toBe("stub");
    expect(resultado.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("devuelve la salida ya parseada, no el texto crudo", async () => {
    const provider = fakeAiProvider({ text: JSON.stringify(salidaValida()) });
    const resultado = await executeOperation(OPERACION, ENTRADA, provider);

    expect(resultado.ok && resultado.output).toMatchObject({ title: "Corte de agua programado" });
  });

  it("acepta el JSON envuelto en un bloque de código", async () => {
    // Limpieza de transporte, no indulgencia: los modelos empaquetan a menudo
    // el JSON en ```json … ``` y eso no es incumplir la forma pedida.
    const provider = fakeAiProvider({ text: "```json\n" + JSON.stringify(salidaValida()) + "\n```" });
    const resultado = await executeOperation(OPERACION, ENTRADA, provider);

    expect(resultado.ok).toBe(true);
  });
});

describe("las cuatro formas de salir mal", () => {
  it("prosa en vez de JSON — salida ilegible", async () => {
    const provider = fakeAiProvider({ text: "Claro, aquí tienes el borrador que me pediste:" });
    const resultado = await executeOperation(OPERACION, ENTRADA, provider);

    expect(resultado).toMatchObject({ ok: false, reason: "salida_ilegible" });
  });

  it("RECHAZA una salida con assumptions llena — la regla dura de la PRD", async () => {
    // Si el modelo asumió un dato que nadie le dio, la propuesta no se inserta
    // sola. Y no se salva la parte buena: se descarta la respuesta entera.
    const provider = fakeAiProvider({
      text: JSON.stringify({ ...salidaValida(), assumptions: ["Supuse que el corte es total"] }),
    });
    const resultado = await executeOperation(OPERACION, ENTRADA, provider);

    expect(resultado).toMatchObject({ ok: false, reason: "salida_incumple_contrato" });
    expect(resultado.ok === false && resultado.detail).toContain("assumptions");
  });

  it("rechaza una clave de más — salirse del contrato no se ignora", async () => {
    const provider = fakeAiProvider({
      text: JSON.stringify({ ...salidaValida(), audiencia: "torre-1" }),
    });
    const resultado = await executeOperation(OPERACION, ENTRADA, provider);

    expect(resultado).toMatchObject({ ok: false, reason: "salida_incumple_contrato" });
  });

  it("rechaza si falta un campo obligatorio", async () => {
    const { body: _sin, ...incompleta } = salidaValida();
    const provider = fakeAiProvider({ text: JSON.stringify(incompleta) });
    const resultado = await executeOperation(OPERACION, ENTRADA, provider);

    expect(resultado).toMatchObject({ ok: false, reason: "salida_incumple_contrato" });
  });

  it("corta al proveedor que tarda más de lo permitido", async () => {
    const lento = { ...OPERACION, limits: { ...OPERACION.limits, timeoutMs: 30 } };
    const provider = fakeAiProvider({ delayMs: 300, text: JSON.stringify(salidaValida()) });
    const resultado = await executeOperation(lento, ENTRADA, provider);

    expect(resultado).toMatchObject({ ok: false, reason: "proveedor_no_responde" });
  });

  it("sobrevive a un proveedor que revienta", async () => {
    const provider = fakeAiProvider({ throws: new Error("503 desde el proveedor") });
    const resultado = await executeOperation(OPERACION, ENTRADA, provider);

    expect(resultado).toMatchObject({ ok: false, reason: "proveedor_error" });
    expect(resultado.ok === false && resultado.detail).toContain("503");
  });
});

describe("qué ve la persona cuando falla", () => {
  const provocadores = [
    { nombre: "prosa", provider: fakeAiProvider({ text: "no soy JSON" }), operacion: OPERACION },
    {
      nombre: "contrato incumplido",
      provider: fakeAiProvider({ text: JSON.stringify({ ...salidaValida(), assumptions: ["x"] }) }),
      operacion: OPERACION,
    },
    {
      nombre: "proveedor caído",
      provider: fakeAiProvider({ throws: new Error("boom") }),
      operacion: OPERACION,
    },
    {
      nombre: "tiempo agotado",
      provider: fakeAiProvider({ delayMs: 200 }),
      operacion: { ...OPERACION, limits: { ...OPERACION.limits, timeoutMs: 20 } },
    },
  ];

  it.each(provocadores)("«$nombre» apunta al camino manual", async ({ provider, operacion }) => {
    // Fallback determinista: pase lo que pase, el flujo tradicional sigue.
    // Si un mensaje deja de decirlo, alguien se queda mirando un error sin
    // saber que puede escribir la comunicación a mano.
    const resultado = await executeOperation(operacion, ENTRADA, provider);

    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.message).toContain("proceso manual");
  });

  it("nunca devuelve una salida a medias", async () => {
    const provider = fakeAiProvider({ text: JSON.stringify({ title: "Solo el título" }) });
    const resultado = await executeOperation(OPERACION, ENTRADA, provider);

    expect(resultado.ok).toBe(false);
    expect(resultado).not.toHaveProperty("output");
  });

  it("el detalle técnico no viaja en el mensaje al usuario", async () => {
    const provider = fakeAiProvider({ throws: new Error("clave del proveedor invalida abc123") });
    const resultado = await executeOperation(OPERACION, ENTRADA, provider);

    expect(resultado.ok === false && resultado.message).not.toContain("abc123");
    expect(resultado.ok === false && resultado.detail).toContain("abc123");
  });
});
