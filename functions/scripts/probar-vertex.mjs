// Prueba de humo del adaptador real de Vertex AI (Paso 1.4-real).
//
// UNA sola llamada, para responder tres preguntas que no se pueden contestar
// leyendo código:
//
//   1. ¿El identificador del modelo es el correcto? No se pudo confirmar por
//      API —la cuenta no tiene permiso de lectura de metadatos de modelos— así
//      que la única verificación posible es llamar.
//   2. ¿La cuenta tiene permiso para invocar el endpoint global?
//   3. ¿Lo que devuelve el modelo pasa el validador del catálogo?
//
// NO toca Firestore, NO enciende ninguna bandera y NO deja rastro en el
// producto: construye el proveedor a mano y llama. La bandera
// `ia-proveedor-real` sigue apagada después de correr esto.
//
// COSTO: una llamada de ~1.500 tokens con Gemini 3.1 Flash-Lite. Del orden de
// 0,0025 USD — una fracción de centavo. Aun así es dinero real y una llamada a
// un servicio externo, por eso vive en un script que se corre a mano y no en
// una prueba automática.
//
// Uso:  node functions/scripts/probar-vertex.mjs hogaru-1

import { GoogleGenAI } from "@google/genai";

const projectId = process.argv[2];
if (!projectId) {
  console.error("Uso: node functions/scripts/probar-vertex.mjs <projectId>");
  process.exit(1);
}

// Mismos valores que `functions/src/ai/provider-vertex.ts`. Si esta prueba
// obliga a cambiarlos, hay que cambiarlos allí también.
const MODELO = "gemini-3.1-flash-lite";
const UBICACION = "global";

const PROMPT = `Tarea: A partir del propósito, los hechos y el tono que escribe el administrador, propone título, cuerpo y resumen para notificación.

Responde ÚNICAMENTE con un objeto JSON válido con estas claves exactas:
title (texto), body (texto), notificationSummary (texto),
missingInformation (lista de textos), qualityFlags (lista de textos),
assumptions (lista de textos, SIEMPRE vacía).

Sin texto antes ni después y sin bloque de código.

Datos proporcionados:
{
  "proposito": "Avisar del corte de agua programado para el sábado",
  "hechos": ["El corte va de 8:00 a 14:00", "Afecta a las torres 1 y 2"],
  "tono": "informativo"
}`;

console.log(`\nProyecto ${projectId} · modelo ${MODELO} · endpoint ${UBICACION}\n`);

const ai = new GoogleGenAI({ vertexai: true, project: projectId, location: UBICACION });

const inicio = Date.now();
let respuesta;
try {
  respuesta = await ai.models.generateContent({
    model: MODELO,
    contents: [{ role: "user", parts: [{ text: PROMPT }] }],
    config: { maxOutputTokens: 1500, temperature: 0.2, responseMimeType: "application/json" },
  });
} catch (error) {
  console.error("❌ La llamada falló.\n");
  console.error(error?.message ?? error);
  console.error(
    "\nLo habitual: identificador de modelo incorrecto (404), falta de permiso\n" +
      "de la cuenta (403), o la API sin habilitar. En producción esto sería un\n" +
      "`proveedor_error` y el usuario vería «puedes continuar con el proceso manual».",
  );
  process.exit(1);
}

const ms = Date.now() - inicio;
const texto = respuesta.text ?? "";
const uso = respuesta.usageMetadata ?? {};

console.log(`✅ Respondió en ${ms} ms`);
console.log(`   tokens: ${uso.promptTokenCount ?? "?"} entrada · ${uso.candidatesTokenCount ?? "?"} salida`);

const costo =
  ((uso.promptTokenCount ?? 0) / 1e6) * 0.25 + ((uso.candidatesTokenCount ?? 0) / 1e6) * 1.5;
console.log(`   costo estimado: USD ${costo.toFixed(6)}\n`);

let parsed;
try {
  parsed = JSON.parse(texto.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
} catch {
  console.log("⚠️  La respuesta NO es JSON. El validador la habría rechazado como `salida_ilegible`.\n");
  console.log(texto.slice(0, 600));
  process.exit(0);
}

const esperadas = ["title", "body", "notificationSummary", "missingInformation", "qualityFlags", "assumptions"];
const faltan = esperadas.filter((k) => !(k in parsed));
const sobran = Object.keys(parsed).filter((k) => !esperadas.includes(k));

console.log("Contrato:");
console.log(`   claves que faltan: ${faltan.length ? faltan.join(", ") : "ninguna ✅"}`);
console.log(`   claves de más:     ${sobran.length ? sobran.join(", ") : "ninguna ✅"}`);
console.log(
  `   assumptions vacío: ${Array.isArray(parsed.assumptions) && parsed.assumptions.length === 0 ? "sí ✅" : "NO ⚠️  — el validador lo habría rechazado entero"}`,
);

console.log("\nPropuesta devuelta:");
console.log(`   título: ${parsed.title}`);
console.log(`   resumen: ${parsed.notificationSummary}`);
console.log(`   falta por preguntar: ${JSON.stringify(parsed.missingInformation)}`);
console.log(`\n   cuerpo:\n${String(parsed.body).split("\n").map((l) => "   " + l).join("\n")}\n`);
