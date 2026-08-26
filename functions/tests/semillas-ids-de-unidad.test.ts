import { describe, expect, it } from "vitest";

import { TENANT_CO, UNITS_CO } from "../scripts/seed-data-co.mjs";
import { TENANT_MX, UNITS_MX } from "../scripts/seed-data-mx.mjs";
import { TENANT_PLAYAS, UNITS_PLAYAS } from "../scripts/seed-data-playas.mjs";

/**
 * **`units` es una colección RAÍZ: el id de documento es global.**
 *
 * No vive dentro del conjunto, así que dos semillas que declaren el mismo id no
 * crean dos unidades — se pelean por UN documento, y gana la que siembre última.
 * A la otra le desaparecen del mapa sin ningún error.
 *
 * Pasó, y estuvo así desde el 10 de mayo de 2026 en LOS DOS ambientes con las
 * mismas cinco unidades: `seed-data-co.mjs` y `seed-data-playas.mjs` declaraban
 * `t1-101`, `t1-102`, `t2-201`, `t2-202` y `t2-204`. Ganó Las Playas. El Nogal se
 * quedó con quince documentos huérfanos —cargos, paquetes, reservas, pases,
 * personas y **la membresía de `juan.herrera@elnogal.co`**, que por eso abría su
 * portal y no veía absolutamente nada—.
 *
 * Lo encontró `PRD-V-FIX-002` por la puerta de atrás: el informe dejaba el
 * conjunto en BLOQUEADO y el script de reparación reventó con `ALREADY_EXISTS`
 * sobre un documento que la consulta por `tenantId` no devolvía. **Ese
 * `ALREADY_EXISTS` era el hallazgo**, no el fallo.
 *
 * `trial-seed.ts` ya sabía esto —prefija todo con `${tenantId}--` y su cabecera
 * explica por qué—; las semillas demo no.
 */

const SEMILLAS = [
  { fichero: "seed-data-co.mjs", tenantId: TENANT_CO.id, unidades: UNITS_CO },
  { fichero: "seed-data-mx.mjs", tenantId: TENANT_MX.id, unidades: UNITS_MX },
  { fichero: "seed-data-playas.mjs", tenantId: TENANT_PLAYAS.id, unidades: UNITS_PLAYAS },
] as Array<{ fichero: string; tenantId: string; unidades: Array<{ id: string; unitId: string; displayName: string }> }>;

describe("los ids de unidad que declaran las semillas", () => {
  it("hay unidades que contar, o esta prueba no vale nada", () => {
    for (const s of SEMILLAS) {
      expect(s.unidades.length, `${s.fichero} no declara ninguna unidad`).toBeGreaterThan(5);
      expect(s.tenantId, `${s.fichero} no declara conjunto`).toBeTruthy();
    }
  });

  it("NINGÚN id de documento se repite entre dos semillas — se pelearían por el mismo documento", () => {
    const dueño = new Map<string, string>();
    const choques: string[] = [];
    for (const s of SEMILLAS) {
      for (const u of s.unidades) {
        const previo = dueño.get(u.id);
        if (previo) choques.push(`units/${u.id}: ${previo} y ${s.fichero}`);
        else dueño.set(u.id, s.fichero);
      }
    }
    expect(
      choques,
      "Dos semillas declaran el mismo documento de `units`. Gana la que siembre última y a la " +
        "otra le desaparecen esas unidades, dejando sus cargos y su membresía huérfanos. " +
        "Prefija el id con algo del conjunto, como hace `trial-seed.ts`:\n" + choques.join("\n"),
    ).toEqual([]);
  });

  it("ningún id se repite DENTRO de una misma semilla", () => {
    for (const s of SEMILLAS) {
      const ids = s.unidades.map((u) => u.id);
      expect(new Set(ids).size, `${s.fichero} declara ids repetidos`).toBe(ids.length);
    }
  });

  it("el campo `unitId` SÍ puede repetirse entre conjuntos, y es correcto que pueda", () => {
    // Es un campo dentro de un documento que ya está separado por `tenantId`, no
    // un id global. `t1-101` como slug de El Nogal y de Las Playas a la vez no
    // choca con nada — confundir las dos cosas es lo que causó esto.
    const slugs = SEMILLAS.flatMap((s) => s.unidades.map((u) => u.unitId));
    expect(slugs.length).toBeGreaterThan(new Set(slugs).size);
  });

  it("El Nogal conserva sus cinco etiquetas: el arreglo cambió el id, no la unidad", () => {
    const etiquetas = UNITS_CO.map((u: { displayName: string }) => u.displayName);
    for (const e of ["T1-101", "T1-102", "T2-201", "T2-202", "T2-204"]) {
      expect(etiquetas, `El Nogal perdió ${e} al renombrar`).toContain(e);
    }
    expect(UNITS_CO).toHaveLength(20);
  });
});
