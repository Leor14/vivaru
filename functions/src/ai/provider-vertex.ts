import { GoogleGenAI } from "@google/genai";
import * as logger from "firebase-functions/logger";

import type { AiGenerationRequest, AiGenerationResult, AiProvider } from "./provider";

/**
 * Adaptador real de Vertex AI (Paso 1.4-real de `docs/hoja-de-ruta-ia.md`).
 *
 * Es la única parte del sistema que sabe hablar con el proveedor. Todo lo demás
 * —puerta, catálogo, validador, cuotas, telemetría— ya existía y no cambia.
 *
 * **Modelo y endpoint, decididos en el Paso 0 y verificados el 10 de agosto de
 * 2026 contra el proyecto real:** Gemini 3.1 Flash-Lite por el endpoint
 * **global**. No es una preferencia: la cuota por región solo conoce Gemini 1.5
 * en las 38 regiones, y todo lo moderno vive únicamente en global.
 */

/**
 * Identificador del modelo.
 *
 * La dimensión de cuota lo nombra `gemini-3.1-flash-lite-qcd`; el sufijo es de
 * clasificación de cuota y no forma parte del identificador que se invoca. No
 * se pudo confirmar por API —la cuenta no tiene permiso de lectura de metadatos
 * de modelos— así que queda aquí, en un solo sitio.
 *
 * Si estuviera mal, la primera llamada falla con `proveedor_error`, el usuario
 * ve «puedes continuar con el proceso manual» y el detalle queda en los logs.
 * Degrada bien a propósito: por eso se puede dejar sin verificar sin riesgo.
 */
export const MODELO = "gemini-3.1-flash-lite";

/**
 * `global`, no `us-central1`. Ver la nota de arriba — y el registro de cierre de
 * los pendientes de consola en la hoja de ruta, que explica por qué el
 * argumento de alinear la IA con la región de Firestore partía de una premisa
 * falsa.
 */
export const UBICACION = "global";

/** Determinismo alto: se redacta contra un contrato, no se busca creatividad. */
const TEMPERATURA = 0.2;

let cliente: GoogleGenAI | null = null;

function obtenerCliente(): GoogleGenAI {
  if (cliente) return cliente;

  // El proyecto sale del entorno de la función; la credencial, de su cuenta de
  // servicio. Nada de claves en el código ni en variables.
  const project = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) throw new Error("No se pudo determinar el proyecto de Google Cloud.");

  cliente = new GoogleGenAI({ vertexai: true, project, location: UBICACION });
  return cliente;
}

function numero(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

export function createVertexProvider(): AiProvider {
  return {
    name: "vertex",

    async generate(request: AiGenerationRequest): Promise<AiGenerationResult> {
      const respuesta = await obtenerCliente().models.generateContent({
        model: MODELO,
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        config: {
          maxOutputTokens: request.maxOutputTokens,
          temperature: TEMPERATURA,
          // Pedir JSON por configuración además de por instrucción: quita de
          // encima el caso más común de salida ilegible, la prosa envolviendo
          // al objeto. El validador sigue siendo quien decide.
          responseMimeType: "application/json",
        },
      });

      const texto = respuesta.text ?? "";
      const uso = respuesta.usageMetadata;

      if (!texto) {
        // Sin texto no hay nada que validar. Suele ser un corte por filtros de
        // seguridad del proveedor; se registra el motivo para poder verlo.
        logger.warn("vertex: respuesta sin texto", {
          finishReason: respuesta.candidates?.[0]?.finishReason,
          model: MODELO,
        });
      }

      return {
        text: texto,
        usage: {
          model: MODELO,
          // Vacío hasta el Paso 2.3, que trae los prompts versionados. Lo que
          // se manda hoy es solo la instrucción de formato derivada del
          // esquema, no un prompt de tarea.
          promptVersion: "sin-prompt",
          inputTokens: numero(uso?.promptTokenCount),
          outputTokens: numero(uso?.candidatesTokenCount),
        },
      };
    },
  };
}
