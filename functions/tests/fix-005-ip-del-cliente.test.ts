import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ipQueAnadioGoogle } from "../src/ip-del-cliente";

/**
 * `PRD-V-FIX-005` · H5 / R7 — la IP de un límite es la que añade la infraestructura, no la que
 * manda el cliente.
 *
 * Medido en staging el 12 sep, con una llamada a `createTrialWorkspace` que traía un
 * `X-Forwarded-For` falso: la callable recibe «lo que mandó el cliente, la IP que vio Google» —el
 * valor falso delante y la IP real añadida AL FINAL—, y `request.rawRequest.ip` devuelve **la
 * falsa**, porque Express se fía del primer valor. La buena es la ÚLTIMA.
 */

describe("FIX-005 · H5 · la IP que añadió Google en una callable", () => {
  it("con un valor falso delante, la última", () => {
    expect(ipQueAnadioGoogle("203.0.113.7,198.51.100.20")).toBe("198.51.100.20");
  });

  it("con espacios y varias falsas, la última", () => {
    expect(ipQueAnadioGoogle("192.0.2.1, 192.0.2.2 , 198.51.100.20")).toBe("198.51.100.20");
  });

  it("sin nada delante, esa misma", () => {
    expect(ipQueAnadioGoogle("198.51.100.20")).toBe("198.51.100.20");
  });

  it("sin cabecera, o vacía, no hay IP: el límite por IP no se aplica y el del correo sí", () => {
    expect(ipQueAnadioGoogle(undefined)).toBeNull();
    expect(ipQueAnadioGoogle("")).toBeNull();
    expect(ipQueAnadioGoogle(" , ")).toBeNull();
  });

  it("una cabecera repetida llega como lista: cuenta la última de la última", () => {
    expect(ipQueAnadioGoogle(["203.0.113.7", "192.0.2.1,198.51.100.20"])).toBe("198.51.100.20");
  });
});

const sinComentarios = (fuente: string) =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const SRC = path.resolve(__dirname, "../src");

describe("FIX-005 · H5 · el cableado", () => {
  it("createTrialWorkspace le pasa al alta la IP que añadió Google", () => {
    const index = sinComentarios(fs.readFileSync(path.join(SRC, "index.ts"), "utf8"));
    const inicio = index.indexOf("export const createTrialWorkspace = onCall");
    expect(inicio).toBeGreaterThan(-1);
    const cuerpo = index.slice(inicio, index.indexOf("\nexport const ", inicio + 1));
    expect(cuerpo).toContain('ipQueAnadioGoogle(request.rawRequest.headers["x-forwarded-for"])');
  });

  // `rawRequest.ip` devuelve el valor que manda el cliente: ningún límite puede apoyarse en él.
  it("ninguna function lee rawRequest.ip", () => {
    const conIp = fs
      .readdirSync(SRC)
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => /rawRequest\.ip\b/.test(sinComentarios(fs.readFileSync(path.join(SRC, f), "utf8"))));
    expect(conIp).toEqual([]);
  });
});
