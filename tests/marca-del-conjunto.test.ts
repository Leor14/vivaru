import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **Quien escribe la marca y quien la lee tienen que apuntar a la misma
 * colección (27 de agosto de 2026).**
 *
 * El residente nunca vio la marca de su conjunto. El administrador la guardaba
 * en `tenantSettings` y `ResidentHeader` la leía de `tenants` — dos colecciones
 * distintas, con nombres parecidos, en dos árboles distintos del repositorio
 * (`src/` y el duplicado de la RAÍZ).
 *
 * **Y no era un descuido que se arreglara escribiendo también en `tenants`:**
 * esa colección es solo-superadmin por `firestore.rules`, así que el
 * administrador no puede escribir ahí ni queriendo. La lectura estaba en el
 * sitio equivocado por construcción.
 *
 * **Se manifestaba sin error.** `getDoc` de un documento que no existe no
 * lanza: devuelve `exists() === false`, la función devolvía `null` y la
 * cabecera caía a su gris por defecto. Todos los conjuntos se veían iguales y
 * nadie podía notar que el color configurado no llegaba.
 *
 * Esta prueba no vigila la función: vigila **el acuerdo entre los dos lados**.
 */

const RAIZ = process.cwd();

const ESCRIBE = "src/features/admin/services.ts";
const LEE = "features/tenants/services.ts";
const CABECERA = "components/shared/ResidentHeader.tsx";
const ESQUEMA = "src/features/admin/schemas.ts";
const REGLAS = "firestore.rules";

function leer(rel: string): string {
  return fs.readFileSync(path.resolve(RAIZ, rel), "utf8");
}

/** Los campos que forman la marca de un conjunto. */
const CAMPOS = ["brandColor", "logoUrl"];

describe("1 · los dos lados apuntan a la misma colección", () => {
  it("el administrador escribe la marca en `tenantSettings`", () => {
    expect(leer(ESCRIBE)).toContain('"tenantSettings"');
  });

  it("los campos de la marca son los que declara su esquema", () => {
    /**
     * **Se mira el ESQUEMA y no `services.ts`.** La primera versión de esta
     * prueba hacía `expect(services).toContain("logoUrl")` sobre un fichero de
     * dos mil líneas: eso se cumple con cualquier mención de la palabra, así que
     * pasaba en verde aunque el formulario dejara de guardarlo. Lo cazó falsar.
     * `tenantBrandingSchema` es la superficie pequeña donde el campo o está o
     * no está.
     */
    const esquema = leer(ESQUEMA);
    const bloque = esquema.slice(
      esquema.indexOf("export const tenantBrandingSchema"),
      esquema.indexOf("export type TenantBrandingInput"),
    );
    expect(bloque.length, "no encuentro el esquema de la marca").toBeGreaterThan(150);
    for (const campo of CAMPOS) {
      expect(bloque, `el esquema de la marca ya no declara ${campo}`).toContain(`${campo}:`);
    }
  });

  it("el residente la lee de `tenantSettings`, no de `tenants`", () => {
    const texto = leer(LEE);
    expect(texto).toContain('doc(db, "tenantSettings", tenantId)');
    // El fallo original, escrito para que no vuelva:
    expect(
      texto,
      "leer de `tenants` deja al residente sin la marca de su conjunto: el " +
        "administrador no puede escribir ahí (regla solo-superadmin) y `getDoc` " +
        "de un documento inexistente NO lanza, así que el defecto es silencioso.",
    ).not.toContain('doc(db, "tenants", tenantId)');
  });

  it("y lee los mismos campos que se escriben", () => {
    const texto = leer(LEE);
    for (const campo of CAMPOS) {
      expect(texto, `la lectura no contempla ${campo}`).toContain(campo);
    }
  });
});

describe("2 · las reglas explican por qué la lectura tenía que mudarse", () => {
  const reglas = leer(REGLAS);

  it("`tenants` solo la escribe el superadmin", () => {
    const bloque = reglas.slice(reglas.indexOf("match /tenants/{tenantId}"));
    expect(bloque.slice(0, 220)).toMatch(/allow create, update, delete:\s*if superadmin\(\)/);
  });

  it("`tenantSettings` sí la puede LEER cualquier miembro del conjunto", () => {
    // Es lo que hace posible el arreglo: si la lectura fuese solo-admin, el
    // residente recibiría permission-denied en vez de la marca.
    const bloque = reglas.slice(reglas.indexOf("match /tenantSettings/{tenantId}"));
    expect(bloque.slice(0, 200)).toMatch(/allow read:\s*if signedIn\(\) && sameTenant\(tenantId\)/);
  });
});

describe("3 · la cabecera del residente sigue montada y degradando bien", () => {
  it("se monta en el layout del residente", () => {
    const layout = leer("src/app/(resident)/resident/layout.tsx");
    expect(layout).toContain("<ResidentHeader");
  });

  it("tiene un color por defecto para cuando el conjunto no configuró ninguno", () => {
    // Degradar es correcto; lo que estaba mal era degradar SIEMPRE.
    expect(leer(CABECERA)).toMatch(/branding\?\.color \|\| "#[0-9a-fA-F]{6}"/);
  });
});
