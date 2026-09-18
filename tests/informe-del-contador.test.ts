import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **`L-22` — subir el informe del contador sobre la cartera.** Lote «Análisis de la plataforma»,
 * pág. 9: «que este módulo permita cargar el documento del contador sobre la cartera».
 *
 * Cartera ya escribía documentos `financiero` por su cuenta —el cierre y el histórico—, pero no
 * había forma de SUBIR uno. Lo que sí hereda de ellos es la categoría: el informe lleva detalle por
 * unidad, así que va a una que los residentes **no** leen.
 *
 * **Y la carpeta nueva vive en TRES sitios**, que es lo que este guardián vigila: `storage.rules`
 * (`carpetasFinancieras`), `SYSTEM_FOLDERS` de `functions/src/index.ts` y el tipo de la callable en
 * `src/lib/firebase/callables.ts`. Faltar en uno la deja muerta: sin la regla, la subida se niega;
 * sin la carpeta del sistema, la callable responde `invalid-argument`. Es la forma del catálogo de
 * banderas, que vive en cinco sitios y ha mordido dos veces.
 */

const leer = (p: string) => fs.readFileSync(path.resolve(p), "utf8");
const codigo = (p: string) =>
  leer(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("L-22 · la carpeta del informe existe en los tres sitios", () => {
  it("`storage.rules` la admite, y entre las financieras (solo administración)", () => {
    const reglas = codigo("storage.rules");
    const financieras = reglas.slice(reglas.indexOf("function carpetasFinancieras"));
    expect(financieras.slice(0, financieras.indexOf("}"))).toContain("'cartera-reports'");
    // Y NO entre las compartidas: ahí la leería cualquier miembro del conjunto.
    const compartidas = reglas.slice(reglas.indexOf("function carpetasCompartidas"));
    expect(compartidas.slice(0, compartidas.indexOf("}"))).not.toContain("cartera-reports");
  });

  it("el servidor conoce la carpeta del sistema", () => {
    const servidor = leer("functions/src/index.ts");
    const bloque = servidor.slice(servidor.indexOf("const SYSTEM_FOLDERS"));
    expect(bloque.slice(0, bloque.indexOf("};"))).toContain("cartera_reports:");
  });

  it("y el cliente puede pedirla sin pelearse con el tipo", () => {
    expect(codigo("src/lib/firebase/callables.ts")).toContain('"cartera_reports"');
  });
});

describe("L-22 · guardián: cómo sube Cartera el informe", () => {
  const pagina = codigo("src/app/(admin)/admin/billing/page.tsx");

  it("lo guarda en su carpeta de Storage y pide la del sistema por su clave", () => {
    expect(pagina).toMatch(/tenants\/\$\{tid\}\/cartera-reports\//);
    expect(pagina).toMatch(/ensureSystemFolderCallable\(\{ tenantId: tid, systemKey: "cartera_reports" \}\)/);
  });

  it("la categoría va FORZADA a `financiero`: el informe lleva detalle por unidad", () => {
    const bloque = pagina.slice(pagina.indexOf("handleSubirInformeDelContador"));
    const subida = bloque.slice(0, bloque.indexOf("toast.success"));
    expect(subida).toMatch(/category: "financiero"/);
    expect(subida).toMatch(/source: "cartera_report"/);
  });

  it("y esa categoría no la leen los residentes", () => {
    const listaBlanca = leer("src/features/documents/use-documents.ts");
    const visibles = listaBlanca.slice(
      listaBlanca.indexOf("CATEGORIAS_VISIBLES_PARA_RESIDENTE"),
      listaBlanca.indexOf("CATEGORIAS_SOLO_ADMINISTRACION"),
    );
    expect(visibles).not.toContain('"financiero"');
  });

  it("la fecha del informe sale de la zona local, no de `toISOString()`", () => {
    const bloque = pagina.slice(pagina.indexOf("handleSubirInformeDelContador"));
    expect(bloque.slice(0, bloque.indexOf("toast.success"))).toMatch(/toDateInputValue\(new Date\(\)\)/);
  });
});
