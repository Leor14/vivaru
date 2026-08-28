import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **El portal de administracion ya no aplana la tipografia.**
 *
 * Hasta el 27 de agosto de 2026 vivian aqui dos reglas que, juntas, ERAN su
 * aspecto plano: una forzaba Manrope con `!important` sobre `.admin-shell *`, y
 * otra fijaba `font-weight: 500` sobre `.font-semibold`, `.font-bold`, h1..h6,
 * `strong` y `b`. La segunda no tocaba solo los titulos: aplanaba TODO el
 * enfasis del portal. Medido antes de retirarlas: 54 elementos en el Panel de
 * Control, 29 en Cartera y 12 en Residentes pedian seminegrita y no la recibian.
 *
 * Este fichero guardaba lo contrario —que las dos reglas SIGUIERAN ahi—, y su
 * premisa caduco con la decision. Ahora guarda que no vuelvan, y sobre todo que
 * no vuelvan DISFRAZADAS: el modo de fallo real no es que alguien reescriba
 * aquellas dos lineas, es que se declare una regla sin capa que vuelva a ganarle
 * a las utilidades.
 */

const RAIZ = process.cwd();
const CSS = fs.readFileSync(path.resolve(RAIZ, "src/app/globals.css"), "utf8");

/** Sin comentarios: la prosa de arriba nombra las reglas que este fichero veta. */
const CODIGO = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** Todas las reglas cuyo selector menciona `.admin-shell`. */
function reglasDelShell(): { selector: string; cuerpo: string }[] {
  const salida: { selector: string; cuerpo: string }[] = [];
  for (const m of CODIGO.matchAll(/([^{}]*\.admin-shell[^{}]*)\{([^{}]*)\}/g)) {
    salida.push({ selector: m[1].trim(), cuerpo: m[2].trim() });
  }
  return salida;
}

describe("1 · las reglas del aspecto plano no vuelven", () => {
  it("nada fuerza la fuente del admin con `!important`", () => {
    const culpables = reglasDelShell().filter(
      (r) => /font-family/.test(r.cuerpo) && /!important/.test(r.cuerpo),
    );
    expect(culpables.map((c) => c.selector), "la guerra de !important se acabo").toEqual([]);
  });

  it("no queda NINGUN `!important` en el codigo de globals.css", () => {
    const cuantos = (CODIGO.match(/!important/g) ?? []).length;
    expect(cuantos, `hay ${cuantos} !important en el codigo`).toBe(0);
  });

  it("nada vuelve a aplanar el enfasis del portal", () => {
    const culpables = reglasDelShell().filter(
      (r) =>
        /font-(semibold|bold)|(^|,)\s*\.admin-shell\s+(strong|b)\b/.test(r.selector) &&
        /font-weight/.test(r.cuerpo),
    );
    expect(
      culpables.map((c) => c.selector),
      "una regla que fije el peso de `.font-semibold`/`.font-bold`/`strong` es el aspecto plano otra vez",
    ).toEqual([]);
  });
});

describe("2 · el suelo de los encabezados no es una carcel nueva", () => {
  /**
   * La preflight de Tailwind pone `font-weight: inherit` en h1..h6, asi que sin
   * suelo un encabezado sin clase caeria a 400 —mas ligero que cuando estaba
   * aplanado a 500—. Se midio que hoy no hay ninguno, pero el suelo cuesta una
   * linea y cubre lo que no se midio.
   */
  it("existe un suelo de peso para los encabezados", () => {
    expect(CODIGO).toMatch(/\.admin-shell :where\(h1[^)]*\)\s*\{[^}]*font-weight:\s*600/);
  });

  /**
   * **La afirmacion que de verdad importa.** Sin capa, el suelo seria (0,1,0) y
   * el CSS sin capa le gana a `@layer utilities` pase lo que pase: volveria a
   * gomarse un `font-semibold`, que es exactamente la carcel que acabamos de
   * quitar. En `@layer base` pierde contra cualquier utilidad, que es lo que se
   * quiere.
   */
  it("y vive en `@layer base`, o seria la misma carcel con otro nombre", () => {
    const i = CODIGO.search(/\.admin-shell :where\(h1/);
    expect(i).toBeGreaterThan(-1);
    const antes = CODIGO.slice(0, i);
    const capaAbierta = antes.lastIndexOf("@layer base");
    const capaCerrada = antes.lastIndexOf("\n}");
    expect(
      capaAbierta > -1 && capaAbierta > capaCerrada - antes.length,
      "el suelo tiene que estar dentro de `@layer base`",
    ).toBe(true);
    expect(antes.slice(capaAbierta)).toMatch(/@layer base\s*\{[^}]*$/);
  });
});

describe("3 · la fuente de marca se pide y se obtiene", () => {
  it("`font-display` lleva su peso propio", () => {
    // `.text-display` es una clase sin capa que fija 500. Sin esta regla, el
    // nombre de la pantalla se pintaria en Playfair 500 en vez de 600.
    const regla = reglasDelShell().find((r) => /\.font-display/.test(r.selector));
    expect(regla, "no se encontro la regla de peso de font-display").toBeDefined();
    expect(regla!.cuerpo).toMatch(/font-weight:\s*600/);
  });

  it("y ya no necesita ninguna puerta con `!important`", () => {
    expect(CODIGO).not.toMatch(/\.font-display[^{]*\{[^}]*!important/);
  });
});
