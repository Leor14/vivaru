// Parser compartido de exports de WhatsApp anonimizados.
//
// POR QUÉ ES UN MÓDULO: nació dentro de `analizar-corpus-vecinal.mjs`, y al
// escribir el segundo analizador (`analizar-temas-pqrs.mjs`) la alternativa era
// copiarlo. Dos copias del mismo parser divergen tarde o temprano, y una
// diferencia entre corpus pasaría a poder venir del parser y no de los datos —
// exactamente la trampa que el tamiz compartido existe para evitar.
//
// Dos formatos de export conviven en los corpus y no son intercambiables:
//
//   iOS      `[13/8/26, 9:41:02 p. m.] Remitente: mensaje`
//   Android  `13/8/2026, 21:41 - Remitente: mensaje`
//
// Si el parser solo entiende uno, el otro corpus sale con cero mensajes y
// parece que no hay avisos — que es una forma silenciosa de equivocarse.

const CABECERA_IOS = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*([\d:]+\s*(?:[ap]\.?\s*m\.?)?)\]\s*([^:]{1,80}?):\s*([\s\S]*)$/;
const CABECERA_ANDROID = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2})\s*-\s*([^:]{1,80}?):\s*([\s\S]*)$/;

export function parsear(texto) {
  const mensajes = [];
  for (const linea of texto.split("\n")) {
    // WhatsApp antepone ‎ a las líneas con adjunto o de sistema.
    const limpia = linea.replace(/‎/g, "");
    const m = CABECERA_IOS.exec(limpia) ?? CABECERA_ANDROID.exec(limpia);
    if (m) {
      mensajes.push({ fecha: m[1], hora: m[2], autor: m[3].trim(), texto: m[4] });
    } else if (mensajes.length > 0 && limpia.trim()) {
      // Continuación: los avisos largos ocupan varias líneas, y perderlas
      // partiría justo los mensajes que más interesan.
      mensajes[mensajes.length - 1].texto += "\n" + limpia;
    }
  }
  return mensajes;
}

export const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
