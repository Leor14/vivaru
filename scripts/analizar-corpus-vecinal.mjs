// Mide los cuatro datos que un aviso vecinal debería traer, sobre un export de
// WhatsApp anonimizado.
//
// POR QUÉ EXISTE: el análisis del corpus mexicano (12 de agosto de 2026) se hizo
// con expresiones regulares sueltas que no se guardaron — su documento dice que
// «están en el historial de la sesión». Eso significaba que un corpus nuevo se
// analizaría con reglas escritas de nuevo, y **cualquier diferencia entre países
// podría venir del análisis y no de los datos**. Este script existe para que los
// dos corpus pasen exactamente por el mismo tamiz.
//
// Uso:
//   node scripts/analizar-corpus-vecinal.mjs <archivo.txt> [--etiqueta NOMBRE]
//   node scripts/analizar-corpus-vecinal.mjs <a.txt> <b.txt>     (comparación)
//
// LOS CUATRO DATOS salen de medir el corpus mexicano, no de la intuición:
// cuándo, cuánto dura, a quién afecta y qué debe hacer el residente. Ver
// `datasets/linea-base/hipotesis-de-valor.md`.

import { readFileSync } from "node:fs";

// El parser vive en `lib/whatsapp.mjs` desde el 15 de agosto de 2026, para que
// este script y `analizar-temas-pqrs.mjs` pasen por el mismo. Verificado al
// extraerlo: la salida de este script no cambió ni un byte.
import { parsear, norm } from "./lib/whatsapp.mjs";

// Verbos con los que se anuncia algo. Sin uno de estos no es un aviso. Viven en
// lib/ desde el 15 de agosto de 2026 porque el muestreador de PQRS necesita la
// misma lista para lo contrario: descartar avisos y quedarse con los tickets.
import { ANUNCIA } from "./lib/temas-pqrs.mjs";

/**
 * Asuntos de conjunto. Incluye vocabulario de los TRES mercados a propósito:
 * «pipa» es mexicano y «tanquero» ecuatoriano, «cuota» convive con «alicuota».
 * Un detector con vocabulario de un solo país haría parecer que en el otro no
 * se habla de agua.
 */
const ASUNTO = /\b(agua|cisterna|bomba|hidroneumatico|pipa|tanquero|luz|energia|electric|apagon|elevador|ascensor|obra|mantenimiento|limpieza|fumigacion|cuota|alicuota|expensa|pago|asamblea|reunion|seguridad|guardia|garita|porteria|conserje|porton|puerta|estacionamiento|parqueadero|basura|jardin|piscina|alberca|salon comunal|area comun|areas comunes)\b/;

const DETECTORES = {
  cuando:
    /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo|hoy|manana|pasado manana|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b|\b\d{1,2}\s*\/\s*\d{1,2}\b|\b\d{1,2} de [a-z]+\b/,
  // El `(\s*[ap]\.?\s*m\.?)?` de en medio corrige un fallo, no relaja el
  // criterio: «de 7:00 a. m. a 8:00 p. m.» es un rango horario escrito con
  // todas las letras y el patrón viejo NO lo veía, porque esperaba «de 7:00 a
  // 8:00» y el «a. m.» del medio lo partía. Se descubrió el 14 de agosto de
  // 2026 mirando aviso por aviso, no leyendo el regex.
  duracion:
    /\b(de|desde)\s*(las\s*)?\d{1,2}(:\d{2})?(\s*[ap]\.?\s*m\.?)?\s*(a|hasta|-)\s*(las\s*)?\d{1,2}(:\d{2})?(\s*[ap]\.?\s*m\.?)?|\bhasta (las|nuevo aviso|el)\b|\btodo el dia\b|\bdurante (todo|\d+|el)\b|\b(por|durante)\s*\d+\s*(hora|dia|minuto)|\b\d+\s*horas\b|\baproximadamente\s*\d+/,
  // Los plurales faltaban y era un agujero, no un criterio: la lista traía
  // `area` y `zona` en singular, así que «mantenimiento en las áreas comunes»
  // —que es literalmente decir a qué parte del conjunto afecta— salía como si
  // no dijera nada. Mismo caso con torres, pisos y unidades.
  //
  // Lo que NO se añadió, y es deliberado: «estimados residentes». Es un saludo,
  // no una declaración de alcance, y meterlo haría que CUALQUIER comunicado
  // formal puntuara aquí sin decir a quién afecta. La tentación existía porque
  // habría subido justo la serie que interesaba subir.
  alcance:
    /\b(torres?|bloques?|departamentos?|deptos?|dptos?|apartamentos?|pisos?|casas?|unidad(es)?|zonas?|areas?|sector(es)?|todo el (edificio|conjunto|condominio)|todos los (departamentos|residentes|copropietarios|vecinos)|planta baja|subsuelo)\b/,
  accion:
    /\b(favor de|por favor|les? (pedimos|solicitamos|rogamos)|se solicita|deben|deberan|debera|tienen que|recomendamos|les recomendamos|sugerimos|abstenerse|evitar|evite|almacenar|almacene|retirar|retire|no (olviden|dejen|estacionen)|recuerden|acercarse|comunicarse|reportar|traer|presentar)\b/,
};

function analizar(ruta, etiqueta) {
  const mensajes = parsear(readFileSync(ruta, "utf8"));

  const avisos = mensajes.filter((m) => {
    const t = norm(m.texto);
    // 160 caracteres es el corte del análisis mexicano. Por debajo son
    // reacciones, agradecimientos y preguntas, no avisos.
    return t.length > 160 && ANUNCIA.test(t) && ASUNTO.test(t);
  });

  const conteo = { cuando: 0, duracion: 0, alcance: 0, accion: 0 };
  const histograma = [0, 0, 0, 0, 0];
  const porAutor = new Map();

  for (const aviso of avisos) {
    const t = norm(aviso.texto);
    let tiene = 0;
    for (const [clave, re] of Object.entries(DETECTORES)) {
      if (re.test(t)) {
        conteo[clave] += 1;
        tiene += 1;
      }
    }
    histograma[tiene] += 1;
    const a = porAutor.get(aviso.autor) ?? { avisos: 0, datos: 0 };
    a.avisos += 1;
    a.datos += tiene;
    porAutor.set(aviso.autor, a);
  }

  const total = avisos.length;
  const media = total ? avisos.reduce((s, a) => {
    const t = norm(a.texto);
    return s + Object.values(DETECTORES).filter((re) => re.test(t)).length;
  }, 0) / total : 0;

  return { etiqueta, ruta, mensajes: mensajes.length, avisos: total, conteo, histograma, media, porAutor };
}

function imprimir(r) {
  const pct = (n) => (r.avisos ? Math.round((n / r.avisos) * 100) : 0);
  console.log(`\n${"═".repeat(64)}`);
  console.log(`${r.etiqueta}`);
  console.log(`${"═".repeat(64)}`);
  console.log(`  mensajes ................ ${r.mensajes}`);
  console.log(`  avisos operativos ....... ${r.avisos}`);
  console.log(`  media de datos de 4 ..... ${r.media.toFixed(2)}\n`);
  console.log(`  A quién afecta .......... ${String(r.conteo.alcance).padStart(4)}/${r.avisos}  ${String(pct(r.conteo.alcance)).padStart(3)}%`);
  console.log(`  Cuándo .................. ${String(r.conteo.cuando).padStart(4)}/${r.avisos}  ${String(pct(r.conteo.cuando)).padStart(3)}%`);
  console.log(`  Qué debe hacer .......... ${String(r.conteo.accion).padStart(4)}/${r.avisos}  ${String(pct(r.conteo.accion)).padStart(3)}%`);
  console.log(`  Cuánto dura ............. ${String(r.conteo.duracion).padStart(4)}/${r.avisos}  ${String(pct(r.conteo.duracion)).padStart(3)}%`);
  console.log(`\n  Avisos por número de datos:`);
  r.histograma.forEach((n, i) => console.log(`    ${i} de 4 ... ${String(n).padStart(4)}  ${"█".repeat(Math.round((n / Math.max(1, r.avisos)) * 40))}`));
  const autores = [...r.porAutor.entries()].sort((a, b) => b[1].avisos - a[1].avisos).slice(0, 6);
  console.log(`\n  Quién escribe (top 6 de ${r.porAutor.size} autores):`);
  for (const [autor, d] of autores) {
    console.log(`    ${autor.slice(0, 28).padEnd(30)} ${String(d.avisos).padStart(3)} avisos   ${(d.datos / d.avisos).toFixed(2)} de 4`);
  }
}

const args = process.argv.slice(2).filter((a) => a !== "--etiqueta");
const rutas = args.filter((a) => !a.startsWith("--"));
if (rutas.length === 0) {
  console.error("Uso: node scripts/analizar-corpus-vecinal.mjs <archivo.txt> [otro.txt]");
  process.exit(1);
}

const resultados = rutas.map((ruta) =>
  analizar(ruta, ruta.includes("ecuador") ? "ECUADOR" : ruta.includes("chat-vecinal") ? "MÉXICO" : ruta),
);
resultados.forEach(imprimir);

if (resultados.length > 1) {
  console.log(`\n${"═".repeat(64)}`);
  console.log("COMPARACIÓN — mismo tamiz para los dos");
  console.log(`${"═".repeat(64)}`);
  const fila = (nombre, f) =>
    console.log(`  ${nombre.padEnd(24)} ${resultados.map((r) => String(f(r)).padStart(12)).join("")}`);
  console.log(`  ${"".padEnd(24)} ${resultados.map((r) => r.etiqueta.padStart(12)).join("")}`);
  fila("avisos operativos", (r) => r.avisos);
  fila("media de datos de 4", (r) => r.media.toFixed(2));
  for (const clave of ["alcance", "cuando", "accion", "duracion"]) {
    fila(clave, (r) => `${r.avisos ? Math.round((r.conteo[clave] / r.avisos) * 100) : 0}%`);
  }
  fila("autores de avisos", (r) => r.porAutor.size);
}
console.log();
