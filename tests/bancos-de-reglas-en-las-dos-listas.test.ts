import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **Todo banco de reglas tiene que estar en las DOS listas.**
 *
 * Un `*.rules.test.ts` necesita el emulador. Va en el `include` de
 * `vitest.rules.config.ts` para poder correr, **y** en el `exclude` de
 * `vitest.config.ts` para no entrar en `npm test`. Faltar en la segunda pone
 * ROJO el banco entero en cualquier máquina sin emulador — y **un rojo que no es
 * del código enseña a ignorar el color**.
 *
 * Ha pasado tres veces: `push-tokens.rules.test.ts`, `informe-mensual.rules.test.ts`
 * y `rol-consejo.rules.test.ts` el 9 de septiembre de 2026. Las tres con un
 * comentario en `vitest.config.ts` avisando exactamente de esto, **tres líneas
 * más arriba**. La tercera no la cazó leerlo: la cazó que `npm test` saltara de
 * 1789 a 1804 sin haber añadido una prueba a la app.
 *
 * Por eso este guardián **mide el disco**, no una lista escrita a mano: se entera
 * del banco nuevo sin que nadie venga a apuntarlo aquí. Un guardián que hay que
 * actualizar a mano falla el día que alguien olvida actualizarlo, que es
 * exactamente el día que hacía falta.
 */

const raiz = path.resolve(__dirname, "..");
const leer = (f: string) => fs.readFileSync(path.join(raiz, f), "utf8");

const bancosDeReglas = fs
  .readdirSync(path.join(raiz, "tests"))
  .filter((f) => f.endsWith(".rules.test.ts"))
  .sort();

describe("los bancos de reglas están en las dos listas", () => {
  it("hay bancos de reglas que vigilar — si esto falla, el guardián mide la nada", () => {
    // El control del propio medidor: sobre una carpeta vacía todas las
    // comprobaciones de abajo pasarían solas.
    expect(bancosDeReglas.length).toBeGreaterThan(0);
  });

  it.each(bancosDeReglas)("`%s` está en el `include` de vitest.rules.config.ts", (fichero) => {
    expect(leer("vitest.rules.config.ts")).toContain(`tests/${fichero}`);
  });

  it.each(bancosDeReglas)("`%s` está en el `exclude` de vitest.config.ts", (fichero) => {
    // El patrón real lleva `**/` delante; se comprueba el nombre, que es lo que
    // identifica al fichero en cualquiera de las dos formas.
    expect(leer("vitest.config.ts")).toContain(fichero);
  });
});
