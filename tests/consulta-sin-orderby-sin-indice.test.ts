import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **Las consultas de `meterReadings` no llevan `orderBy`, y eso está MEDIDO.**
 *
 * Contra staging real, el 10 de septiembre de 2026:
 *
 * | Consulta | Resultado |
 * |---|---|
 * | `tenantId + unitId` | ✅ funciona |
 * | `tenantId + unitId + orderBy(period)` | 🔴 **exige índice compuesto** |
 * | `tenantId + serviceId + period` | ✅ funciona |
 *
 * Un índice que falta **no se manifiesta como error**: Firestore rechaza la
 * consulta entera y la pantalla enseña una lista vacía. El residente leería
 * «no tienes lecturas» teniendo doce. Ya pasó con la lista de documentos del
 * residente, que ordenaba por un campo que la subida real nunca escribía.
 *
 * El orden se pone **en memoria**, que es el patrón de `watchLedger` — el único
 * de esta familia que nunca se rompió. Con doce lecturas al año por servicio,
 * ordenarlas es gratis.
 *
 * Si algún día hace falta el `orderBy`, primero se declara el índice en
 * `firestore.indexes.json` **y se despliega** — y ojo, `--only firestore:rules`
 * NO despliega índices.
 */

const raiz = path.resolve(__dirname, "..");

/**
 * 🔴 **Quita los comentarios ANTES de buscar, y esto es la parte que importa.**
 *
 * Un guardián que busca una cadena en el código fuente **también la encuentra en
 * el comentario que la explica**, así que documentar la regla la rompe. Pasó dos
 * veces en dos días: `page-identity` enrojeció con el comentario que explicaba
 * por qué no había encabezado, y este mismo guardián enrojeció con el comentario
 * que explica por qué no se usa `orderBy`.
 *
 * Es el gemelo de Tailwind resucitando una clase nombrada en un comentario para
 * explicarla. **La regla general: si un guardián mide texto del código, el texto
 * de los comentarios NO es código.**
 */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const FICHEROS_QUE_CONSULTAN_LECTURAS = [
  "src/features/medidores/services.ts",
  "src/features/medidores/use-mis-lecturas.ts",
];

describe("las consultas de medidores no dependen de un índice compuesto", () => {
  it("hay ficheros que vigilar — si no, este guardián mide la nada", () => {
    expect(FICHEROS_QUE_CONSULTAN_LECTURAS.length).toBeGreaterThan(0);
    for (const f of FICHEROS_QUE_CONSULTAN_LECTURAS) {
      expect(fs.existsSync(path.join(raiz, f)), `${f} no existe`).toBe(true);
    }
  });

  it.each(FICHEROS_QUE_CONSULTAN_LECTURAS)("%s no usa `orderBy`", (rel) => {
    const llamadas = sinComentarios(fs.readFileSync(path.join(raiz, rel), "utf8")).match(/\borderBy\s*\(/g) ?? [];
    expect(
      llamadas,
      "Esa consulta con `orderBy` exige un índice compuesto que no existe, y sin él Firestore la rechaza ENTERA: la pantalla enseña una lista vacía en vez de un error. Ordena en memoria, como `watchLedger`.",
    ).toEqual([]);
  });

  it("y de hecho el orden se pone en memoria, con `sort`", () => {
    // El par positivo. Sin él, un fichero que no consultara NADA pasaría la
    // prueba de arriba y este guardián no diría nada útil.
    const fuente = fs.readFileSync(path.join(raiz, "src/features/medidores/use-mis-lecturas.ts"), "utf8");
    expect(fuente).toMatch(/\.sort\(/);
  });
});
