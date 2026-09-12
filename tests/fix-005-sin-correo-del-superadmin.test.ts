import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `PRD-V-FIX-005` · H3 / `CF9` — el correo del superadmin no viaja en el código del navegador.
 *
 * `auth-context.tsx` le daba el rol en la interfaz a quien entrara con ese correo, así que el
 * correo iba escrito en el paquete que descarga cualquiera en `/login`. El rol sale del claim
 * y del perfil, que son del servidor; el correo no hace falta.
 *
 * Recorre los TRES árboles que llegan al navegador —`src/`, y `components/` y `features/` en la
 * raíz, de donde importa el portal del residente—, **sin comentarios**: un comentario no llega
 * al paquete, y explicar esta regla nombrando el correo no debe romperla.
 */

const CORREO = ["superadmin", "hogaru.co"].join("@");
const RAIZ = process.cwd();
const ARBOLES = ["src", "components", "features"];

function ficheros(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return ficheros(ruta);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(e.name) ? [ruta] : [];
  });
}

const sinComentarios = (fuente: string) =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("FIX-005 · CF9 · el correo del superadmin no está en el código del navegador", () => {
  const todos = ARBOLES.flatMap((a) => ficheros(path.join(RAIZ, a)));

  // El control: un guardián que recorre cero ficheros pasa siempre.
  it("recorre de verdad los árboles del front", () => {
    expect(todos.length).toBeGreaterThan(200);
  });

  it("ningún fichero lo escribe", () => {
    const conCorreo = todos
      .filter((f) => sinComentarios(fs.readFileSync(f, "utf8")).includes(CORREO))
      .map((f) => path.relative(RAIZ, f));
    expect(conCorreo).toEqual([]);
  });
});
