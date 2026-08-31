import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * **El espejo del inventario de referencias a persona, comparado como TEXTO.**
 *
 * `PRD-V-FEAT-005`. El original vive en `functions/src/` y su copia en `src/`, y **no se pueden
 * importar la una a la otra**: `src/` no puede importar `functions/` sin romper el `next build`.
 * Así que se comparan leyendo los dos ficheros, igual que
 * `functions/tests/notification-catalog-espejo.test.ts` — que existe porque aquel catálogo
 * llevaba desde siempre diciendo «las cadenas deben mantenerse en sincronía» y **nada lo
 * comprobaba**.
 *
 * **Qué protege, exactamente:** el servidor barre con SU lista y aborta ante lo desconocido, así
 * que una divergencia no puede dejar huérfanos. Lo que sí puede es que la vista previa diga «se
 * moverán 3 referencias» y se muevan 5 — un número que el administrador usa para decidir si
 * confirma. Un número mal en esa pantalla es peor que ninguno.
 */

const SERVIDOR = "functions/src/referencias-a-persona.ts";
const CLIENTE = "src/features/residents/referencias-a-persona.ts";

/** Saca los pares `coleccion.campo[]` de la lista, sin depender del formato del resto. */
function inventario(ruta: string): string[] {
  const texto = readFileSync(ruta, "utf-8");
  const desde = texto.indexOf("REFERENCIAS_A_PERSONA: ReferenciaAPersona[] = [");
  expect(desde, `no encuentro la lista en ${ruta}`).toBeGreaterThan(-1);
  const bloque = texto.slice(desde, texto.indexOf("];", desde));
  return [...bloque.matchAll(/\{\s*coleccion:\s*"([^"]+)",\s*campo:\s*"([^"]+)"([^}]*)\}/g)]
    .map((m) => `${m[1]}.${m[2]}${/esLista:\s*true/.test(m[3]) ? "[]" : ""}`)
    .sort();
}

describe("el inventario de referencias a persona vive en dos sitios", () => {
  const delServidor = inventario(SERVIDOR);
  const delCliente = inventario(CLIENTE);

  it("el extractor encuentra algo, o esta prueba no vale nada", () => {
    // Sin esto, un cambio de formato dejaría las dos listas vacías y el espejo pasaría en verde
    // sin haber comparado nada. Es el defecto que ya nació dos veces en este repositorio.
    expect(delServidor.length).toBeGreaterThanOrEqual(5);
  });

  it("dicen exactamente lo mismo — si cambias una, cambia la otra", () => {
    expect(delCliente).toEqual(delServidor);
  });

  it("y cubren listas, no solo campos escalares", () => {
    // La trampa que ya mordió al escribir la ficha: buscar campos escalares dijo que ninguno de
    // los siete «David Carmona» estaba referenciado, y dos lo estaban desde `units.ownerIds`.
    expect(delServidor.some((x) => x.endsWith("[]"))).toBe(true);
  });

  it("incluyen los dos campos de `packages` que ningún nombre delata", () => {
    // `deliveredToId` y `receivedBy` no se llaman como una referencia a persona y llevaban siete
    // cada uno en producción. Un inventario escrito leyendo nombres habría repuntado 29 de 43.
    expect(delServidor).toContain("packages.deliveredToId");
    expect(delServidor).toContain("packages.receivedBy");
  });

  it("y NO incluyen `tickets.residentId`, que lleva un uid y no una persona", () => {
    expect(delServidor).not.toContain("tickets.residentId");
    expect(readFileSync(SERVIDOR, "utf-8")).toContain("NO_SON_REFERENCIA_A_PERSONA");
  });
});
