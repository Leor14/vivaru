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

/** Lo medido el 3 de septiembre de 2026. Este numero SOLO puede bajar.
 *  Empezo en 140 y la entrega 2 lo llevo a CERO: en oscuro esos tintes no
 *  quedaban «sin tematizar», quedaban rotos —19 elementos ilegibles en el panel,
 *  texto a 1,55:1—, asi que dejaron de ser deuda y pasaron a ser trabajo. */
const TECHO_HEX = 0;

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
    // Un techo por encima de lo real deja sitio para colar literales sin que
    // nadie se entere. Con el techo en 0 la afirmacion es exacta y no hay holgura.
    expect(cuenta).toBe(TECHO_HEX);
  });
});

/**
 * Las insignias de estado tienen que LEERSE.
 *
 * Al unificar la paleta (grupo B de la entrega 1), la pastilla de plazo paso de
 * 4,52:1 a 4,33:1 y cruzo por DEBAJO de AA. Fue una regresion real, y no la vio
 * ninguna prueba: la cazo calcular el contraste del par antes y despues.
 *
 * El sistema ya decia cual era el par bueno — `--warning-100` con
 * `--warning-800`, no con el 700 — asi que el arreglo no fue inventar un color
 * sino leer el alias que ya estaba escrito.
 *
 * Esta prueba lee los valores de `globals.css`, asi que mover un token la
 * enrojece con el numero delante.
 */
const CSS_GLOBAL = readFileSync("src/app/globals.css", "utf8");

function valor(token: string): string {
  const m = CSS_GLOBAL.match(new RegExp(`--${token}:\\s*(#[0-9a-fA-F]{6})`));
  expect(m, `falta el token --${token}`).not.toBeNull();
  return m![1];
}
function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const l = c.map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}
function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Los pares que el producto pinta de verdad, texto sobre fondo. */
const PARES: [string, string][] = [
  ["amber-800", "amber-100"],
  ["amber-700", "amber-50"],
  ["danger-700", "danger-100"],
  ["danger-700", "danger-50"],
  ["success-700", "success-100"],
  ["success-700", "success-50"],
  ["info-700", "info-100"],
  ["info-700", "info-50"],
  ["slate-700", "slate-100"],
];

describe("PRD-V-FEAT-007 · las insignias de estado cumplen AA", () => {
  it.each(PARES)("%s sobre %s llega a 4,5:1", (fg, bg) => {
    const r = contraste(valor(fg), valor(bg));
    expect(r, `--${fg} sobre --${bg} da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it("y nadie vuelve a poner amber-700 sobre amber-100, que da 4,33:1", () => {
    const culpables = TODOS.filter((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .some((l) => l.includes("bg-[var(--amber-100)]") && l.includes("text-[var(--amber-700)]")),
    );
    expect(culpables, `Usa --amber-800 sobre el 100:\n${culpables.join("\n")}`).toEqual([]);
  });
});

/**
 * QUINTA forma de color literal, y la que rompio el modo oscuro de verdad: el
 * hexadecimal DENTRO de un valor arbitrario compuesto.
 *
 * `bg-[radial-gradient(...#ffffff...)]` no lo cazaba el patron de `bg-[#hex]`,
 * asi que el lienzo de `app-shell` —el que comparten los TRES portales— seguia
 * pintandose claro mientras las tarjetas oscurecian, y el titulo de la pagina
 * quedaba en texto claro sobre fondo claro. No lo vio ninguna prueba: lo vio
 * David en una captura.
 *
 * Tambien cubre `var(--token, #respaldo)` —color literal escondido en el
 * respaldo— y `color-mix(..., white)`, que en oscuro produce un fondo CLARO.
 */
const ARBITRARIO_CON_COLOR = new RegExp(
  `\\b[a-z-]+-\\[[^\\]]*(?:#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\(|\\bwhite\\b|\\bblack\\b)[^\\]]*\\]`,
  "g",
);

/** El QR tiene que seguir siendo negro sobre blanco o deja de escanearse. */
const NO_SE_TEMATIZA = ["src/app/(resident)/resident/visitors/[id]/qr/page.tsx"];

describe("PRD-V-FEAT-007 · nada de color literal dentro de un valor arbitrario", () => {
  it("ni degradados, ni sombras en linea, ni respaldos de var()", () => {
    const culpables: string[] = [];
    for (const f of TODOS) {
      if (NO_SE_TEMATIZA.some((x) => f === x)) continue;
      const hits = readFileSync(f, "utf8").match(ARBITRARIO_CON_COLOR);
      if (hits) culpables.push(`${f} → ${[...new Set(hits)].join(", ")}`);
    }
    expect(
      culpables,
      `Un degradado o una sombra tambien son color, y el tema no los alcanza:\n${culpables.join("\n")}`,
    ).toEqual([]);
  });

  it("y el QR se queda claro A PROPOSITO, con su color literal", () => {
    // Al reves de lo habitual: si alguien lo "arregla", el codigo deja de leerse.
    for (const f of NO_SE_TEMATIZA) {
      expect(readFileSync(f, "utf8"), `${f} perdio su fondo claro`).toMatch(ARBITRARIO_CON_COLOR);
    }
  });
});
