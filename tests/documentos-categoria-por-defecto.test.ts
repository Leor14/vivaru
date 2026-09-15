import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **`D-3` — un documento subido sin elegir categoría queda a la vista de los residentes.**
 *
 * Lote «Análisis de la plataforma», reproducción de la fase 1 del plan (T1.2). La pantalla de
 * Documentos arranca con la categoría «otro», y «otro» está en la LISTA BLANCA del residente
 * (`CATEGORIAS_VISIBLES_PARA_RESIDENTE` y su espejo en `firestore.rules`). Un informe de cartera
 * subido sin cambiar la categoría lo leen todos los residentes del conjunto.
 *
 * Se lee el código porque el valor por defecto vive dentro del componente. **La prueba del
 * defecto va con `it.fails`**: vale mientras el defecto exista y enrojece si alguien lo arregla
 * sin tocarla. Las otras dos comprueban que el guardián ve lo que dice ver —que encontró el
 * valor por defecto y la lista—, porque un guardián que no encuentra nada pasa siempre.
 */

const raiz = path.resolve(__dirname, "..");
const leer = (f: string) => fs.readFileSync(path.join(raiz, f), "utf8");

const pagina = leer("src/app/(admin)/admin/documents/page.tsx");
const lista = leer("src/features/documents/use-documents.ts");

const valoresPorDefecto = [
  ...pagina.matchAll(/useState<DocumentCategory>\("([a-z_]+)"\)/g),
  ...pagina.matchAll(/setCategory\("([a-z_]+)"\)/g),
].map((m) => m[1]);

const bloque = lista.match(/CATEGORIAS_VISIBLES_PARA_RESIDENTE\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
const visibles = [...bloque.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);

describe("D-3 · la categoría por defecto de Documentos no es visible para el residente", () => {
  it("control: encuentra el valor por defecto al abrir y al reiniciar el formulario", () => {
    expect(valoresPorDefecto.length).toBeGreaterThanOrEqual(2);
  });

  it("control: encuentra la lista blanca del residente", () => {
    expect(visibles.length).toBeGreaterThan(0);
  });

  it.fails("DEFECTO D-3: ningún valor por defecto está en la lista blanca del residente", () => {
    const expuestos = valoresPorDefecto.filter((c) => visibles.includes(c));
    expect(expuestos).toEqual([]);
  });
});
