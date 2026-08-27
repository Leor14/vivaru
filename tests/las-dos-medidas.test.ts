import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Las dos medidas: una para leer y otra para datos.
 *
 * `<main>` iba sin tope, asi que la prosa que ocupaba el ancho completo salia
 * entre 108 y 182 caracteres por linea —medido en cuatro pantallas a 1512px— y
 * en un monitor mayor empeoraba en proporcion.
 */
const CSS = readFileSync("src/app/globals.css", "utf8");

/** El relleno de las paginas: `p-4 md:p-8`, o sea 32px por lado en escritorio. */
const RELLENO_DE_PAGINA = 64;

function ficheros(dir: string): string[] {
  const salida: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next") continue;
    const ruta = join(dir, e);
    if (statSync(ruta).isDirectory()) salida.push(...ficheros(ruta));
    else if (ruta.endsWith(".tsx")) salida.push(ruta);
  }
  return salida;
}

const TSX = ["src", "components", "features"].flatMap(ficheros);

function token(nombre: string): string {
  const m = CSS.match(new RegExp(`--${nombre}:\\s*([^;]+);`));
  expect(m, `falta el token --${nombre}`).not.toBeNull();
  return m![1].trim();
}

describe("las dos medidas", () => {
  it("estan declaradas como tokens", () => {
    expect(token("medida-lectura")).toMatch(/ch$/);
    expect(token("medida-datos")).toMatch(/px$/);
  });

  it("la descripcion de tarjeta lleva la medida de lectura", () => {
    const card = readFileSync("src/components/ui/card.tsx", "utf8");
    const cuerpo = card.slice(card.indexOf("export function CardDescription"));
    expect(cuerpo).toContain("max-w-[var(--medida-lectura)]");
  });

  it("`<main>` lleva la medida de datos", () => {
    const shell = readFileSync("src/components/shared/app-shell.tsx", "utf8");
    expect(shell).toMatch(/<main className="[^"]*max-w-\[var\(--medida-datos\)\]/);
  });

  /**
   * La de verdad: el tope se compara contra la tabla mas ancha QUE HAYA EN EL
   * CODIGO, no contra un numero copiado. Añadir una tabla mas ancha que la
   * medida la haria desplazarse con pantalla de sobra, y esto lo caza.
   */
  it("la medida de datos deja sitio a la tabla mas ancha del producto", () => {
    let masAncha = 0;
    let donde = "";
    for (const f of TSX) {
      for (const m of readFileSync(f, "utf8").matchAll(/min-w-\[(\d+)px\]/g)) {
        const px = Number(m[1]);
        if (px > masAncha) { masAncha = px; donde = f; }
      }
    }
    expect(masAncha, "no se encontro ninguna tabla con ancho minimo").toBeGreaterThan(500);
    const datos = Number(token("medida-datos").replace("px", ""));
    expect(
      datos - RELLENO_DE_PAGINA,
      `la tabla mas ancha (${masAncha}px, en ${donde}) no cabe en la medida de datos (${datos}px menos ${RELLENO_DE_PAGINA} de relleno)`,
    ).toBeGreaterThanOrEqual(masAncha);
  });

  it("el valor vive en el token y no repartido por las paginas", () => {
    const culpables = TSX.filter((f) => /max-w-\[\d+ch\]/.test(readFileSync(f, "utf8")));
    expect(culpables, `usa var(--medida-lectura):\n${culpables.join("\n")}`).toEqual([]);
  });
});
