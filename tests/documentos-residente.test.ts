import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **La lista de documentos del residente enseñaba cero teniendo ocho.**
 *
 * Pedía `orderBy("uploadedAt", "desc")` al servidor, y **un `orderBy` descarta
 * los documentos que no traen ese campo**. La subida real
 * (`subirDocumento` en `features/admin/services.ts`) escribe `createdAt` y NO
 * `uploadedAt`: de 39 documentos en producción, 38 no lo tenían. La consulta
 * devolvía cero y la pantalla decía «Sin documentos» — un fallo MUDO, porque una
 * lista vacía se lee como un dato y no como un error.
 *
 * El gemelo que lo hacía bien estaba en el mismo repositorio: `watchDocuments`,
 * del lado del administrador, pide **sin orden** y ordena en memoria. Por eso
 * `/admin/documents` sí veía los ocho.
 *
 * Estas pruebas LEEN los ficheros como texto, igual que `flow-002-espejos`:
 * lo que hay que vigilar es la FORMA de la consulta, y esa no se puede observar
 * ejecutando el hook contra un mock que devuelve lo que se le pida.
 */

const HOOK_RESIDENTE = path.resolve("src/features/documents/use-documents.ts");
const SERVICIOS_ADMIN = path.resolve("src/features/admin/services.ts");
const SUBIDA = path.resolve("src/features/admin/services.ts");

const leer = (p: string) => fs.readFileSync(p, "utf8");

/**
 * El código sin comentarios.
 *
 * **Hace falta, y lo descubrió esta misma prueba naciendo en rojo.** Los
 * comentarios de los ficheros arreglados EXPLICAN el defecto citándolo
 * —`orderBy("uploadedAt", "desc")`, `item.title`—, así que un guardián que lee
 * el fichero entero se dispara con la explicación y no con el código. Peor aún:
 * se callaría borrando el comentario, que es exactamente lo contrario de lo que
 * tiene que vigilar.
 */
const codigo = (p: string) =>
  leer(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("documentos del residente · la consulta no puede ordenar en el servidor", () => {
  it("el hook NO pasa orderByField: ordenar en el servidor descarta documentos sin el campo", () => {
    expect(codigo(HOOK_RESIDENTE)).not.toMatch(/orderByField/);
  });

  it("y ordena en memoria, como su gemelo del administrador", () => {
    expect(leer(HOOK_RESIDENTE)).toMatch(/\.sort\(/);
    expect(leer(SERVICIOS_ADMIN)).toMatch(/watchDocuments[\s\S]{0,600}\.sort\(/);
  });

  /**
   * **Esta prueba nació sin vigilar nada, y lo dijo la falsación.** Buscaba
   * `orderBy("uploadedAt"` y `uploadedAt", "desc"`; al reintroducir el defecto
   * de verdad —`{ orderByField: "uploadedAt", orderDirection: "desc" }`— no
   * casaba con ninguna de las dos y se quedaba VERDE con el código roto.
   *
   * La forma correcta es la más simple: el hook no tiene por qué nombrar ese
   * campo en ningún sitio, así que se prohíbe entero.
   */
  it("el hook no nombra `uploadedAt` en NINGUNA forma: es el campo fantasma", () => {
    expect(codigo(HOOK_RESIDENTE)).not.toMatch(/uploadedAt/);
  });
});

describe("documentos · el campo por el que se ordena es el que la subida escribe", () => {
  it("la subida escribe createdAt", () => {
    const subida = leer(SUBIDA);
    expect(subida).toMatch(/collection\(firestore, "documents"\)[\s\S]{0,700}createdAt: serverTimestamp\(\)/);
  });

  it("y NO escribe uploadedAt — si algún día lo hace, esta prueba avisa de que hay dos esquemas", () => {
    const subida = leer(SUBIDA);
    const bloques = subida.match(/addDoc\(collection\(firestore, "documents"\), \{[\s\S]{0,900}?\n  \}\)/g) ?? [];
    expect(bloques.length).toBeGreaterThan(0);
    for (const bloque of bloques) {
      expect(bloque).not.toMatch(/uploadedAt:/);
    }
  });
});

describe("documentos · la pantalla pinta un campo que existe", () => {
  it("usa fileName y no title, que no existe en ningún documento real", () => {
    const pagina = codigo(path.resolve("src/app/(resident)/resident/documents/page.tsx"));
    expect(pagina).toMatch(/item\.fileName/);
    expect(pagina).not.toMatch(/item\.title/);
  });
});
