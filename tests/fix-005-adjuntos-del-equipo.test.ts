import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { rutaDeAdjunto } from "@/features/support/ruta-de-adjunto";

/**
 * `PRD-V-FIX-005` · H3c — el equipo de Vivaru sube sus adjuntos a una carpeta neutra.
 *
 * La ruta `tenants/{t}/support/{uid}/…` viajaba en el hilo que lee el administrador del conjunto,
 * con el uid de quien subía. Decisión de David del 11 sep (opción A): el equipo sube a
 * `support/equipo/…`; el cliente, bajo su propio uid. `storage.rules` no cambia: `admin(tenantId)`
 * ya incluye al superadmin y le deja escribir en cualquier carpeta de soporte del conjunto.
 */

describe("FIX-005 · H3c · la ruta del adjunto", () => {
  it("el equipo sube a support/equipo/", () => {
    expect(rutaDeAdjunto("t-1", "uid-equipo", true, "captura.png", 123)).toBe(
      "tenants/t-1/support/equipo/123-captura.png",
    );
  });

  it("el cliente, bajo su propio uid, con el nombre limpio como hasta ahora", () => {
    expect(rutaDeAdjunto("t-1", "uid-cliente", false, "Foto 1.JPG", 123)).toBe(
      "tenants/t-1/support/uid-cliente/123-foto-1.jpg",
    );
  });
});

const leer = (ruta: string) =>
  fs
    .readFileSync(path.join(process.cwd(), ruta), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("FIX-005 · H3c · el cableado", () => {
  it("la subida arma la ruta con rutaDeAdjunto", () => {
    expect(leer("src/features/support/upload.ts")).toContain("rutaDeAdjunto(");
  });

  it("la consola del superadmin sube como equipo", () => {
    expect(leer("src/app/(superadmin)/superadmin/support/page.tsx")).toContain("{ comoEquipo: true }");
  });
});
