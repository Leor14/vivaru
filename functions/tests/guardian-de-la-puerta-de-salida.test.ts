import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `PRD-V-PLAT-006` · **el guardián que sostiene la puerta de salida.**
 *
 * La puerta de `email.ts` solo filtra cuando sabe de qué conjunto es el envío. Eso la hace
 * correcta con el correo interno de Vivaru —cuatro de los ocho envíos van a `notifyInbox`,
 * `supportInbox` o comercial, y filtrarlos cortaría los avisos de trial— y **la deja esquivable
 * por olvido**: un envío nuevo a una persona que no pase `tenantId` sale sin pasar por nada.
 *
 * Un `if` no puede vigilar eso, porque el olvido ocurre en el llamador. Lo vigila esto: cada
 * llamada a los dos emisores tiene que declarar de qué lado está. Es el patrón de
 * `facturado-una-sola-formula.test.ts`, que barre el código en vez de fiarse de una lista escrita
 * a mano — la lista envejece y el barrido no.
 *
 * **Y trae su propio control** (el último caso): si la expresión que busca las llamadas dejara de
 * encontrarlas, este fichero pasaría en verde vigilando un conjunto vacío. Ya pasó dos veces —
 * `UX-004` el 30 de agosto y el guardián del facturado el 2 de septiembre.
 */

const SRC = join(__dirname, "..", "src");

/** Los destinatarios que son bandejas de VIVARU, no personas de un conjunto. */
const BANDEJAS_DE_VIVARU = ["notifyInbox()", "supportInbox()", "@qintilab.com"];

function ficherosTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? ficherosTs(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : [],
  );
}

type Llamada = { fichero: string; linea: number; texto: string };

/** Cada llamada a los emisores, con su bloque de argumentos hasta el cierre. */
function llamadasAEmisores(): Llamada[] {
  const encontradas: Llamada[] = [];
  for (const ruta of ficherosTs(SRC)) {
    // `email.ts` los DEFINE; sus menciones no son llamadas.
    if (ruta.endsWith("email.ts")) continue;
    const lineas = readFileSync(ruta, "utf8").split("\n");
    lineas.forEach((linea, i) => {
      if (!/\bsend(Notification|Account)Email\(/.test(linea)) return;
      // El bloque de argumentos: hasta la línea que cierra la llamada.
      const trozo: string[] = [];
      for (let j = i; j < Math.min(i + 20, lineas.length); j++) {
        trozo.push(lineas[j]);
        if (/^\s*\}?\);\s*$/.test(lineas[j]) || /\);\s*$/.test(lineas[j])) break;
      }
      encontradas.push({ fichero: ruta.replace(SRC, "src"), linea: i + 1, texto: trozo.join("\n") });
    });
  }
  return encontradas;
}

describe("PLAT-006 · ningún envío a una persona esquiva la puerta de salida", () => {
  const llamadas = llamadasAEmisores();

  it("cada llamada, o pasa el conjunto, o va a una bandeja de Vivaru", () => {
    const huerfanas = llamadas.filter((l) => {
      const pasaConjunto = /\btenantId\s*[,:}]/.test(l.texto) || /\bcontexto\s*:/.test(l.texto);
      const esInterna = BANDEJAS_DE_VIVARU.some((b) => l.texto.includes(b));
      return !pasaConjunto && !esInterna;
    });

    expect(
      huerfanas.map((l) => `${l.fichero}:${l.linea}`),
      "Estos envíos no dicen de qué conjunto son ni van a una bandeja de Vivaru, así que salen sin " +
        "pasar por la puerta de PLAT-006. Pasa `tenantId` si va a una persona de un conjunto.",
    ).toEqual([]);
  });

  // ── El control. Sin esto, lo de arriba puede estar vigilando NADA. ────────
  it("CONTROL · el barrido encuentra de verdad las llamadas que dice vigilar", () => {
    // Medido el 2 sep 2026: seis de `sendNotificationEmail` y dos de `sendAccountEmail`,
    // repartidas en cuatro ficheros. Si esto baja, la expresión dejó de cazar y el
    // caso de arriba pasaría en verde sobre un conjunto vacío.
    expect(llamadas.length).toBeGreaterThanOrEqual(8);
    const ficheros = new Set(llamadas.map((l) => l.fichero));
    expect(ficheros.size).toBeGreaterThanOrEqual(4);
  });

  it("CONTROL · y distingue: al menos una interna y al menos una que pasa el conjunto", () => {
    // Si TODAS cayeran del mismo lado, el caso principal se cumpliría solo. Es la
    // trampa de la escala constante que pasa cualquier prueba de monotonía.
    const internas = llamadas.filter((l) => BANDEJAS_DE_VIVARU.some((b) => l.texto.includes(b)));
    const conConjunto = llamadas.filter((l) => /\btenantId\s*[,:}]/.test(l.texto) || /\bcontexto\s*:/.test(l.texto));
    expect(internas.length).toBeGreaterThan(0);
    expect(conConjunto.length).toBeGreaterThan(0);
  });
});
