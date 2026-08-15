// Anonimización del corpus vecinal de Ecuador (export de WhatsApp).
//
// POR QUÉ EXISTE Y EN QUÉ SE DIFERENCIA DEL DE MÉXICO:
//
// En el corpus mexicano la herramienta previa había sustituido los nombres y
// quedaban vivos los departamentos, el edificio, teléfonos y correos. Aquí la
// sustitución previa cubrió **nombres y departamentos**, y lo que quedó vivo es
// lo que ninguna herramienta de nombres toca: **teléfonos**. 1.603 apariciones
// de 25 números distintos, más nueve escritos a diez dígitos dentro del texto.
//
// Un número de teléfono identifica a una persona igual o mejor que su nombre.
// Con nombres falsos al lado, el corpus parecía anónimo y no lo era.
//
// LA TRAMPA PRINCIPAL: el mismo vecino aparece en DOS formatos.
//
//   +593 99 509 0247   (cuando WhatsApp no lo tiene en la agenda)
//   0995090247         (cuando alguien lo escribe dentro de un mensaje)
//
// Son el mismo número: el prefijo internacional 593 sustituye al 0 inicial. Si
// se mapean por separado, un mismo vecino sale con dos identidades y los hilos
// se rompen — que es justo lo que hace valioso al corpus. Por eso todo se
// normaliza a una clave canónica antes de decidir el destino.
//
// LO QUE NO SE TOCA, a propósito:
//
//  · **Nombres y departamentos**: ya son ficticios. Volver a mapearlos no
//    añadiría nada y rompería la consistencia con lo que ya se sustituyó.
//  · **Números que NO son teléfonos.** Nueve de los once de diez dígitos
//    empiezan por `09` y son celulares; los otros dos son un número de pedido y
//    un identificador de reunión. Mapear un número de pedido corrompe el
//    contenido sin proteger a nadie — es el mismo error que el script mexicano
//    cometió con el 911, documentado en su cabecera.
//  · Importes, fechas, horas y el texto de los mensajes. Son el contenido que
//    hace útil el corpus y no identifican a nadie.
//
// Uso:
//   node scripts/anonimizar-chat-ecuador.mjs <entrada.txt> <salida.txt>

import { readFileSync, writeFileSync } from "node:fs";

const [, , entrada, salida] = process.argv;
if (!entrada || !salida) {
  console.error("Uso: node scripts/anonimizar-chat-ecuador.mjs <entrada.txt> <salida.txt>");
  process.exit(1);
}

const original = readFileSync(entrada, "utf8");

/**
 * Clave canónica de un teléfono ecuatoriano.
 *
 * `+593 99 509 0247` y `0995090247` son la misma persona. Se reducen los dos a
 * los diez dígitos nacionales para que compartan destino.
 */
function claveTelefono(bruto) {
  const digitos = bruto.replace(/\D/g, "");
  if (digitos.startsWith("593")) return "0" + digitos.slice(3);
  if (digitos.length === 10 && digitos.startsWith("0")) return digitos;
  return null;
}

/**
 * Verificación final: NINGUNA tira que parezca un teléfono debe sobrevivir,
 * venga del país que venga. Se comprueba sobre la salida, no sobre la entrada.
 */
function telefonosVivos(salidaTexto) {
  const sinSep = salidaTexto.replace(/[ \u00A0\u202F().-]/g, "");
  const sinteticos = new Set([...destinos.values()].flatMap((d) => [d.nacional, "00000000" + d.nacional.slice(-2)]));
  return (sinSep.match(/\+\d{8,15}/g) ?? []).filter((t) => {
    const cuerpo = t.replace(/^\+\d{1,3}/, "");
    return !/^0{2,}/.test(cuerpo) && !sinteticos.has(cuerpo);
  });
}

// Un destino por persona, asignado por orden de aparición. El bloque `000`
// deja claro que es sintético: nadie lo confundirá con un número real.
const destinos = new Map();
function destinoDe(clave) {
  if (!destinos.has(clave)) {
    const n = String(destinos.size + 1).padStart(2, "0");
    destinos.set(clave, { nacional: `09900000${n}`, internacional: `+593 99 000 00${n}`, sufijo: `00 000 00${n}` });
  }
  return destinos.get(clave);
}

let texto = original;

// Separador: espacio normal, guion, **y espacios exóticos**. La gente escribe
// el mismo número de cinco formas distintas, y el primer intento de este script
// las contó todas como una sola: exigía diez dígitos seguidos y dejó vivo un
// teléfono escrito «099 9999 999». Lo cazó la verificación, no la lectura.
// Espacios SIN saltos de línea. Con `\s` a secas, un número al final de una
// línea se unía con los dígitos de la siguiente y se comía el salto: la salida
// perdió 7 líneas antes de detectarlo, y eso solo se ve comparando recuentos.
const SEP = "[ \\u00A0\\u202F-]?";

// 1 · Teléfonos con prefijo internacional, de CUALQUIER país.
//
//     El primer intento solo miraba `+593` y dejó vivos 84 números `+1` y 6
//     `+91` — vecinos que escriben desde el extranjero, que el corpus menciona
//     explícitamente («justificamos nuestra ausencia por encontrarnos fuera del
//     país»). Lo destapó la lista de autores del análisis, no esta línea.
//
//     Se conserva el prefijo del país: que alguien escriba desde fuera es
//     contenido, no identidad.
//
//     Van PRIMERO porque contienen dentro la secuencia que el patrón nacional
//     también reconocería; al revés, el reemplazo nacional partiría el número.
const RE_INTERNACIONAL = /\+(\d{1,3})[ \u00A0\u202F().-]*((?:\d[ \u00A0\u202F().-]*){6,14}\d)/g;
texto = texto.replace(RE_INTERNACIONAL, (m, pais, resto) => {
  const digitos = (pais + resto).replace(/\D/g, "");
  if (digitos.length < 8 || digitos.length > 15) return m;
  const destino = destinoDe(digitos);
  return `+${pais} ${destino.sufijo}`;
});

// 2 · Teléfonos nacionales dentro del texto, con o sin separadores. Solo los
//     que empiezan por 09: en Ecuador es el prefijo de celular. El número de
//     pedido y el identificador de reunión no lo llevan y sobreviven intactos —
//     mapear un número de pedido corrompe el contenido sin proteger a nadie.
//
//     El lookbehind evita morder la cola de un número internacional ya
//     sustituido, que es como se fabrican los dobles mapeos.
const RE_NACIONAL = new RegExp(`(?<![\\d+])0${SEP}9${SEP}(?:\\d${SEP}){7}\\d(?!\\d)`, "g");
texto = texto.replace(RE_NACIONAL, (m) => {
  const clave = claveTelefono(m);
  return clave ? destinoDe(clave).nacional : m;
});

// 3 · El nombre del edificio, en TODAS sus grafías.
//
//     El primer intento usaba `cypr[iy]en` y se dejó vivo un «Cyprian» — una
//     sola vez en 5.537 líneas, y una basta. Ahora se caza cualquier palabra
//     que empiece por «cypr», que en español no existe: es más seguro asumir
//     que toda variante es el edificio que enumerar las grafías que a la gente
//     se le ocurren. Lo encontró la comprobación externa, no esta línea.
const RE_EDIFICIO = /cypr[a-zá-úñ]*/gi;
const edificioAntes = (texto.match(RE_EDIFICIO) ?? []).length;
texto = texto.replace(RE_EDIFICIO, (m) => {
  if (m === m.toUpperCase()) return "MIRADOR";
  if (m[0] === m[0].toUpperCase()) return "Mirador";
  return "mirador";
});

// 3-bis · Los nombres que la pasada anterior NO cubrió.
//
//     La sustitución previa cambió los nombres de los vecinos, pero dejó vivo
//     el del dueño del export —458 apariciones, cuatro con apellido—. Es su
//     propio nombre y no el de un tercero, así que no era un problema de
//     privacidad ajena; se mapea igual para que el corpus pueda salir del
//     repositorio sin pensarlo dos veces.
//
//     El apellido va PRIMERO: si se sustituyera el nombre de pila antes, el
//     apellido quedaría suelto al lado de otro nombre y sería más
//     identificable, no menos. Mismo orden que el script mexicano documenta
//     para los correos.
const NOMBRES_PENDIENTES = [
  [/\bDavid Almeida\b/g, "Ernesto Salgado"],
  [/\bAlmeida\b/g, "Salgado"],
  [/\bDavid\b/g, "Ernesto"],
];
let nombresSustituidos = 0;
for (const [re, destino] of NOMBRES_PENDIENTES) {
  nombresSustituidos += (texto.match(re) ?? []).length;
  texto = texto.replace(re, destino);
}

// 4 · Correos.
const correosAntes = (texto.match(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g) ?? []).length;
texto = texto.replace(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "correo@ejemplo.com");

// 5 · Identificadores de reunión. No identifican a una persona, pero son una
//     puerta abierta a una sala que puede seguir existiendo.
texto = texto.replace(/(zoom\.us\/j\/)\d+/gi, "$10000000000");
texto = texto.replace(/(meet\.google\.com\/)[a-z-]+/gi, "$1xxx-xxxx-xxx");

writeFileSync(salida, texto, "utf8");

// ── VERIFICACIÓN ────────────────────────────────────────────────────────────
//
// El script mexicano documenta que su primera comprobación compartía el punto
// ciego del error que buscaba, así que daba cero sin haber limpiado nada. Aquí
// la verificación NO usa los patrones de arriba: busca en la salida las
// secuencias de dígitos EXACTAS de los originales. Si un solo número
// sobrevivió, lo encuentra aunque el patrón que debía cazarlo estuviera mal.

const originalesCrudos = new Set();
// Barrido AMPLIO y a propósito distinto del de arriba: cualquier tira de diez
// dígitos —admitiendo separadores— que normalice a un celular ecuatoriano.
// Si los patrones de sustitución se dejan una forma, este los ve igual.
for (const m of original.match(/(?<![\d+])(?:\d[ \u00A0\u202F-]?){9}\d(?!\d)/g) ?? []) {
  const d = m.replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("09")) originalesCrudos.add(d.slice(1));
}
for (const m of original.match(/\+?593[ \u00A0\u202F-]?(?:\d[ \u00A0\u202F-]?){8}\d/g) ?? []) {
  originalesCrudos.add(m.replace(/\D/g, "").slice(3));
}

const salidaSinEspacios = texto.replace(/[ \u00A0\u202F-]/g, "");
const supervivientes = [...originalesCrudos].filter((d) => salidaSinEspacios.includes(d));

console.log(`\nAnonimización del corpus de Ecuador`);
console.log(`  entrada: ${entrada}`);
console.log(`  salida:  ${salida}\n`);
console.log(`  teléfonos distintos mapeados ... ${destinos.size}`);
console.log(`  menciones del edificio ......... ${edificioAntes}`);
console.log(`  correos ....................... ${correosAntes}`);
console.log(`  nombres pendientes ............ ${nombresSustituidos}`);
console.log(`\n  VERIFICACIÓN (busca los dígitos originales en la salida)`);
console.log(`  teléfonos que sobreviven ...... ${supervivientes.length}`);
console.log(`  edificio que sobrevive ........ ${(texto.match(/cypr[a-zá-úñ]*/gi) ?? []).length}`);
console.log(`  teléfonos de otros países ..... ${telefonosVivos(texto).length}`);
console.log(`  nombre del dueño que sobrevive  ${(texto.match(/\bDavid\b|\bAlmeida\b/g) ?? []).length}`);
console.log(`  correos que sobreviven ........ ${(texto.match(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g) ?? []).filter((c) => c !== "correo@ejemplo.com").length}`);

const lineasEntrada = original.split("\n").length;
const lineasSalida = texto.split("\n").length;
console.log(`  líneas conservadas ............ ${lineasSalida}/${lineasEntrada}`);

if (lineasEntrada !== lineasSalida) {
  console.log(`\n  ⚠️  NO usar esta salida. Se perdieron ${lineasEntrada - lineasSalida} líneas:`);
  console.log(`      algún patrón está cruzando saltos de línea y fusionando mensajes.`);
  process.exit(1);
}

if (supervivientes.length > 0) {
  console.log(`\n  ⚠️  NO usar esta salida. Sobrevivieron ${supervivientes.length} teléfonos.`);
  process.exit(1);
}
console.log(`\n  ✅ Sin restos. La salida se puede versionar.\n`);
