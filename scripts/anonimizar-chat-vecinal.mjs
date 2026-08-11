// Segunda pasada de anonimización de un export de chat vecinal (WhatsApp).
//
// POR QUÉ EXISTE: la herramienta que produjo el archivo de origen sustituyó los
// NOMBRES por otros, y no tocó nada más. Quedaban 1.169 identificadores de
// departamento, el nombre del edificio, teléfonos y correos. Un nombre falso al
// lado de «H402» no anonimiza a nadie: para cualquiera de ese edificio, el
// número de departamento ES el nombre.
//
// EL MAPEO DE DEPARTAMENTOS, y por qué así:
//
//  · Consistente entre el cuerpo y el nombre del remitente — 25 de 85
//    remitentes lo llevan dentro. Si no cuadrara, los hilos de conversación se
//    romperían y el corpus perdería justo lo que lo hace valioso.
//  · NO conserva el orden: va por hash, no alfabético. Un mapeo ordenado lo
//    revierte cualquiera que tenga el listado del edificio.
//  · Cambia el FORMATO (H402 → T2-08) para que la estructura del original no se
//    trasluzca.
//
// TRAMPAS QUE COSTARON UNA PASADA EN FALSO:
//
//  1. El ORDEN importa. Sustituir el nombre de la administradora antes que los
//     correos rompe el patrón del correo —`admon1@acresidente.mx` se convierte
//     en algo que ya no parece un correo— y diez sobreviven con usuario real.
//     Los correos van primero.
//  2. Hay departamentos SIN letra: «Carlos Licona 803». El patrón `[A-H]###` no
//     los ve.
//  3. «al 911» y «al 071» son números de EMERGENCIA, no departamentos. Mapearlos
//     corrompe el contenido y deja un aviso de seguridad apuntando a un número
//     inventado. Por eso el patrón del cuerpo excluye la preposición «al» y hay
//     además una lista negra.
//
// QUÉ NO TOCA, a propósito: importes, fechas, horas y el texto de los mensajes.
// Son el contenido que hace útil el corpus y no identifican a nadie.
//
// Uso:
//   node scripts/anonimizar-chat-vecinal.mjs <entrada.txt> <salida.txt>

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [entrada, salida] = process.argv.slice(2);
if (!entrada || !salida) {
  console.error("Uso: node scripts/anonimizar-chat-vecinal.mjs <entrada.txt> <salida.txt>");
  process.exit(1);
}

/** Números de servicio y emergencia. Nunca son un departamento. */
const NO_SON_DEPARTAMENTOS = new Set(["911", "071", "060", "065", "089", "066", "080"]);

const TORRES = ["T1", "T2", "T3"];
const usados = new Set();
const mapa = new Map();

/** Hash estable, para que el destino no dependa del orden alfabético. */
function hash(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mismo código de origen → mismo destino, siempre. Sin colisiones. */
function mapear(codigo) {
  const existente = mapa.get(codigo);
  if (existente) return existente;

  let intento = 0;
  let destino;
  do {
    const h = hash(`${codigo}:${intento}`);
    destino = `${TORRES[h % TORRES.length]}-${((h >>> 8) % 90) + 10}`;
    intento++;
  } while (usados.has(destino));

  usados.add(destino);
  mapa.set(codigo, destino);
  return destino;
}

const LINEA = /^(\[[^\]]+\]\s)([^:]+)(:\s?)([\s\S]*)$/;

const original = readFileSync(entrada, "utf8");

const salidaTexto = original
  .split("\n")
  .map((linea) => {
    const m = LINEA.exec(linea);
    // Las líneas de continuación de un mensaje multilínea no traen remitente.
    if (!m) return limpiarCuerpo(linea);

    const [, sello, remitente, sep, cuerpo] = m;
    return sello + limpiarRemitente(remitente) + sep + limpiarCuerpo(cuerpo);
  })
  .join("\n");

/**
 * En el NOMBRE del remitente, cualquier número de 2 a 4 dígitos es su
 * departamento: no hay otra cosa que ponga números ahí.
 */
function limpiarRemitente(remitente) {
  return limpiarComun(
    remitente
      .replace(/\b([A-H])\s?(\d{3})\b/g, (_c, letra, num) => mapear(`${letra}${num}`))
      .replace(/\b\d{2,4}\b/g, (num) => (NO_SON_DEPARTAMENTOS.has(num) ? num : mapear(num))),
  );
}

function limpiarCuerpo(cuerpo) {
  let texto = cuerpo;

  // Departamento con letra: el caso mayoritario.
  texto = texto.replace(/\b([A-H])\s?(\d{3})\b/g, (_c, letra, num) => mapear(`${letra}${num}`));

  // Departamento sin letra, solo cuando el contexto lo dice. Sin «al», que es
  // la preposición de «llama al 911».
  texto = texto.replace(
    /(?<=\b(?:depto|dpto|depa|departamento|casa|unidad|del)\.?\s)(\d{3})\b/gi,
    (num) => (NO_SON_DEPARTAMENTOS.has(num) ? num : mapear(num)),
  );

  return limpiarComun(texto);
}

/** Correos, teléfonos, identidad del edificio y URLs. En este orden. */
function limpiarComun(texto) {
  // 1. CORREOS PRIMERO. Después de tocar el dominio de la administradora ya no
  //    parecen correos y sobreviven.
  let salida = texto.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "correo@ejemplo.test");

  // 2. Teléfonos: 10+ dígitos, con o sin separadores.
  salida = salida.replace(/\+?\d[\d\s().-]{8,}\d/g, (m) =>
    m.replace(/\D/g, "").length >= 10 ? "[telefono]" : m,
  );

  // 3. Identidad del edificio y de la administradora.
  salida = salida
    .replace(/park\s*coyoac[áa]n/gi, "Conjunto Ejemplo")
    .replace(/\bac\s*residente\b/gi, "Administración")
    .replace(/\bacresidente\b/gi, "administracion");

  // 4. URLs: el dominio dice algo útil para el análisis, la ruta no.
  return salida.replace(/(https?:\/\/)([^/\s]+)(\/\S*)?/g, (_m, esquema, dominio) => `${esquema}${dominio}/[ruta]`);
}

mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, salidaTexto);

console.log(`Departamentos mapeados: ${mapa.size}`);
console.log(`Escrito: ${salida}`);
console.log("\nEl mapeo NO se guarda: sin él, la salida no se puede revertir.");
