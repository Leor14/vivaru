import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { categoriaDelAdjuntoDeComunicado } from "@/features/communications/adjunto-de-comunicado";
import { CATEGORIAS_SOLO_ADMINISTRACION, elResidentePuedeVer } from "@/features/documents/use-documents";

/**
 * **`D-2c` — el adjunto de un comunicado dirigido no llega a Documentos del residente.**
 *
 * Plan `docs/plan-lote-analisis-plataforma.md`, fase 2. Espejo de `D-2b`: la regla ya limitaba el
 * comunicado, pero su adjunto se registraba como `comunicado`, visible para todo residente. La
 * prueba de la regla está en `tests/comunicados-audiencia.rules.test.ts`; esta vigila la
 * categoría y que la pantalla la use.
 */

const PAGINA = path.resolve("src/app/(admin)/admin/communications/page.tsx");

/** El código sin comentarios: los comentarios citan el defecto (`un-guardian-cuenta-sus-comentarios`). */
const codigo = (p: string) =>
  fs
    .readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("D-2c · la categoría del adjunto depende de la audiencia", () => {
  it("el de un comunicado general lo ve el residente", () => {
    expect(categoriaDelAdjuntoDeComunicado("all")).toBe("comunicado");
    expect(elResidentePuedeVer({ category: categoriaDelAdjuntoDeComunicado("all") })).toBe(true);
  });

  it("D-2c: el de uno dirigido, a torres o a unidades, no", () => {
    for (const audience of ["towers", "units"] as const) {
      const category = categoriaDelAdjuntoDeComunicado(audience);
      expect(elResidentePuedeVer({ category })).toBe(false);
      expect(CATEGORIAS_SOLO_ADMINISTRACION as readonly string[]).toContain(category);
    }
  });

  it("y la regla de documents no nombra esa categoría en su lista del residente", () => {
    const reglas = fs.readFileSync(path.resolve("firestore.rules"), "utf8");
    const bloque = reglas.slice(reglas.indexOf("match /documents/{docId}"));
    const lista = bloque.slice(0, bloque.indexOf("allow create"));
    expect(lista).toContain("'comunicado'");
    expect(lista).not.toContain("comunicado_dirigido");
  });
});

describe("D-2c · guardián: Comunicaciones registra el adjunto con esa categoría", () => {
  it("la pantalla la elige con la función, no con una categoría fija", () => {
    const pagina = codigo(PAGINA);
    expect(pagina).toMatch(/category:\s*categoriaDelAdjuntoDeComunicado\(payload\.audience\)/);
    expect(pagina).not.toMatch(/category:\s*"comunicado"/);
  });
});
