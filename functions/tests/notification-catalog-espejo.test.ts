import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { NOTIFICATION_CATALOG } from "../src/notification-catalog";

/**
 * **El catálogo de avisos vive DUPLICADO, y hasta hoy nada vigilaba las copias.**
 *
 * `functions/src/notification-catalog.ts` es lo que se ENVÍA;
 * `src/features/notifications/catalog.ts` es lo que el administrador EDITA en
 * Perfil del edificio. Su cabecera dice desde siempre «las cadenas deben
 * mantenerse en sincronía» — y era una frase, no un guardián: se podía cambiar
 * el texto de un lado y dejar el otro con la versión vieja sin que nada fallara.
 * El síntoma sería el peor de todos: el editor enseñando una plantilla que no es
 * la que sale por correo.
 *
 * Se descubrió al construir CA13, que toca los dos.
 *
 * **Se compara como TEXTO, no importando.** `functions/` y `src/` no pueden
 * importarse mutuamente —rompe el build de App Hosting, ver CLAUDE.md—, así que
 * se lee el fichero y se extraen las cadenas. Es el mismo guardián que ya
 * protegen `esRecaudoDeCartera` y `computeBalanceStatus`; leer un fichero no es
 * importarlo.
 */

const CAMPOS = ["title", "body", "emailSubject", "emailBody"] as const;
type Campo = (typeof CAMPOS)[number];

/**
 * Recorre el fichero de arriba abajo: cada vez que ve una clave abre una entrada
 * nueva, y cada cadena que encuentra después pertenece a esa entrada. Sirve para
 * los dos ficheros aunque uno sea un `Record` y el otro un array, porque lo que
 * cambia es solo cómo se marca la clave.
 */
function extraer(fuente: string, marcaDeClave: RegExp): Map<string, Partial<Record<Campo, string>>> {
  const campos = CAMPOS.join("|");
  const combinado = new RegExp(`${marcaDeClave.source}|^\\s*(${campos}): "((?:[^"\\\\]|\\\\.)*)",?$`, "gm");

  const salida = new Map<string, Partial<Record<Campo, string>>>();
  let actual: Partial<Record<Campo, string>> | undefined;

  for (const m of fuente.matchAll(combinado)) {
    if (m[1]) {
      actual = {};
      salida.set(m[1], actual);
    } else if (actual && m[2]) {
      actual[m[2] as Campo] = m[3];
    }
  }
  return salida;
}

const rutaEspejo = path.resolve(__dirname, "../../src/features/notifications/catalog.ts");
const espejo = extraer(fs.readFileSync(rutaEspejo, "utf8"), /^ {4}key: "(\w+)",$/);
const propio = extraer(
  fs.readFileSync(path.resolve(__dirname, "../src/notification-catalog.ts"), "utf8"),
  /^ {2}(\w+): \{$/,
);

describe("el catálogo de avisos y su espejo del front dicen lo mismo", () => {
  const claves = Object.keys(NOTIFICATION_CATALOG);

  // Si esto falla es que el parser dejó de entender el fichero, no que los
  // catálogos difieran. Sin esta prueba, un cambio de formato convertiría el
  // guardián en un `expect` sobre dos mapas vacíos: verde y sin vigilar nada.
  it("el parser encuentra las mismas claves en los dos ficheros", () => {
    expect(claves.length).toBeGreaterThan(0);
    expect([...propio.keys()].sort()).toEqual(claves.slice().sort());
    expect([...espejo.keys()].sort()).toEqual(claves.slice().sort());
  });

  it.each(claves)("«%s» tiene los cuatro textos idénticos en los dos", (clave) => {
    const a = propio.get(clave);
    const b = espejo.get(clave);
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    for (const campo of CAMPOS) {
      expect(b?.[campo], `${clave}.${campo} difiere entre functions/ y src/`).toBe(a?.[campo]);
    }
  });
});

describe("CA13 · las dos variables nuevas están en los dos catálogos", () => {
  const fuenteEspejo = fs.readFileSync(rutaEspejo, "utf8");

  it("el aviso del recibo nombra los cargos y el saldo a favor", () => {
    const t = NOTIFICATION_CATALOG.billing_receipt;
    expect(t.body).toContain("{cargos}");
    expect(t.body).toContain("{saldoAFavor}");
    expect(t.emailBody).toContain("{cargos}");
    expect(t.emailBody).toContain("{saldoAFavor}");
  });

  it("y las declara, para que el editor de copys las ofrezca", () => {
    const nombres = NOTIFICATION_CATALOG.billing_receipt.variables.map((v) => v.name);
    expect(nombres).toContain("cargos");
    expect(nombres).toContain("saldoAFavor");
    expect(fuenteEspejo).toContain('name: "cargos"');
    expect(fuenteEspejo).toContain('name: "saldoAFavor"');
  });
});
