// Extrae mensajes candidatos de los corpus vecinales para etiquetarlos como
// casos de PQRS.
//
// POR QUÉ EXISTE: la taxonomía y el gold set citan mensajes reales. Elegirlos a
// ojo, leyendo el archivo, produce dos problemas: no se puede repetir la
// selección, y no hay forma de comprobar que el ejemplo citado es uno de los
// que las cifras contaron. Este script usa el MISMO vocabulario que
// `analizar-temas-pqrs.mjs` (`lib/temas-pqrs.mjs`) y da a cada mensaje un
// identificador estable.
//
// EL IDENTIFICADOR es `MX#<n>` o `EC#<n>`, donde n es la posición del mensaje
// en el archivo parseado. Es determinista mientras el corpus no cambie, y
// permite volver del gold set al mensaje original.
//
// Uso:
//   node scripts/muestrear-corpus-pqrs.mjs <archivo.txt> [--tema agua] [--n 20]
//                                          [--min 60] [--max 600] [--preguntas]
//                                          [--id MX#1234]
//
// Solo lee. No modifica ningún corpus.

import { readFileSync } from "node:fs";
import { parsear, norm } from "./lib/whatsapp.mjs";
import { TEMAS, SIN_TEXTO, SISTEMA, esAdmin, ANUNCIA } from "./lib/temas-pqrs.mjs";

function arg(nombre, porDefecto) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : porDefecto;
}
const bandera = (nombre) => process.argv.includes(`--${nombre}`);

const rutas = process.argv.slice(2).filter((a) => !a.startsWith("--") && a.endsWith(".txt"));
if (rutas.length === 0) {
  console.error("Uso: node scripts/muestrear-corpus-pqrs.mjs <archivo.txt> [--tema X] [--n 20]");
  process.exit(1);
}

const temaPedido = arg("tema", null);
const idPedido = arg("id", null);
const n = Number(arg("n", 15));
const min = Number(arg("min", 60));
const max = Number(arg("max", 700));
const soloPreguntas = bandera("preguntas");
const incluirAvisos = bandera("incluir-avisos");

if (temaPedido && !TEMAS[temaPedido]) {
  console.error(`Tema desconocido: ${temaPedido}`);
  console.error(`Disponibles: ${Object.keys(TEMAS).join(", ")}`);
  process.exit(1);
}

for (const ruta of rutas) {
  const pais = ruta.includes("ecuador") ? "EC" : "MX";
  const mensajes = parsear(readFileSync(ruta, "utf8"));

  const candidatos = [];
  mensajes.forEach((m, indice) => {
    const id = `${pais}#${indice}`;
    if (idPedido) {
      // Modo «enséñame este mensaje con su contexto»: sirve para resolver las
      // preguntas cortas, que son inclasificables sin los mensajes anteriores.
      if (id !== idPedido) return;
      const desde = Math.max(0, indice - 3);
      console.log(`\n${"═".repeat(70)}\n${id} — con los 3 mensajes anteriores\n${"═".repeat(70)}`);
      for (let i = desde; i <= indice; i++) {
        const marca = i === indice ? "▶" : " ";
        const quien = esAdmin(mensajes[i].autor, norm) ? "[ADMIN]" : "[vecino]";
        console.log(`${marca} ${`${pais}#${i}`.padEnd(9)} ${quien} ${mensajes[i].texto.replace(/\n/g, " ⏎ ")}`);
      }
      return;
    }

    if (esAdmin(m.autor, norm)) return;
    const t = norm(m.texto);
    if (!t.trim() || SIN_TEXTO.test(t) || SISTEMA.test(t)) return;
    if (m.texto.length < min || m.texto.length > max) return;
    if (soloPreguntas && !/[?¿]/.test(m.texto)) return;
    // Un aviso del comité es la salida del administrador, no la entrada de un
    // residente. Ver el comentario de ANUNCIA en lib/temas-pqrs.mjs.
    if (!incluirAvisos && ANUNCIA.test(t)) return;

    const temas = Object.entries(TEMAS).filter(([, re]) => re.test(t)).map(([k]) => k);
    if (temaPedido && !temas.includes(temaPedido)) return;
    if (!temaPedido && temas.length === 0) return;

    candidatos.push({ id, fecha: m.fecha, temas, texto: m.texto });
  });

  if (idPedido) continue;

  console.log(`\n${"═".repeat(70)}`);
  console.log(`${pais} — ${candidatos.length} candidatos${temaPedido ? ` en «${temaPedido}»` : ""}${soloPreguntas ? ", solo preguntas" : ""}`);
  console.log(`${"═".repeat(70)}`);

  // Muestreo por paso fijo, no aleatorio: da la misma muestra en cada corrida
  // (Math.random haría irrepetible la selección que cita la taxonomía) y
  // recorre todo el periodo en vez de amontonarse al principio.
  const paso = Math.max(1, Math.floor(candidatos.length / n));
  for (let i = 0; i < candidatos.length && i / paso < n; i += paso) {
    const c = candidatos[i];
    console.log(`\n${c.id}  ${c.fecha}  [${c.temas.join(" ")}]`);
    console.log(`  ${c.texto.replace(/\n/g, "\n  ")}`);
  }
}
console.log();
