import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * En las superficies con tema, el color se pide por TOKEN y nunca por literal.
 *
 * `PRD-V-FEAT-007` entrega 1. El modo oscuro no puede alcanzar a un componente
 * que dice `bg-white`: cambie lo que cambie el token, esa clase seguira pintando
 * blanco. Por eso el guardian no vigila el aspecto —que no cambia— sino la via:
 * mientras quede un literal en el alcance, hay un trozo de producto al que el
 * tema no llega.
 *
 * SOLO cubre el alcance del MVP. Porteria, superadmin, diagnostico y el landing
 * quedan FUERA a proposito (fase 2), y por eso este guardian no los recorre: una
 * puerta que se abre sobre un conjunto vacio no verifica nada, y una que abarca
 * mas de lo acordado enrojece por trabajo que nadie prometio.
 */
const ALCANCE = [
  "src/app/(admin)",
  "src/app/(resident)",
  "src/app/(auth)",
  "src/components/shared",
  "src/components/features",
  "src/components/ui",
  // `src/features` NO es `src/components/features`: son DOS arboles distintos y
  // la ficha solo nombraba el segundo. El hueco lo destapo la propia
  // verificacion del bundle —`text-indigo-700` seguia emitiendose sin un solo
  // consumidor en el alcance que yo creia completo—, no una lectura del codigo.
  "src/features",
];

/** Portales fuera del MVP que viven DENTRO de `src/features`. Fase 2. */
const EXCLUIDAS = ["src/features/security-guard", "src/features/superadmin"];

const PREFIJOS = [
  "bg", "text", "border", "ring", "divide", "placeholder", "from", "via", "to",
  "shadow", "outline", "decoration", "accent", "caret", "fill", "stroke",
].join("|");

const FAMILIAS = [
  "white", "black", "gray", "slate", "zinc", "neutral", "stone", "red", "orange",
  "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue",
  "indigo", "violet", "purple", "fuchsia", "pink", "rose",
].join("|");

/** `bg-white`, `text-slate-700`, `hover:bg-black/40`… */
const LITERAL = new RegExp(
  `\\b(?:${PREFIJOS})-(?:${FAMILIAS})(?:-(?:50|100|200|300|400|500|600|700|800|900|950))?\\b`,
  "g",
);

function ficheros(raiz: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(raiz)) {
    const ruta = join(raiz, entrada);
    if (EXCLUIDAS.some((e) => ruta.startsWith(e))) continue;
    if (statSync(ruta).isDirectory()) salida.push(...ficheros(ruta));
    else if (ruta.endsWith(".tsx") || ruta.endsWith(".ts")) salida.push(ruta);
  }
  return salida;
}

const TODOS = ALCANCE.flatMap(ficheros);

describe("PRD-V-FEAT-007 · el color del alcance se pide por token", () => {
  it("recorre un conjunto que NO esta vacio", () => {
    // El control del guardian. Sin esto, borrar una carpeta del alcance dejaria
    // la prueba en verde sobre cero ficheros.
    // Son 150 al escribir esto; el suelo va holgado para que anadir o quitar
    // una pantalla no enrojezca, pero que perder una carpeta entera si.
    expect(TODOS.length).toBeGreaterThan(120);
  });

  it("no queda ni un color literal de Tailwind en las superficies con tema", () => {
    const culpables: string[] = [];
    for (const f of TODOS) {
      const encontrados = readFileSync(f, "utf8").match(LITERAL);
      if (encontrados) culpables.push(`${f} → ${[...new Set(encontrados)].join(", ")}`);
    }
    expect(culpables, `Usa text-[var(--token)], que es el idioma del repositorio:\n${culpables.join("\n")}`)
      .toEqual([]);
  });

  it("y el idioma de token esta de verdad en uso, no solo ausente el literal", () => {
    // Si alguien borrara el color en vez de migrarlo, la prueba de arriba pasaria
    // igual. Esta exige que el token se este usando.
    const conToken = TODOS.filter((f) => /-\[var\(--[a-z0-9-]+\)\]/.test(readFileSync(f, "utf8")));
    expect(conToken.length).toBeGreaterThan(100);
  });
});

/**
 * SEGUNDA FORMA DE LITERAL, la que ninguna medicion habia contado.
 *
 * La medicion del 3 de septiembre dijo «0 hexadecimales dentro de componentes» y
 * era cierta para el hex suelto — pero no vio `bg-[#fff6f4]`, que es un color
 * literal metido en una clase arbitraria y al que el tema tampoco alcanza.
 * Son 140 usos y 81 colores distintos en 20 ficheros, y NO se migran en la
 * entrega 1: a diferencia de la paleta con nombre, cada uno es un tinte a medida
 * —mapas de tono en las tarjetas del panel, pastillas de estado— con
 * casi-duplicados entre ficheros. Unificarlos es disenar un sistema de tonos y
 * SE VE, o sea que es decision de David, como lo fue el grupo B.
 *
 * Mientras tanto esto no es un comentario, que se lee el dia que se escribe y
 * ninguno mas: es un techo. Si aparecen mas, enrojece.
 */
const HEX_EN_CLASE = new RegExp(
  `\\b(?:${PREFIJOS})-\\[(?:#[0-9a-fA-F]{3,8}|rgba?\\([^\\]]*\\)|hsla?\\([^\\]]*\\))\\]`,
  "g",
);

/** Lo medido el 3 de septiembre de 2026. Este numero SOLO puede bajar. */
const TECHO_HEX = 140;

describe("PRD-V-FEAT-007 · la deuda de hexadecimales en clase arbitraria", () => {
  const cuenta = TODOS.reduce(
    (n, f) => n + (readFileSync(f, "utf8").match(HEX_EN_CLASE)?.length ?? 0),
    0,
  );

  it("no crece: los tintes a medida son deuda conocida, no una via abierta", () => {
    expect(
      cuenta,
      `Habia ${TECHO_HEX} y ahora hay ${cuenta}. Un color nuevo se pide por token, ` +
        `no con un hexadecimal entre corchetes.`,
    ).toBeLessThanOrEqual(TECHO_HEX);
  });

  it("y el techo esta pegado a la realidad, no inflado", () => {
    // Un techo muy por encima de lo real deja sitio para colar literales sin que
    // nadie se entere. Cuando se migren, hay que BAJARLO.
    expect(cuenta).toBeGreaterThan(TECHO_HEX - 20);
  });
});
