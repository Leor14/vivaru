// tests/marca-vieja-fuera-del-producto.test.ts
// La marca vieja no vuelve al producto.
//
// Vivaru se llamó HOGARU, y el id del proyecto de Firebase lo sigue diciendo (`hogaru-1`, en
// minúsculas, que esta prueba no toca). Los últimos restos se quitaron el 27 de agosto de 2026 en
// una rama (`2e0be85`) que nunca llegó a `develop`, y tres siguieron vivos hasta el 12 de
// septiembre porque nada los vigilaba. Esto recorre el código de producto —no las pruebas ni los
// documentos— y enrojece si la palabra aparece.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const CARPETAS = ["src", "components", "features", "functions/src"];
const SUELTOS = ["middleware.ts"];
const MARCA_VIEJA = /HOGARU|Hogaru/;

function recorrer(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === "node_modules" ? [] : recorrer(ruta);
    return /\.(ts|tsx)$/.test(nombre) ? [ruta] : [];
  });
}

const FICHEROS = [
  ...CARPETAS.flatMap((carpeta) => recorrer(join(RAIZ, carpeta))),
  ...SUELTOS.map((fichero) => join(RAIZ, fichero)).filter(existsSync),
];

describe("la marca vieja, fuera del producto", () => {
  it("recorre de verdad el código, incluidos los ficheros que la tuvieron", () => {
    const rutas = FICHEROS.map((f) => relative(RAIZ, f));
    expect(FICHEROS.length).toBeGreaterThan(300);
    expect(rutas).toContain("src/lib/constants/roles.ts");
    expect(rutas).toContain("src/lib/auth/session.ts");
  });

  it("ningún fichero de producto dice la marca vieja", () => {
    const conMarca = FICHEROS.flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .flatMap((linea, i) => (MARCA_VIEJA.test(linea) ? [`${relative(RAIZ, f)}:${i + 1}  ${linea.trim()}`] : [])),
    );
    expect(conMarca).toEqual([]);
  });
});
