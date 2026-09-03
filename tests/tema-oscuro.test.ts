import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * El tema oscuro: cobertura, contraste y lo que NO debe girar.
 *
 * `PRD-V-FEAT-007` entrega 2. Un tema al que se le olvida un token deja un trozo
 * de pantalla en claro sobre fondo oscuro, y eso no lo enrojece ninguna prueba
 * de comportamiento: la pantalla "funciona". Por eso lo que se vigila aqui es la
 * COBERTURA — que todo token de color del tema claro tenga su contraparte — y el
 * CONTRASTE de los pares que el producto pinta de verdad, en los DOS temas.
 */
const CSS = readFileSync("src/app/globals.css", "utf8");

/** Los .tsx/.ts del alcance, para el barrido de hexadecimales sueltos. */
const ALCANCE_TSX = [
  "src/app/(admin)", "src/app/(resident)", "src/app/(auth)",
  "src/components/shared", "src/components/features", "src/components/ui", "src/features",
];
const EXCLUIDAS_TSX = ["src/features/security-guard", "src/features/superadmin"];
function listar(raiz: string): string[] {
  const salida: string[] = [];
  for (const e of readdirSync(raiz)) {
    const ruta = join(raiz, e);
    if (EXCLUIDAS_TSX.some((x) => ruta.startsWith(x))) continue;
    if (statSync(ruta).isDirectory()) salida.push(...listar(ruta));
    else if (ruta.endsWith(".tsx") || ruta.endsWith(".ts")) salida.push(ruta);
  }
  return salida;
}
const TODOS_TSX = ALCANCE_TSX.flatMap(listar);

function bloque(inicio: RegExp): string {
  const i = CSS.search(inicio);
  expect(i, `no encuentro el bloque ${inicio}`).toBeGreaterThan(-1);
  let nivel = 0;
  let j = CSS.indexOf("{", i);
  const desde = j;
  for (; j < CSS.length; j++) {
    if (CSS[j] === "{") nivel++;
    else if (CSS[j] === "}" && --nivel === 0) break;
  }
  return CSS.slice(desde, j);
}

const CLARO = bloque(/^:root \{/m);
const OSCURO = bloque(/\[data-tema="oscuro"\] \{/);

function tokens(txt: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const [, k, v] of txt.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) m.set(k, v.trim());
  return m;
}
const T_CLARO = tokens(CLARO);
const T_OSCURO = tokens(OSCURO);

const esColor = (v: string) => /^#[0-9a-fA-F]{3,8}$/.test(v);

function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const l = c.map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}
function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function val(tema: Map<string, string>, token: string): string {
  const v = tema.get(token);
  expect(v, `falta ${token}`).toBeTruthy();
  return v!;
}

describe("PRD-V-FEAT-007 · el tema oscuro cubre todo el color", () => {
  it("recorre bloques que NO estan vacios", () => {
    expect(T_CLARO.size).toBeGreaterThan(60);
    expect(T_OSCURO.size).toBeGreaterThan(60);
  });

  it("todo token de COLOR del tema claro tiene contraparte oscura", () => {
    // Los alias (`var(--x)`) no hacen falta: siguen a su origen.
    const huerfanos = [...T_CLARO.entries()]
      .filter(([, v]) => esColor(v))
      .map(([k]) => k)
      .filter((k) => !T_OSCURO.has(k));
    expect(
      huerfanos,
      `Estos se quedarian en CLARO sobre fondo oscuro:\n${huerfanos.join("\n")}`,
    ).toEqual([]);
  });

  it("el bloque oscuro va dentro de @media screen, o el informe del consejo sale en oscuro", () => {
    // RN-07. Al imprimir, el bloque no aplica y mandan los valores de :root.
    //
    // Se mira sobre el CSS SIN COMENTARIOS, y eso no es limpieza: la primera
    // version de esta prueba pasaba en verde con el `@media` cambiado a mano,
    // porque `lastIndexOf("@media screen")` encontraba las palabras dentro del
    // comentario que explica la regla. El guardian se defendia con su propia
    // documentacion. Lo destapo falsarlo, no escribirlo.
    const sinComentarios = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const i = sinComentarios.indexOf('[data-tema="oscuro"] {');
    expect(i, "no encuentro el bloque oscuro").toBeGreaterThan(-1);
    const antes = sinComentarios.slice(0, i);
    const ultimoMedia = antes.lastIndexOf("@media screen {");
    expect(ultimoMedia, "el bloque oscuro no esta bajo @media screen").toBeGreaterThan(-1);
    // y no hay ningun cierre de bloque entre ese @media y el selector
    expect(antes.slice(ultimoMedia).split("}").length - 1).toBe(0);
  });

  it("`--on-fill` y `--overlay` NO giran", () => {
    // Si giraran, el texto de cada boton y el de los modales desapareceria.
    expect(val(T_OSCURO, "--on-fill")).toBe(val(T_CLARO, "--on-fill"));
    expect(val(T_OSCURO, "--overlay")).toBe(val(T_CLARO, "--overlay"));
  });

  it("la tarjeta sigue estando POR ENCIMA de la pagina", () => {
    for (const tema of [T_CLARO, T_OSCURO]) {
      const r = contraste(val(tema, "--surface-strong"), val(tema, "--background"));
      expect(r).toBeGreaterThan(1.05);
    }
  });
});

/** Los pares que el producto pinta de verdad, texto sobre fondo. */
const PARES_TEXTO: [string, string][] = [
  ["--slate-500", "--surface-strong"],
  ["--slate-600", "--surface-strong"],
  ["--slate-700", "--surface-strong"],
  ["--slate-900", "--surface-strong"],
  ["--brand-700", "--surface-strong"],
  ["--danger-700", "--surface-strong"],
  ["--success-700", "--surface-strong"],
  ["--foreground", "--background"],
  ["--foreground", "--surface-strong"],
  ["--amber-800", "--amber-100"],
  ["--amber-700", "--amber-50"],
  ["--danger-700", "--danger-100"],
  ["--danger-700", "--danger-50"],
  ["--success-700", "--success-100"],
  ["--success-700", "--success-50"],
  ["--info-700", "--info-100"],
  ["--info-700", "--info-50"],
  ["--slate-700", "--slate-100"],
];

const RELLENOS = ["marca", "neutro", "exito", "peligro", "aviso"];

describe("PRD-V-FEAT-007 · `--slate-400`, deuda de contraste ANTERIOR a este frente", () => {
  /**
   * `--slate-400` es el escalon de pista: marcador de posicion, texto de apoyo
   * («Nombre, firma y fecha», «… y N mas») e iconos de accion. Son 78 usos.
   *
   * En CLARO da 2,83:1 sobre la tarjeta blanca — por debajo de AA, y lo estaba
   * ANTES de esta ficha: no lo introdujo la migracion. Arreglarlo oscurece texto
   * en todo el producto y SE VE, asi que es decision de David, como lo fue el
   * grupo B. Aqui no se suaviza la afirmacion: se fija el suelo, y si alguien lo
   * empeora, enrojece.
   *
   * En OSCURO si cumple, porque el valor lo genera este frente.
   */
  it("en claro no empeora del 2,83:1 que ya tenia", () => {
    const r = contraste(val(T_CLARO, "--slate-400"), val(T_CLARO, "--surface-strong"));
    expect(r, `--slate-400 en claro da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(2.83);
  });

  it("en oscuro SI cumple AA, que es donde este frente decide el valor", () => {
    const r = contraste(val(T_OSCURO, "--slate-400"), val(T_OSCURO, "--surface-strong"));
    expect(r, `--slate-400 en oscuro da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });
});

describe.each([
  ["claro", T_CLARO],
  ["oscuro", T_OSCURO],
])("PRD-V-FEAT-007 · contraste en tema %s", (nombre, tema) => {
  it.each(PARES_TEXTO)("%s sobre %s llega a 4,5:1", (fg, bg) => {
    const r = contraste(val(tema, fg), val(tema, bg));
    expect(r, `${fg} sobre ${bg} en ${nombre} da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(RELLENOS)("el texto blanco se lee sobre --relleno-%s", (n) => {
    const r = contraste(val(tema, "--on-fill"), val(tema, `--relleno-${n}`));
    // Dos rellenos CLAROS venian por debajo de antes de este frente y se
    // preservaron tal cual para no mover un pixel: ver el bloque de deuda de
    // abajo. En oscuro todos cumplen, porque el valor lo decide este frente.
    const suelo = nombre === "claro" && (n === "exito" || n === "aviso") ? 3.6 : 4.5;
    expect(r, `--on-fill sobre --relleno-${n} en ${nombre} da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(suelo);
  });

  it.each(RELLENOS)("--relleno-%s se distingue de la tarjeta (3:1)", (n) => {
    const r = contraste(val(tema, `--relleno-${n}`), val(tema, "--surface-strong"));
    expect(r, `--relleno-${n} sobre la tarjeta en ${nombre} da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
  });
});

describe("PRD-V-FEAT-007 · rellenos claros por debajo de AA, deuda ANTERIOR", () => {
  /**
   * `--relleno-exito` (#009966) y `--relleno-aviso` (#c67133) llevan etiqueta
   * blanca y dan 3,65:1 y 3,61:1 en claro. Son botones reales —«Aprobar»,
   * «Marcar»— y estaban asi antes: la entrega 1 los copio tal cual para no mover
   * un pixel, que era la regla.
   *
   * Oscurecerlos SE VE, asi que es decision de David. Mientras tanto: suelo
   * fijado y el numero delante. **Este suelo solo puede SUBIR.**
   */
  it.each([
    ["exito", 3.65],
    ["aviso", 3.61],
  ])("--relleno-%s en claro no empeora de %s:1", (n, minimo) => {
    const r = contraste(val(T_CLARO, "--on-fill"), val(T_CLARO, `--relleno-${n}`));
    expect(r, `--relleno-${n} en claro da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(minimo as number);
  });

  it("y en OSCURO los cinco rellenos si cumplen AA", () => {
    for (const n of RELLENOS) {
      const r = contraste(val(T_OSCURO, "--on-fill"), val(T_OSCURO, `--relleno-${n}`));
      expect(r, `--relleno-${n} en oscuro da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

/**
 * CUARTA forma de color literal: el hexadecimal en una propiedad de JS o en un
 * atributo JSX — `stroke="#335f88"`, `fill: "#94a3b8"`, `wrapperStyle={{color}}`.
 *
 * No es una clase de Tailwind, asi que ni la medicion del 3 de septiembre ni el
 * guardian de `color-por-token` la veian. Son **344 en 33 ficheros**, y NO todas
 * deben tematizarse: la marca del conjunto la elige el cliente y el QR tiene que
 * seguir siendo negro sobre blanco para que se pueda escanear.
 *
 * En oscuro casi todas sobreviven porque son colores saturados de grafica. Las
 * dos que NO —el rotulo de la leyenda y la linea de «% recaudo» del panel, a
 * 1,55:1 y 2,40:1— se arreglaron leyendo el token en ejecucion, porque en un
 * atributo del SVG `var()` no vale.
 *
 * Techo, no comentario: si aparecen mas, enrojece.
 */
const HEX_SUELTO = /#[0-9a-fA-F]{6}\b/g;
const TECHO_HEX_JS = 344;

/** Colores que NO son del tema y no deben migrarse nunca. */
const NO_SON_DEL_TEMA = [
  "src/features/admin/hooks/use-tenant-branding-form.ts",
  "src/features/admin/components/tenant-branding-card.tsx",
  "src/features/admin/utils/branding-contrast.ts",
  "src/features/admin/services.ts",
  "src/app/(resident)/resident/visitors/[id]/qr/page.tsx",
];

describe("PRD-V-FEAT-007 · hexadecimales fuera de las clases, deuda medida", () => {
  it("no crecen", () => {
    const cuenta = TODOS_TSX.reduce(
      (n, f) => n + (readFileSync(f, "utf8").match(HEX_SUELTO)?.length ?? 0),
      0,
    );
    expect(
      cuenta,
      `Habia ${TECHO_HEX_JS} y ahora hay ${cuenta}. Un color nuevo se pide por token; ` +
        `si va en un atributo de SVG, leelo en ejecucion con useColoresDeGrafica.`,
    ).toBeLessThanOrEqual(TECHO_HEX_JS);
  });

  it("los que NO son del tema siguen ahi, y eso es lo correcto", () => {
    // Un guardian que empujara a migrarlos romperia la marca del cliente y el QR.
    for (const f of NO_SON_DEL_TEMA) {
      expect(readFileSync(f, "utf8").match(HEX_SUELTO)?.length ?? 0, `${f} se quedo sin color`).toBeGreaterThan(0);
    }
  });
});
