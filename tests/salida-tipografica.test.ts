import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **La puerta que hace posible cambiar la tipografía del admin (pasada 0).**
 *
 * El portal de administración tiene dos reglas que, juntas, SON su aspecto
 * plano: `.admin-shell *` fuerza Manrope con el **único `!important`** del
 * fichero, y otra aplana a peso 500 todos los títulos y negritas.
 *
 * No se retiran: hacerlo repinta diecinueve pantallas de golpe, y eso es una
 * decisión de producto. Lo que hacía falta era una **salida por la que se pueda
 * optar**, porque sin ella poner la tipografía de marca en la cabecera
 * compilaba, pasaba las pruebas, se desplegaba **y no movía un píxel** — un
 * no-op con aspecto de hito, que es el defecto más caro de todos porque nadie
 * lo busca.
 *
 * Lo delicado, y por eso existe esta prueba: **la fuente gana por especificidad
 * y el peso gana por ORDEN**. Mover el bloque de la salida más arriba lo
 * desactiva a medias —la letra cambiaría y el grosor no— sin que nada falle.
 */

const RAIZ = process.cwd();
const css = fs.readFileSync(path.resolve(RAIZ, "src/app/globals.css"), "utf8");

/** Posición de un selector en el fichero, o -1. */
function pos(selector: string): number {
  return css.indexOf(selector);
}

const FUERZA_FUENTE = ".admin-shell * {";
const APLANA_PESO = ".admin-shell h1,";
const PUERTA_FUENTE = ".admin-shell .font-display,";
const PUERTA_PESO = ".admin-shell .font-display {";

describe("1 · las dos reglas del aspecto plano siguen ahí", () => {
  it("la que fuerza Manrope, con su `!important`", () => {
    // Si alguien la retira, el aspecto del admin cambia entero y esta prueba
    // deja de tener sentido — mejor que enrojezca y se decida a propósito.
    expect(pos(FUERZA_FUENTE)).toBeGreaterThan(-1);
    const bloque = css.slice(pos(FUERZA_FUENTE), pos(FUERZA_FUENTE) + 120);
    expect(bloque).toContain("!important");
  });

  it("y la que aplana el peso a 500", () => {
    expect(pos(APLANA_PESO)).toBeGreaterThan(-1);
    const bloque = css.slice(pos(APLANA_PESO), pos(APLANA_PESO) + 260);
    expect(bloque).toContain("font-weight: 500");
  });

  it("solo hay DOS `!important` en el CÓDIGO: el que fuerza y el que libera", () => {
    /**
     * Dos `!important` peleando es el principio de que nadie entienda por qué
     * algo no se pinta. Había uno; la puerta añade el suyo. Si aparece un
     * tercero, hay que mirarlo a propósito.
     *
     * **Se cuenta solo el CÓDIGO.** La primera versión contaba el fichero
     * entero y daba cinco, porque el comentario que explica la puerta menciona
     * `!important` cuatro veces. Un guardián que cuenta su propia prosa se
     * dispara solo — la misma trampa que resuelve `soloCodigo` en
     * `clave-de-unidad-guarda.test.ts`.
     */
    const soloCodigo = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join("\n");
    const cuantos = (soloCodigo.match(/!important/g) ?? []).length;
    expect(cuantos, `hay ${cuantos} !important en el código de globals.css`).toBe(2);
  });
});

describe("2 · la puerta existe y está en el sitio correcto", () => {
  it("libera la fuente para quien pida `font-display`", () => {
    expect(pos(PUERTA_FUENTE)).toBeGreaterThan(-1);
    const bloque = css.slice(pos(PUERTA_FUENTE), pos(PUERTA_FUENTE) + 180);
    expect(bloque).toContain("--font-playfair");
    // Sin `!important` no le gana al `!important` de arriba, por mucha
    // especificidad que tenga.
    expect(bloque).toContain("!important");
  });

  it("y libera también el peso", () => {
    expect(pos(PUERTA_PESO)).toBeGreaterThan(-1);
    const bloque = css.slice(pos(PUERTA_PESO), pos(PUERTA_PESO) + 90);
    expect(bloque).toMatch(/font-weight:\s*6\d\d/);
  });

  it("**va DESPUÉS de las dos reglas que libera**", () => {
    /**
     * `.admin-shell h1` y `.admin-shell .font-display` tienen la MISMA
     * especificidad (0,2,0), así que el peso lo decide el orden de aparición.
     * Subir este bloque lo desactiva a medias y en silencio: cambiaría la letra
     * —esa gana por especificidad— pero no el grosor.
     */
    expect(pos(PUERTA_FUENTE)).toBeGreaterThan(pos(FUERZA_FUENTE));
    expect(pos(PUERTA_PESO)).toBeGreaterThan(pos(APLANA_PESO));
  });

  it("cubre también los hijos del elemento que la pide", () => {
    // Un `h1` con un `<span>` dentro: sin esto, el span vuelve a Manrope por
    // `.admin-shell *` y el título sale con dos tipografías.
    expect(css).toContain(".admin-shell .font-display *");
  });
});
