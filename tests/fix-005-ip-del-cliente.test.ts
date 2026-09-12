import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SALTOS_DE_APP_HOSTING, ipDelCliente } from "@/lib/http/ip-del-cliente";

/**
 * `PRD-V-FIX-005` · H5 / R7 / `CF8` — el límite de `/api/lead` y `/api/demo` cuenta la IP que ve la
 * infraestructura, no la que manda el cliente.
 *
 * **Medido en staging el 12 sep**, con una petición a `/api/lead` que traía un `X-Forwarded-For`
 * falso: detrás de App Hosting llega «lo que mandó el cliente, la IP real, y DOS saltos de Google».
 * La IP del cliente es la tercera empezando por el final. Las dos rutas tomaban la PRIMERA, que la
 * escribe quien llama: un encabezado falso bastaba para esquivar el límite.
 *
 * Las IP de estas pruebas son de los rangos de documentación: no son de nadie.
 */

const REAL = "198.51.100.20";
const SALTOS = "192.0.2.10,192.0.2.20";

describe("FIX-005 · H5 · la IP del cliente detrás de App Hosting", () => {
  it("son dos los saltos de la infraestructura, medidos", () => {
    expect(SALTOS_DE_APP_HOSTING).toBe(2);
  });

  it("CF8 · con un valor falso delante, la real", () => {
    expect(ipDelCliente(`203.0.113.7,${REAL},${SALTOS}`)).toBe(REAL);
  });

  it("con varias falsas y espacios, la real", () => {
    expect(ipDelCliente(`203.0.113.7, 203.0.113.8 , ${REAL}, ${SALTOS}`)).toBe(REAL);
  });

  it("sin nada delante, la real", () => {
    expect(ipDelCliente(`${REAL},${SALTOS}`)).toBe(REAL);
  });

  it("con menos entradas de las esperadas no adivina: no hay IP", () => {
    expect(ipDelCliente(SALTOS)).toBeNull();
    expect(ipDelCliente("")).toBeNull();
    expect(ipDelCliente(null)).toBeNull();
  });
});

const sinComentarios = (fuente: string) =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leer = (ruta: string) => sinComentarios(fs.readFileSync(path.join(process.cwd(), ruta), "utf8"));

describe("FIX-005 · H5 · el cableado", () => {
  for (const ruta of ["src/app/api/lead/route.ts", "src/app/api/demo/route.ts"]) {
    it(`${ruta} cuenta la IP con ipDelCliente, no con la primera entrada`, () => {
      const fuente = leer(ruta);
      expect(fuente).toContain("ipDelCliente(");
      expect(fuente).not.toMatch(/split\(\s*","\s*\)\[0\]/);
    });
  }

  it("no queda ningún registro temporal de la medida", () => {
    const conMarca = [
      "src/app/api/lead/route.ts",
      "src/app/api/demo/route.ts",
      "functions/src/index.ts",
    ].filter((ruta) => leer(ruta).includes("fix005-h5"));
    expect(conMarca).toEqual([]);
  });
});
