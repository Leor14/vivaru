// Cuenta los temas de PQRS en los corpus vecinales anonimizados, con el mismo
// tamiz para todos.
//
// POR QUÉ EXISTE: la tabla de temas del análisis mexicano (12 de agosto de
// 2026, `datasets/chat-vecinal/analisis.md`) se hizo con patrones que no se
// guardaron. Para construir la taxonomía de PQRS con evidencia de dos países
// hace falta contar los temas de Ecuador, y contarlos con reglas escritas de
// nuevo haría imposible atribuir las diferencias: ¿el país, o el tamiz? Mismo
// motivo por el que existe `analizar-corpus-vecinal.mjs`, en el otro eje.
//
// AVISO — no mezclar series: estos números NO son los de la tabla de
// `analisis.md`. Aquel tamiz no se conservó; este es otro. Sirven para comparar
// países entre sí y ordenar por magnitud, no para citar junto a los de aquel
// documento.
//
// Uso:
//   node scripts/analizar-temas-pqrs.mjs datasets/chat-vecinal/chat-anonimizado.txt datasets/chat-vecinal-ecuador/chat-anonimizado.txt
//
// Solo lee. No modifica ningún corpus.

import { readFileSync } from "node:fs";
import { parsear, norm } from "./lib/whatsapp.mjs";

/**
 * Vocabulario de los TRES mercados a propósito: «pipa» es mexicano y «tanquero»
 * ecuatoriano, «cuota» convive con «alícuota» y «expensa», «alberca» con
 * «piscina», «estacionamiento» con «parqueadero». Un detector con vocabulario
 * de un solo país haría parecer que en el otro no se habla del tema.
 *
 * «mantenimiento» a secas se cuenta en obra_mantenimiento SABIENDO que en
 * México también nombra la cuota mensual («pago de mantenimiento»). El solape
 * es real y va en las dos direcciones; el conteo es para ordenar por magnitud,
 * no para separar con bisturí — la misma advertencia que dejó escrita el
 * análisis mexicano.
 */
const TEMAS = {
  agua: /\b(aguas?|fugas?|filtracion(es)?|humedad(es)?|goteras?|goteos?|presion|bombas?|cisternas?|tinacos?|pipas?|tanqueros?|hidroneumatico|inundacion(es)?|drenaje|tuberias?)\b/,
  cuotas_pagos: /\b(cuotas?|alicuotas?|expensas?|mensualidad(es)?|adeudos?|morosos?|morosidad|recargos?|comprobantes?|transferencias?|depositos?|pagos?|pagar|pague|cobros?|estado de cuenta|facturas?)\b/,
  asamblea_administracion: /\b(asambleas?|reunion(es)?|comite|administracion|administradora?|actas?|votacion(es)?|votar|convocatorias?|directivas?|consejo|quorum)\b/,
  obra_mantenimiento: /\b(obras?|reparacion(es)?|reparar|impermeabiliza\w*|pinturas?|pintar|albanil\w*|herrer\w*|refaccion(es)?|mantenimientos?|fachadas?|azoteas?|techos?|grietas?|plomeros?|plomeria)\b/,
  elevadores: /\b(elevador(es)?|ascensor(es)?)\b/,
  seguridad_porteria: /\b(seguridad|guardias?|vigilan\w*|casetas?|garitas?|porterias?|conserjes?|guardiania|paquetes?|paqueteria|robos?|robar\w*|camaras?|intrusos?)\b/,
  luz_electricidad: /\b(luz|energia|electric\w*|apagon(es)?|cfe|cortocircuitos?|focos?|lamparas?|medidor(es)?|transformador(es)?)\b/,
  convivencia_ruido: /\b(ruidos?|fiestas?|musica|volumen|escandalos?|mascotas?|perros?|gatos?|convivencia|molestias?|claxon)\b/,
  amenidades: /\b(albercas?|piscinas?|gimnasios?|salon (de eventos|comunal|de usos)|amenidad(es)?|palapas?|asador(es)?|terrazas?|juegos infantiles|areas? verdes?)\b/,
  accesos_estacionamiento: /\b(porton(es)?|pluma|estacionamientos?|parqueaderos?|cajon(es)?|cocheras?|control de acceso|zaguan|acceso vehicular)\b/,
  limpieza_basura: /\b(limpiezas?|basuras?|desechos|escombros?|reciclaje|fumigacion(es)?|plagas?|cucarachas?|ratas?)\b/,
};

/** Adjuntos: el export los deja como marcador, no como texto. */
const SIN_TEXTO = /\b(imagen omitida|video omitido|documento omitido|audio omitido|sticker omitido|gif omitido|multimedia omitido|tarjeta de contacto omitida|se elimino este mensaje|eliminaste este mensaje)\b/;

function analizar(ruta, etiqueta) {
  const mensajes = parsear(readFileSync(ruta, "utf8"));

  // La administración se reconoce por el nombre del remitente en los dos
  // corpus («Rodrigo Administración», «Paola Salazar Administradora»). El
  // nombre del grupo mexicano también contiene «administración» y captura las
  // líneas de sistema — excluirlas de los mensajes de residentes es correcto.
  const esAdmin = (autor) => norm(autor).includes("administra");

  const residentes = mensajes.filter((m) => !esAdmin(m.autor));
  const conTexto = residentes.filter((m) => {
    const t = norm(m.texto);
    return t.trim().length > 0 && !SIN_TEXTO.test(t);
  });

  const esPregunta = (t) => /[?¿]/.test(t);
  const preguntas = conTexto.filter((m) => esPregunta(m.texto));
  const largos = conTexto.filter((m) => m.texto.length > 190);
  const preguntasCortas = preguntas.filter((m) => m.texto.length < 80);

  const conteo = {};
  for (const tema of Object.keys(TEMAS)) conteo[tema] = { total: 0, largos: 0, preguntas: 0 };
  let multiTema = 0;

  for (const m of conTexto) {
    const t = norm(m.texto);
    let temas = 0;
    for (const [tema, re] of Object.entries(TEMAS)) {
      if (re.test(t)) {
        temas += 1;
        conteo[tema].total += 1;
        if (m.texto.length > 190) conteo[tema].largos += 1;
        if (esPregunta(m.texto)) conteo[tema].preguntas += 1;
      }
    }
    if (temas >= 3) multiTema += 1;
  }

  return {
    etiqueta,
    mensajes: mensajes.length,
    residentes: residentes.length,
    conTexto: conTexto.length,
    preguntas: preguntas.length,
    preguntasCortas: preguntasCortas.length,
    largos: largos.length,
    multiTema,
    conteo,
  };
}

function imprimir(r) {
  console.log(`\n${"═".repeat(64)}`);
  console.log(r.etiqueta);
  console.log(`${"═".repeat(64)}`);
  console.log(`  mensajes ........................ ${r.mensajes}`);
  console.log(`  de residentes ................... ${r.residentes}`);
  console.log(`  con texto aprovechable .......... ${r.conTexto}`);
  console.log(`  preguntas ....................... ${r.preguntas}`);
  console.log(`  preguntas cortas (<80c) ......... ${r.preguntasCortas}`);
  console.log(`  largos (>190c) .................. ${r.largos}`);
  console.log(`  con 3 temas o más ............... ${r.multiTema}\n`);
  console.log(`  ${"tema".padEnd(26)} ${"total".padStart(6)} ${"largos".padStart(7)} ${"pregunta".padStart(9)}`);
  const orden = Object.entries(r.conteo).sort((a, b) => b[1].total - a[1].total);
  for (const [tema, c] of orden) {
    console.log(`  ${tema.padEnd(26)} ${String(c.total).padStart(6)} ${String(c.largos).padStart(7)} ${String(c.preguntas).padStart(9)}`);
  }
}

const rutas = process.argv.slice(2);
if (rutas.length === 0) {
  console.error("Uso: node scripts/analizar-temas-pqrs.mjs <archivo.txt> [otro.txt]");
  process.exit(1);
}

const resultados = rutas.map((ruta) =>
  analizar(ruta, ruta.includes("ecuador") ? "ECUADOR" : ruta.includes("chat-vecinal") ? "MÉXICO" : ruta),
);
resultados.forEach(imprimir);

if (resultados.length > 1) {
  console.log(`\n${"═".repeat(64)}`);
  console.log("COMPARACIÓN — % de mensajes de residentes con texto");
  console.log(`${"═".repeat(64)}`);
  console.log(`  ${"".padEnd(26)} ${resultados.map((r) => r.etiqueta.padStart(10)).join("")}`);
  const temasOrdenados = Object.keys(TEMAS).sort(
    (a, b) => resultados[0].conteo[b].total - resultados[0].conteo[a].total,
  );
  for (const tema of temasOrdenados) {
    const fila = resultados
      .map((r) => `${((r.conteo[tema].total / Math.max(1, r.conTexto)) * 100).toFixed(1)}%`.padStart(10))
      .join("");
    console.log(`  ${tema.padEnd(26)} ${fila}`);
  }
}
console.log();
