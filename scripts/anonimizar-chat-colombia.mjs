// Anonimización del corpus vecinal de Colombia (export de WhatsApp, Bogotá).
//
// POR QUÉ EXISTE Y EN QUÉ SE DIFERENCIA DE LOS OTROS DOS:
//
// Como en México, la herramienta previa sustituyó los NOMBRES de las personas y
// no tocó nada más. La medición del 15 de agosto de 2026 encontró vivos:
// 14 celulares distintos (6 con +57), 7 correos —dos con DOMINIO PROPIO del
// edificio—, ~80 referencias de apartamento en cuatro grafías, 134 menciones
// del nombre real del conjunto, 3 placas de carro, y la DIRECCIÓN EXACTA del
// edificio, dos veces, dentro de un directorio vecinal de 40 entradas.
//
// Y dos frentes que México y Ecuador no tuvieron:
//
//  · REMITENTES QUE SON UN TELÉFONO. Cuando WhatsApp no tiene el contacto en la
//    agenda, el remitente ES el número («+57 310 …»). La herramienta de
//    nombres no lo ve como nombre. Cuatro casos.
//  · TARJETAS .vcf ADJUNTAS con el nombre y el oficio del contacto en el nombre
//    del archivo («00000097-Electrico … Ejecuto Obra ….vcf»). Es la lección 9
//    del script mexicano con otra cara: la identidad no siempre viaja en el
//    texto que escribe la gente.
//
// LO QUE NO SE TOCA, a propósito:
//
//  · Nombres de personas: ya son ficticios (pasada previa, fuera del repo).
//  · El directorio de edificios VECINOS (nombres y direcciones de otros
//    conjuntos). Son entidades públicas de la zona, no personas; borrarlos
//    corrompería un documento que la conversación cita. Solo se sustituye la
//    entrada del edificio PROPIO, que es la que identifica el corpus.
//  · Importes, fechas, horas y el texto de los mensajes.
//  · Números que no identifican: consecutivos de adjuntos, actas, cifras.
//
// EL ORDEN DE LOS REEMPLAZOS NO ES NEGOCIABLE (lecciones 1 y 6 de México):
// correos antes que el nombre del edificio (los correos LLEVAN el nombre
// dentro: romper el patrón primero deja el usuario real vivo), teléfonos
// internacionales antes que nacionales, y los apartamentos con MARCADORES para
// que el destino de un mapeo no sea re-mapeado por el siguiente.
//
// Uso:
//   node scripts/anonimizar-chat-colombia.mjs <entrada.txt> <salida.txt>

import { readFileSync, writeFileSync } from "node:fs";

const [, , entrada, salida] = process.argv;
if (!entrada || !salida) {
  console.error("Uso: node scripts/anonimizar-chat-colombia.mjs <entrada.txt> <salida.txt>");
  process.exit(1);
}

const original = readFileSync(entrada, "utf8");
const lineasAntes = original.split("\n").length;

// Separadores tolerantes DENTRO de un número: espacio normal, NBSP y el espacio
// fino de WhatsApp, paréntesis, punto y guion — pero NUNCA salto de línea
// (Ecuador perdió 7 líneas por usar `\s` a secas). El nacional va SIN punto:
// «3.000.000» es un importe, no un celular.
const SEP_INT = "[ \\u00A0\\u202F().-]";
// El nacional admite paréntesis y HASTA DOS separadores seguidos —«(304)
// 618-9142» lleva `) ` entre el cuatro y el seis— pero sigue SIN punto.
const SEP_NAC = "[ \\u00A0\\u202F()-]{0,2}";

/** Hash estable: el destino no depende del orden en que aparece el origen. */
function hash(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

let texto = original;

// ── 1 · Correos. ANTES que el edificio: cinco de los siete llevan el nombre
//        dentro, y sustituir primero el nombre rompería el patrón de correo
//        dejando el usuario real suelto (lección 1 de México).
//        Cada dirección distinta conserva identidad propia —administración y
//        comité son remitentes distintos en la conversación— pero falsa.
const correos = new Map();
texto = texto.replace(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g, (m) => {
  const clave = m.toLowerCase();
  if (!correos.has(clave)) correos.set(clave, `correo${correos.size + 1}@ejemplo.com`);
  return correos.get(clave);
});

// ── 2 · Teléfonos con prefijo internacional, de CUALQUIER país (Ecuador dejó
//        vivos 84 números «+1» por mirar solo su prefijo). Se conserva el
//        prefijo: escribir desde fuera es contenido, no identidad. Cubre
//        también los REMITENTES-teléfono, que son texto como cualquier otro.
const telefonos = new Map();
function destinoTelefono(clave) {
  if (!telefonos.has(clave)) telefonos.set(clave, String(telefonos.size + 1).padStart(2, "0"));
  const n = telefonos.get(clave);
  return { nacional: `30000000${n}`, sufijo: `300 000 00${n}` };
}
const RE_INTERNACIONAL = new RegExp(`\\+(\\d{1,3})${SEP_INT}*((?:\\d${SEP_INT}*){6,14}\\d)`, "g");
texto = texto.replace(RE_INTERNACIONAL, (m, pais, resto) => {
  const digitos = (pais + resto).replace(/\D/g, "");
  if (digitos.length < 8 || digitos.length > 15) return m;
  // PEGADO al prefijo, sin espacio: el destino empieza por 3 y con espacio el
  // patrón nacional lo volvería a morder — doble mapeo, la lección 6 otra vez,
  // y esta vez la cazó la verificación y no la lectura. Precedido por un
  // dígito, el lookbehind nacional lo bloquea.
  return `+${pais}${destinoTelefono(digitos).nacional}`;
});

// ── 3 · Celulares nacionales: diez dígitos que empiezan por 3, con o sin
//        separadores. El lookbehind evita morder la cola de un internacional ya
//        sustituido; el lookahead, partir números más largos (consecutivos de
//        adjuntos, que empiezan por 0 y sobreviven a propósito).
//        La clave canónica antepone 57 para que «+57 310 …» y «310 …» —el mismo
//        vecino escrito de dos formas— salgan con la misma identidad falsa
//        (la trampa principal de Ecuador).
const RE_NACIONAL = new RegExp(`(?<![\\d+])3${SEP_NAC}(?:\\d${SEP_NAC}){8}\\d(?!\\d)`, "g");
texto = texto.replace(RE_NACIONAL, (m) => {
  const digitos = m.replace(/\D/g, "");
  return destinoTelefono(`57${digitos}`).nacional;
});

// ── 4 · La dirección PROPIA del edificio, antes que su nombre (una de las dos
//        apariciones viene pegada a él). Solo la propia: el directorio vecinal
//        con las direcciones de otros 39 conjuntos es contenido citado.
texto = texto.replace(/calle\s*110\s*#\s*15\s*-\s*36/gi, "Calle 110 #00-00");

// ── 5 · El nombre del conjunto, en TODAS sus grafías. Ecuador enseñó a cazar
//        el prefijo y no la lista de variantes: la raíz no existe en español,
//        así que toda aparición es el edificio. La forma con 110 va primero y
//        el alias NO conserva el número: 110 es la calle real, y un alias que
//        lo mantenga regala la mitad de la dirección.
texto = texto.replace(/natua[\s-]*110/gi, "Turpial85");
texto = texto.replace(/natua/gi, "Turpial");

// ── 6 · Apartamentos. El inventario se recoge ANTES de tocar nada: números
//        vistos junto a torre/apto en cualquier grafía («Torre 2, Apto. 203»,
//        «501 T2», «306T2», «405 t 2»). Con ese conjunto se reconocen después
//        las menciones SUELTAS («el 501»), que es la lección 8 de México.
const conocidos = new Set();
// El cierre es (?!\d), no \b: «apto 200algo…» existe en el corpus, y entre
// dígito y letra no hay frontera de palabra.
for (const m of original.matchAll(/(?:apto|apt|apartamento|torre)\.?\s*\d?\s*[,.]?\s*(\d{3,4})(?!\d)/gi)) conocidos.add(m[1]);
for (const m of original.matchAll(/\b(\d{3,4})\s*[-–]?\s*[Tt](?:orre)?\s*\d\b/g)) conocidos.add(m[1]);

const aptos = new Map();
const usados = new Set();
function mapearApto(num) {
  if (aptos.has(num)) return aptos.get(num);
  let intento = 0;
  let destino;
  do {
    // 700–999: fuera del rango real (2xx–6xx). El destino nunca es a su vez
    // un origen, que es la mitad de la defensa contra el doble mapeo.
    destino = String(700 + (hash(`${num}:${intento}`) % 300));
    intento++;
  } while (usados.has(destino));
  usados.add(destino);
  aptos.set(num, destino);
  return destino;
}

// La otra mitad: MARCADORES \u0000 en vez de encadenar reemplazos. El destino
// lleva dígitos y el paso siguiente los volvería a mapear («Wilheim H-403» →
// «Wilheim H-T2-14» en México). El \u0000 no existe en un export de WhatsApp.
const marcas = [];
function marcar(num) {
  marcas.push(mapearApto(num));
  return `\u0000${marcas.length - 1}\u0000`;
}
// 6a · Número pegado a la palabra clave: «apto 203», «Torre 2 Apartamento 507».
texto = texto.replace(/((?:apto|apt|apartamento|torre)\.?\s*\d?\s*[,.]?\s*)(\d{3,4})(?!\d)/gi, (m, pre, num) =>
  conocidos.has(num) ? pre + marcar(num) : m,
);
// 6b · Formato «501 T2» / «306T2» / «405 t 2».
texto = texto.replace(/\b(\d{3,4})(\s*[-–]?\s*[Tt](?:orre)?\s*\d)\b/g, (m, num, post) =>
  conocidos.has(num) ? marcar(num) + post : m,
);
// 6c · Sueltos: solo números YA vistos con contexto de vivienda, y nunca tras
//      «#», «$», calle/carrera u «oficina» — el aviso de una inmobiliaria trae
//      «oficina 203» y ese 203 no es el apartamento 203 (el 911 de México).
texto = texto.replace(/(?<![\d\u0000])(\d{3,4})(?![\d\u0000])/g, (m, num, offset) => {
  if (!conocidos.has(num)) return m;
  const antes = texto.slice(Math.max(0, offset - 12), offset);
  if (/[#$]|calle|cra|carrera|cll|oficina|ley/i.test(antes)) return m;
  return marcar(num);
});
texto = texto.replace(/\u0000(\d+)\u0000/g, (_m, i) => marcas[Number(i)]);

// ── 7 · Tarjetas .vcf: el nombre del archivo lleva el contacto real. El
//        consecutivo se conserva (ancla la posición del adjunto); el resto no.
texto = texto.replace(/(\d{8}-)[^>\n]*?\.vcf/gi, "$1Contacto.vcf");

// ── 8 · Placas de carro. Tres letras + tres dígitos, salvo siglas que no son
//        placa. Destino por hash, formato preservado.
const NO_SON_PLACAS = new Set(["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC", "LEY", "CRA", "CLL", "APT"]);
const placas = new Map();
texto = texto.replace(/\b([A-Z]{3})([ -]?)(\d{3})\b/g, (m, letras, sep, digitos) => {
  if (NO_SON_PLACAS.has(letras)) return m;
  const clave = letras + digitos;
  if (!placas.has(clave)) {
    const h = hash(clave);
    const letra = (k) => String.fromCharCode(65 + ((h >>> k) % 26));
    placas.set(clave, `${letra(2)}${letra(7)}${letra(13)}${sep}${((h >>> 4) % 900) + 100}`);
  }
  return placas.get(clave);
});

// ── 9 · La empresa de vigilancia. Dos menciones, y las dos en el hilo del
//        trabajador despedido: con el edificio ya anónimo, el nombre real de la
//        empresa es el último dato que acota a la persona.
texto = texto.replace(/\bservin\b/gi, "SegurAndes");

// ── Verificación, con patrones DISTINTOS a los que limpian (lección 2: una
//    comprobación que comparte el punto ciego no comprueba nada).
const fallos = [];
const sinSep = texto.replace(/[   ().-]/g, "");

// a · Celular vivo, lo haya visto el limpiador O NO: cualquier secuencia de 10
//     dígitos que empiece por 3 y no sea un destino nuestro. No consulta el
//     mapa — un teléfono que ningún patrón capturó también cae aquí.
for (const m of sinSep.matchAll(/(?<!\d)3\d{9}(?!\d)/g)) {
  if (!/^30{7}\d{2}$/.test(m[0])) fallos.push(`celular vivo: …${m[0].slice(-4)}`);
}
// b · Los originales recogidos, buscados literalmente.
for (const clave of telefonos.keys()) {
  const nacional = clave.replace(/^57/, "");
  if (sinSep.includes(nacional)) fallos.push(`teléfono capturado y aun vivo: …${nacional.slice(-4)}`);
}
for (const correo of correos.keys()) {
  if (texto.toLowerCase().includes(correo)) fallos.push(`correo vivo: ${correo}`);
}
for (const m of texto.matchAll(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g)) {
  if (!/@ejemplo\.com$/.test(m[0])) fallos.push(`correo no mapeado: ${m[0]}`);
}
if (/natua/i.test(texto)) fallos.push("nombre del edificio vivo");
if (/15\s*-\s*36/.test((texto.match(/calle\s*110[^\n]{0,25}/gi) ?? []).join(" "))) fallos.push("dirección propia viva");
for (const clave of placas.keys()) {
  if (sinSep.toUpperCase().includes(clave)) fallos.push(`placa viva: ${clave}`);
}
if (/servin/i.test(texto)) fallos.push("vigilancia viva");
for (const m of texto.matchAll(/-([^->\n]*)\.vcf/gi)) {
  if (m[1] !== "Contacto") fallos.push(`vcf con nombre: ${m[1]}`);
}
const lineasDespues = texto.split("\n").length;
if (lineasAntes !== lineasDespues) fallos.push(`recuento de líneas: ${lineasAntes} → ${lineasDespues}`);

// c · Apartamentos: en contexto de vivienda es fallo seco; sueltos se listan
//     para revisión a ojo, porque un «501» suelto puede ser un importe.
for (const num of conocidos) {
  const re = new RegExp(
    `(?:apto|apt|apartamento|torre)\\.?\\s*\\d?\\s*[,.]?\\s*${num}\\b|\\b${num}\\s*[-–]?\\s*[Tt](?:orre)?\\s*\\d\\b`,
    "gi",
  );
  if (re.test(texto)) fallos.push(`apartamento en contexto vivo: ${num}`);
}
const sueltosVivos = [...conocidos].filter((n) => new RegExp(`(?<!\\d)${n}(?!\\d)`).test(texto));

writeFileSync(salida, texto);
console.log(`Líneas: ${lineasAntes} → ${lineasDespues}`);
console.log(`Correos: ${correos.size} · Teléfonos: ${telefonos.size} · Aptos: ${aptos.size} · Placas: ${placas.size}`);
if (sueltosVivos.length) console.log(`Números de apto que aún aparecen SUELTOS (revisar a ojo): ${sueltosVivos.join(" ")}`);
if (fallos.length) {
  console.error(`\nFALLOS (${fallos.length}):`);
  for (const f of fallos) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("\nVerificación en limpio.");
