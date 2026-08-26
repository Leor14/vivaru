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

/** Sin líneas de comentario: lo que el fichero HACE, no lo que cuenta. */
function soloCodigo(texto: string): string {
  return texto
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");
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
  /**
   * **Las DOS formas de fijar la clave**, y la segunda casi se escapa. Se buscaba
   * solo `unitId: …` —la de objeto literal— y `trial-workspace.ts` la fija por
   * asignación: `demoProfile.unitId = …`. Estaba bien por casualidad (ya usaba el
   * id), pero la guarda no lo miraba, y era la fábrica.
   */
  const FIJA_LA_CLAVE = "(?:(?:unitId|payerUnitId):|\\.(?:unitId|payerUnitId)\\s*=(?!=))";

  const PROHIBIDO = [
    {
      nombre: "el campo `unitId` de una unidad, que es el slug",
      patron: new RegExp(`${FIJA_LA_CLAVE}\\s*[^,;\n]*\\b(?:unit|unidad|units\\[[^\\]]*\\]|unidades\\[[^\\]]*\\]|u)\\.unitId\\b`),
    },
    { nombre: "`.slug`", patron: new RegExp(`${FIJA_LA_CLAVE}\\s*[^,;\n]*\\.slug\\b`) },
    {
      nombre: "slugificación en línea",
      patron: new RegExp(`${FIJA_LA_CLAVE}\\s*[^,;\n]*toLowerCase\\(\\)\\s*\\.replace`),
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
    // `FLOW-003` R9. **No construye ninguna clave: LEE `tenantUsers.unitId`**, que
    // desde `FIX-002` ya es la canónica —el id del documento de la unidad—, y por eso
    // no pasa por `claveDeUnidad(...)`: no hay nada que resolver. Lo que sí hace es
    // negarse a devolverla cuando no puede afirmar de quién es, que es la otra mitad
    // de la misma disciplina.
    "functions/src/estado-de-cuenta-adjunto.ts",
    "functions/src/expense-distribution.ts",
    "functions/src/index.ts",
    "functions/src/payments.ts",
    "functions/src/reservations.ts",
    "functions/src/trial-seed.ts",
    // Fija la unidad del residente de prueba POR ASIGNACIÓN, no en un literal.
    // Estuvo fuera del inventario hasta el 26 ago 2026 por eso mismo.
    "functions/src/trial-workspace.ts",
  ];

  it("los módulos del servidor que nombran unidades son exactamente los pinchados", () => {
    const encontrados = SUPERFICIE.filter(
      (rel) =>
        rel.startsWith("functions/src/") &&
        /(?:(?:unitId|payerUnitId):|\.(?:unitId|payerUnitId)\s*=(?!=))/.test(leer(rel)),
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

  it("el residente de prueba NO recibe unidad si no se va a sembrar ninguna", () => {
    // Con `asCustomer` no hay siembra y no hay unidades, pero la membresía se
    // fijaba igual a `${tenantId}--t1-101`: una clave que no existiría nunca.
    // Dos conjuntos de staging seguían así el 26 de agosto de 2026. Sin unidad se
    // ve igual de vacío, pero se ve que FALTA asignarla — y se puede.
    const taller = leer("functions/src/trial-workspace.ts");
    expect(taller).toMatch(/if \(spec\.role === "resident" && shouldSeed\)/);
    const decision = taller.indexOf("const shouldSeed =");
    const uso = taller.indexOf('spec.role === "resident" && shouldSeed');
    expect(decision, "`shouldSeed` tiene que decidirse ANTES de las cuentas de prueba").toBeGreaterThan(-1);
    expect(decision).toBeLessThan(uso);
  });

  it("el residente de prueba recibe su unidad del MISMO sitio que la crea", () => {
    // La membresía llevaba `${tenantId}--t1-101` escrito a mano en otro fichero:
    // dos sitios calculando el mismo id, y el día que el esquema cambiara el
    // residente de prueba apuntaría a una unidad inexistente sin ningún error.
    const taller = leer("functions/src/trial-workspace.ts");
    expect(taller).toContain("idDeUnidadSembrada(tenantId, SLUG_PRIMERA_UNIDAD)");
    // **Solo el código.** Un comentario que NOMBRE el id viejo —y el de arriba lo
    // nombra, para explicar qué pasó— no es un sitio que lo calcule. Un guardián
    // que enrojece por su propia prosa se acaba desactivando.
    expect(soloCodigo(taller), "el id del esquema no puede volver a escribirse a mano").not.toMatch(
      /`\$\{tenantId\}--t1-101`/,
    );
    expect(leer(SEMILLA)).toContain("export function idDeUnidadSembrada");
  });
});

describe("5 · fusionar unidades re-apunta TODAS las referencias, no nueve", () => {
  /**
   * **`mergeUnits` borra la unidad duplicada al terminar**, así que toda
   * colección que no repunte queda apuntando a una unidad que ya no existe. Su
   * lista estaba escrita a mano y decía **NUEVE** mientras el comentario prometía
   * «TODAS las referencias». Son dieciocho: faltaban `advances` y
   * `advanceApplications` —dinero a favor de un residente—, `packages`,
   * `clearanceCertificates`, `visitorInvitations`, `survey_responses` y las dos
   * de firmas.
   *
   * **Y eso explica los huérfanos que `FIX-002` no pudo resolver:** los 27 de
   * `tenant-santa-maria` bajo `G1bWNzZJuakw9KRoAx7p` están exactamente en cuatro
   * de las que faltaban.
   *
   * Es la trampa del plural: cuando una frase dice «todas», hay que contar
   * cuántas son antes de firmarla.
   */
  const INDEX = "functions/src/index.ts";

  it("la lista SALE del inventario, no está escrita a mano", () => {
    const texto = leer(INDEX);
    const desde = texto.indexOf("const UNIT_REF_FIELDS");
    expect(desde, "no encuentro UNIT_REF_FIELDS").toBeGreaterThan(-1);
    const bloque = texto.slice(desde, texto.indexOf("];", desde));
    expect(bloque, "UNIT_REF_FIELDS tiene que derivarse de COLECCIONES_CON_CLAVE_DE_UNIDAD").toContain(
      "COLECCIONES_CON_CLAVE_DE_UNIDAD.filter",
    );
  });

  it("y no vuelve a enumerar a mano las colecciones del inventario", () => {
    const texto = leer(INDEX);
    const desde = texto.indexOf("const UNIT_REF_FIELDS");
    const bloque = texto.slice(desde, texto.indexOf("];", desde));
    const aMano = [...bloque.matchAll(/collection: "(\w+)"/g)].map((m) => m[1]);
    // `services` es la única a mano, y su porqué está escrito ahí: no la gobierna
    // `residentOwnUnit`, así que no entra en el inventario, pero el campo existe.
    expect(aMano).toEqual(["services"]);
  });

  it("`tenantUsers` se excluye del genérico porque tiene su propio bloque", () => {
    const texto = leer(INDEX);
    const desde = texto.indexOf("const UNIT_REF_FIELDS");
    const bloque = texto.slice(desde, texto.indexOf("];", desde));
    expect(bloque).toContain("!c.raizDelPermiso");
    // Y ese bloque propio tiene que existir, o la membresía se quedaría sin repuntar.
    expect(texto).toMatch(/collection\("tenantUsers"\)[\s\S]{0,200}unitId["']?\s*,\s*"==",\s*dupId/);
  });
});
