import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **La guarda de `PRD-V-FIX-002` (R6, CF6): que la clave de unidad no vuelva a partirse.**
 *
 * El defecto que corrige la ficha no lo produjo un despiste: lo produjeron dos
 * convenciones conviviendo durante meses sin nada que las vigilara. El dato se
 * migra una vez; **sin esta prueba vuelve a ensuciarse a la primera pantalla
 * nueva**, y encima sin error visible — las reglas rechazan, no filtran, así que
 * el residente ve una lista vacía y el producto no tiene nada que reportar.
 *
 * Lo que vigila, y con qué alcance —dicho aquí para que nadie la lea como más de
 * lo que es—:
 *
 *   1. **El espejo.** Las dos copias del resolvedor son idénticas de la primera
 *      declaración en adelante. `src/` no puede importar de `functions/`, así que
 *      la única forma de que no deriven es compararlas como texto.
 *   2. **Ninguna clave sale de un slug.** Es la forma exacta del defecto y la que
 *      tenía la semilla del trial hasta hoy.
 *   3. **El inventario del servidor está pinchado.** Un módulo nuevo de
 *      `functions/` que empiece a nombrar unidades pone esto en rojo: el servidor
 *      escribe con Admin SDK y **el Admin SDK no evalúa `firestore.rules`**, así
 *      que ahí no hay red debajo.
 *   4. **La semilla del trial pasa por el resolvedor.** Es la fábrica: un conjunto
 *      de prueba mal sembrado nace partido y ninguna migración lo evita.
 *
 * **Lo que NO vigila:** que las ~40 lecturas de `unitId` del portal usen la
 * convención buena. Eso es Fase 2 de la ficha y a propósito — con el dato
 * unificado, la mayoría deja de ser defecto.
 */

const RAIZ = process.cwd();

const ESPEJO_SERVIDOR = "functions/src/clave-de-unidad.ts";
const ESPEJO_CLIENTE = "src/lib/units/clave-de-unidad.ts";

/** Desde aquí las dos copias tienen que decir exactamente lo mismo. */
const MARCA = "/** Una unidad tal y como la necesita el resolvedor. */";
/** El planificador vive SOLO en el servidor: es operación de plataforma. */
const CORTE_SERVIDOR = "// ─────";

function leer(rel: string): string {
  return fs.readFileSync(path.resolve(RAIZ, rel), "utf8");
}

function nucleo(rel: string): string {
  const texto = leer(rel);
  const desde = texto.indexOf(MARCA);
  if (desde === -1) throw new Error(`No encuentro la marca del espejo en ${rel}`);
  const cuerpo = texto.slice(desde);
  const corte = cuerpo.indexOf(CORTE_SERVIDOR);
  return (corte === -1 ? cuerpo : cuerpo.slice(0, corte)).trimEnd();
}

/** Los ficheros del producto que podrían nombrar una unidad. */
function ficheros(dirs: string[]): string[] {
  const salida: string[] = [];
  const visitar = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name === "node_modules" || entrada.name === ".next" || entrada.name === "lib") continue;
        visitar(completo);
      } else if (/\.(ts|tsx)$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name)) {
        salida.push(path.relative(RAIZ, completo));
      }
    }
  };
  for (const d of dirs) visitar(path.resolve(RAIZ, d));
  return salida.sort();
}

const SUPERFICIE = ficheros(["src", "components", "features", "functions/src"]);

describe("1 · el espejo del resolvedor", () => {
  it("las dos copias existen", () => {
    expect(fs.existsSync(path.resolve(RAIZ, ESPEJO_SERVIDOR))).toBe(true);
    expect(fs.existsSync(path.resolve(RAIZ, ESPEJO_CLIENTE))).toBe(true);
  });

  it("el extractor encuentra algo, o esta prueba no vale nada", () => {
    // Una puerta que se abre sobre un texto vacío no verifica nada.
    expect(nucleo(ESPEJO_SERVIDOR).length).toBeGreaterThan(1_500);
    expect(nucleo(ESPEJO_CLIENTE).length).toBeGreaterThan(1_500);
  });

  it("dicen exactamente lo mismo — si cambias una, cambia la otra", () => {
    expect(nucleo(ESPEJO_CLIENTE)).toBe(nucleo(ESPEJO_SERVIDOR));
  });

  it("el planificador de la migración vive SOLO en el servidor", () => {
    expect(leer(ESPEJO_SERVIDOR)).toContain("COLECCIONES_CON_CLAVE_DE_UNIDAD");
    expect(leer(ESPEJO_CLIENTE)).not.toContain("COLECCIONES_CON_CLAVE_DE_UNIDAD");
  });
});

describe("2 · ninguna clave de unidad sale de un slug", () => {
  /**
   * Las dos formas con las que se fabrica una clave equivocada:
   *
   *   - copiar el campo `unitId` de una UNIDAD (que es el slug), o su `.slug`;
   *   - derivarla en línea de la etiqueta (`displayName.toLowerCase().replace(…)`).
   *
   * Un `unitId: item.unitId` o `unitId: input.unitId` NO está aquí y es
   * deliberado: copiar la clave de un documento que ya la tiene no decide nada,
   * y tras la migración esa clave ya es la buena.
   */
  const PROHIBIDO = [
    {
      nombre: "el campo `unitId` de una unidad, que es el slug",
      patron: /(unitId|payerUnitId):\s*[^,;\n]*\b(unit|unidad|units\[[^\]]*\]|unidades\[[^\]]*\]|u)\.unitId\b/,
    },
    { nombre: "`.slug`", patron: /(unitId|payerUnitId):\s*[^,;\n]*\.slug\b/ },
    {
      nombre: "slugificación en línea",
      patron: /(unitId|payerUnitId):\s*[^,;\n]*toLowerCase\(\)\s*\.replace/,
    },
  ];

  /**
   * **La única excepción, y no es una clave.** `updateUnit` escribe el campo
   * `unitId` DEL DOCUMENTO DE LA UNIDAD, que es un slug derivado del nombre y
   * existe desde antes que la ficha. No nombra a nadie: es la propia unidad
   * describiéndose. Retirarlo rompería lectores y es Fase 2.
   */
  const EXCEPCIONES = new Set(["src/features/admin/services.ts:631"]);

  it("el barrido mira ficheros de verdad", () => {
    expect(SUPERFICIE.length).toBeGreaterThan(200);
    expect(SUPERFICIE).toContain("functions/src/trial-seed.ts");
  });

  it("ningún sitio del producto fabrica una clave a partir del slug", () => {
    const hallazgos: string[] = [];
    for (const rel of SUPERFICIE) {
      const lineas = leer(rel).split("\n");
      lineas.forEach((linea, i) => {
        const sitio = `${rel}:${i + 1}`;
        if (EXCEPCIONES.has(sitio)) return;
        for (const { nombre, patron } of PROHIBIDO) {
          if (patron.test(linea)) hallazgos.push(`${sitio} — ${nombre}: ${linea.trim()}`);
        }
      });
    }
    expect(
      hallazgos,
      "La clave de una unidad es el ID DE SU DOCUMENTO (D1). Usa `claveDeUnidad(unidad)` " +
        "del resolvedor único. Si de verdad hace falta escribir el slug, documéntalo y " +
        "añádelo a EXCEPCIONES con su porqué:\n" +
        hallazgos.join("\n"),
    ).toEqual([]);
  });

  it("las excepciones apuntan a una línea que existe y sigue siendo la que era", () => {
    // Una excepción pinchada por número de línea envejece sola: si el fichero se
    // mueve, esto avisa en vez de tapar en silencio el sitio equivocado.
    for (const sitio of EXCEPCIONES) {
      const [rel, num] = sitio.split(":");
      const linea = leer(rel).split("\n")[Number(num) - 1] ?? "";
      expect(linea, `la excepción ${sitio} ya no apunta a lo que decía`).toContain("toLowerCase()");
    }
  });
});

describe("3 · el inventario del servidor está pinchado", () => {
  /**
   * El servidor escribe con **Admin SDK, que NO evalúa `firestore.rules`**: aquí
   * no hay red debajo. Un módulo nuevo de `functions/src` que nombre unidades
   * tiene que ser una decisión consciente, no un descubrimiento de dentro de un mes.
   */
  const INVENTARIO = [
    "functions/src/advances.ts",
    "functions/src/clave-de-unidad.ts",
    "functions/src/clearance-certificates.ts",
    "functions/src/coefficient-billing.ts",
    "functions/src/comprobante.ts",
    "functions/src/expense-distribution.ts",
    "functions/src/index.ts",
    "functions/src/payments.ts",
    "functions/src/reservations.ts",
    "functions/src/trial-seed.ts",
  ];

  it("los módulos del servidor que nombran unidades son exactamente los pinchados", () => {
    const encontrados = SUPERFICIE.filter(
      (rel) => rel.startsWith("functions/src/") && /(unitId|payerUnitId):/.test(leer(rel)),
    );
    expect(
      encontrados,
      "Un módulo del servidor empezó (o dejó) de nombrar unidades. Si es nuevo, comprueba " +
        "que su clave sale de `claveDeUnidad(...)` y añádelo a INVENTARIO.",
    ).toEqual(INVENTARIO);
  });
});

describe("4 · la semilla del trial pasa por el resolvedor", () => {
  /**
   * **Era la fábrica.** Sembraba `people.unitId` y `billingStatements.unitId` con
   * el slug mientras el documento de la unidad vive bajo `${tenantId}--${slug}`,
   * así que todo conjunto nacido del trial nacía partido — y `tenantUsers.unitId`,
   * que es contra lo que compara `residentOwnUnit`, acaba siendo el id.
   */
  const SEMILLA = "functions/src/trial-seed.ts";

  it("importa el resolvedor único", () => {
    expect(leer(SEMILLA)).toMatch(/import\s*\{[^}]*claveDeUnidad[^}]*\}\s*from\s*"\.\/clave-de-unidad"/);
  });

  it("las dos colecciones que nombran unidades usan `claveDeUnidad`", () => {
    const texto = leer(SEMILLA);
    for (const coleccion of ["people", "billingStatements"]) {
      const desde = texto.indexOf(`await set("${coleccion}"`);
      expect(desde, `no encuentro la escritura de ${coleccion} en la semilla`).toBeGreaterThan(-1);
      const bloque = texto.slice(desde, texto.indexOf("});", desde));
      expect(bloque, `la semilla de ${coleccion} no pasa por el resolvedor`).toContain("unitId: claveDeUnidad(unit)");
    }
  });

  it("la unidad sembrada lleva su id, y el id es el del documento", () => {
    const texto = leer(SEMILLA);
    expect(texto).toContain("units.push({ id: id(slug), slug, label, tower })");
    expect(texto).toContain('await set("units", id(slug)');
  });
});
