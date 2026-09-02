import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DOMINIOS_INERTES } from "../src/buzones-admisibles";

/**
 * `PRD-V-PLAT-006` §11 · **el catálogo de dominios inertes vive en tres sitios y no pueden
 * divergir.**
 *
 * La copia canónica es `src/buzones-admisibles.ts`. Las otras dos están en `functions/scripts/`
 * porque esos scripts corren con Node suelto y no importan de `src`. No es un capricho: el mapa de
 * tipos de ticket llegó a tener **cinco** copias —dos en el mismo fichero— y el defecto lo destapó
 * un guardián, no una lectura.
 *
 * Se compara **como texto**, que es lo único que se puede hacer entre un `.ts` y un `.mjs` que no
 * se pueden importar el uno al otro. Mismo patrón que `notification-catalog-espejo.test.ts`.
 */

const SCRIPTS = join(__dirname, "..", "scripts");

/** Saca la lista de un literal `[...]` del fichero, por el nombre de su constante. */
function listaDelFichero(ruta: string, constante: string): string[] {
  const texto = readFileSync(ruta, "utf8");
  const m = new RegExp(`${constante}\\s*=\\s*\\[([^\\]]*)\\]`).exec(texto);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

describe("PLAT-006 · el catálogo de dominios inertes no diverge entre sus copias", () => {
  it("la copia del informe en seco dice lo mismo que la canónica", () => {
    const delScript = listaDelFichero(
      join(SCRIPTS, "informe-correos-en-conjuntos-de-ejemplo.mjs"),
      "DOMINIOS_INERTES",
    );
    expect(delScript).toEqual([...DOMINIOS_INERTES]);
  });

  it("CONTROL · el extractor encuentra la lista de verdad, no una vacía", () => {
    // Sin esto, un cambio de nombre de la constante haría que el caso de arriba
    // comparase `[]` con `[]` y pasara en verde vigilando nada.
    const delScript = listaDelFichero(
      join(SCRIPTS, "informe-correos-en-conjuntos-de-ejemplo.mjs"),
      "DOMINIOS_INERTES",
    );
    expect(delScript.length).toBeGreaterThanOrEqual(4);
    expect(delScript).toContain("ejemplo.vivaru.app");
  });

  it("el dominio con el que sanea `sanear-correos-de-prueba.mjs` es uno de los inertes", () => {
    // Si el saneador moviera direcciones a un dominio que la puerta NO considera
    // inerte, sanear dejaría el conjunto igual de cerrado y nadie lo notaría hasta
    // volver a correr el barrido.
    const texto = readFileSync(join(SCRIPTS, "sanear-correos-de-prueba.mjs"), "utf8");
    const m = /DOMINIO_SEGURO\s*=\s*"([^"]+)"/.exec(texto);
    expect(m, "no se encontró DOMINIO_SEGURO en el saneador").toBeTruthy();
    expect(DOMINIOS_INERTES as readonly string[]).toContain(m![1]);
  });
});
