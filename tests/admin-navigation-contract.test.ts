import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ADMIN_SIDEBAR_GROUPS } from "../src/components/shared/admin-sidebar";
import { resolveActiveNavHref } from "../src/lib/navigation/active-item";

/**
 * **El guardián del contrato de navegación del portal de administración.**
 *
 * Es la pasada 0 del corte de navegación: no arregla nada: **fija lo que hoy ya
 * se cumple**, para que las cuatro pasadas siguientes —cabecera de página, menú
 * plegable, pestañas en la URL y partir Cartera— no puedan romperlo en silencio.
 *
 * Nace en verde a propósito. Un guardián que nace en rojo no es un guardián: es
 * una lista de tareas, y se acaba desactivando.
 *
 * Lo que vigila:
 *
 *   1. **Cobertura bidireccional.** Ninguna pantalla del admin queda sin entrada
 *      en el menú, y ninguna entrada del menú apunta a una pantalla que no
 *      existe. Las rutas se leen del árbol de `app/` con `readdirSync`, **no de
 *      una lista copiada**: una lista copiada sería un sitio más que mantener, y
 *      el catálogo de banderas ya enseñó lo que pasa cuando el mismo hecho vive
 *      en cinco ficheros.
 *   2. **Ítem activo único.** Cada ruta marca exactamente su entrada. El caso que
 *      importa es `/admin/finanzas` contra `/admin/finanzas/egresos` y
 *      `/admin/finanzas/conciliacion`: hoy funciona porque `resolveActiveNavHref`
 *      ordena por longitud, y eso es un detalle que se puede perder al refactorizar.
 *   3. **Una sola fuente de verdad.** `ADMIN_SIDEBAR_GROUPS` es la lista que se
 *      pinta. `roleNavigation.tenant_admin` **existe y no se renderiza nunca** —
 *      tiene diecisiete entradas distintas, sin Reportes ni Soporte—. Quien añada
 *      una entrada en la lista equivocada no vería nada en pantalla y no fallaría
 *      nada. Ahora sí falla.
 *   4. **La forma de los grupos.** La pasada 2 (menú plegable) da por hecho que el
 *      primer grupo no tiene etiqueta y que los demás sí. Si eso cambia, el menú
 *      se pliega mal.
 *
 * **Lo que NO vigila:** que el menú esté bien *ordenado* o bien *agrupado*. Eso es
 * criterio de producto y cambia; esto es el contrato mecánico.
 */

const RAIZ = process.cwd();

const APP_ADMIN = "src/app/(admin)";

function leer(rel: string): string {
  return fs.readFileSync(path.resolve(RAIZ, rel), "utf8");
}

/**
 * Las rutas reales del portal, deducidas del árbol de `app/` igual que las deduce
 * Next: un `page.tsx` es una ruta, y los **grupos de rutas** —los directorios
 * entre paréntesis, como `(admin)`— no aparecen en la URL.
 */
function rutasDeApp(dirRel: string): string[] {
  const salida: string[] = [];

  const visitar = (dir: string, url: string) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entrada.isDirectory()) {
        const esGrupo = entrada.name.startsWith("(") && entrada.name.endsWith(")");
        visitar(path.join(dir, entrada.name), esGrupo ? url : `${url}/${entrada.name}`);
      } else if (entrada.name === "page.tsx") {
        salida.push(url || "/");
      }
    }
  };

  visitar(path.resolve(RAIZ, dirRel), "");
  return salida.sort();
}

/**
 * Las rutas con segmento dinámico (`[id]`) quedan fuera de la cobertura: no
 * pueden ser una entrada de menú porque no tienen una dirección fija. Hoy el
 * portal de administración no tiene ninguna — las dos del producto están en el
 * portal del residente— y por eso el filtro se queda documentado y vacío.
 */
const RUTAS = rutasDeApp(APP_ADMIN).filter((r) => !r.includes("["));

const ITEMS = ADMIN_SIDEBAR_GROUPS.flatMap((grupo) => grupo.items);
const HREFS = ITEMS.map((item) => item.href);

/**
 * Pantallas que existen a propósito sin entrada en el menú. **Vacío hoy, y esa es
 * la noticia**: las 19 rutas y las 19 entradas coinciden exactamente en las dos
 * direcciones. Si alguna vez hay que añadir una, va aquí **con su porqué escrito**,
 * no borrando la prueba.
 */
const SIN_ENTRADA_A_PROPOSITO = new Set<string>([]);

// ─────────────────────────────────────────────────────────────────────────────

describe("1 · cobertura bidireccional entre rutas y menú", () => {
  it("el barrido encuentra rutas de verdad", () => {
    // Una puerta que se abre sobre un conjunto VACÍO no verifica nada: sin esto,
    // un `readdirSync` que dejara de encontrar ficheros daría todo en verde.
    expect(RUTAS.length).toBeGreaterThan(15);
    expect(RUTAS).toContain("/admin");
    expect(RUTAS).toContain("/admin/billing");
    expect(RUTAS).toContain("/admin/finanzas/conciliacion");
    expect(HREFS.length).toBeGreaterThan(15);
  });

  it("ninguna pantalla del admin se queda sin entrada en el menú", () => {
    const huerfanas = RUTAS.filter((ruta) => !HREFS.includes(ruta) && !SIN_ENTRADA_A_PROPOSITO.has(ruta));
    expect(
      huerfanas,
      "Estas pantallas existen y no se pueden alcanzar desde el menú. Añádelas a " +
        "ADMIN_SIDEBAR_GROUPS, o a SIN_ENTRADA_A_PROPOSITO con el porqué escrito:\n" +
        huerfanas.join("\n"),
    ).toEqual([]);
  });

  it("ninguna entrada del menú apunta a una pantalla que no existe", () => {
    const rotas = HREFS.filter((href) => !RUTAS.includes(href));
    expect(
      rotas,
      "Estas entradas del menú llevan a un 404. Es la forma silenciosa de romper " +
        "la navegación: el enlace se pinta igual:\n" + rotas.join("\n"),
    ).toEqual([]);
  });

  it("no hay dos entradas con la misma dirección", () => {
    // Dos entradas con el mismo `href` marcarían las dos como activas.
    expect(HREFS).toEqual([...new Set(HREFS)]);
  });

  it("toda entrada tiene etiqueta e icono", () => {
    for (const item of ITEMS) {
      expect(item.label.trim().length, `${item.href} sin etiqueta`).toBeGreaterThan(0);
      expect(item.icon, `${item.href} sin icono`).toBeTruthy();
    }
  });
});

describe("2 · cada ruta marca exactamente su entrada", () => {
  it("toda ruta del portal resuelve a su propia entrada", () => {
    for (const ruta of RUTAS) {
      if (!HREFS.includes(ruta)) continue;
      expect(resolveActiveNavHref(ruta, HREFS), `${ruta} marca la entrada equivocada`).toBe(ruta);
    }
  });

  it("las tres de finanzas no se pisan entre ellas", () => {
    // `/admin/finanzas` es prefijo de las otras dos: sin el orden por longitud,
    // estar en Egresos marcaría «Libro y fondos».
    expect(resolveActiveNavHref("/admin/finanzas", HREFS)).toBe("/admin/finanzas");
    expect(resolveActiveNavHref("/admin/finanzas/egresos", HREFS)).toBe("/admin/finanzas/egresos");
    expect(resolveActiveNavHref("/admin/finanzas/conciliacion", HREFS)).toBe("/admin/finanzas/conciliacion");
  });

  it("`/admin` no se traga todas las demás", () => {
    // Es prefijo de las diecinueve. Si el orden por longitud se pierde, el menú
    // marca «Panel de Control» en todas las pantallas del portal.
    expect(resolveActiveNavHref("/admin/pqrs", HREFS)).toBe("/admin/pqrs");
    expect(resolveActiveNavHref("/admin/residents", HREFS)).toBe("/admin/residents");
  });

  it("una sub-ruta más profunda marca su ancestro más cercano", () => {
    // Lo necesitará la pasada 1: una ficha de detalle debe marcar su lista.
    expect(resolveActiveNavHref("/admin/finanzas/egresos/xyz", HREFS)).toBe("/admin/finanzas/egresos");
  });

  it("la barra final no cambia la entrada marcada", () => {
    expect(resolveActiveNavHref("/admin/billing/", HREFS)).toBe("/admin/billing");
  });

  it("una ruta de fuera del portal no marca ninguna entrada", () => {
    // La pasada 1 tiene que pintar algo sensato aquí, no una migaja vacía.
    expect(resolveActiveNavHref("/resident/account", HREFS)).toBeUndefined();
  });
});

describe("3 · una sola fuente de verdad para el menú del admin", () => {
  /**
   * Había **dos** listas. `ADMIN_SIDEBAR_GROUPS` es la que se pinta;
   * `roleNavigation.tenant_admin` tenía diecisiete entradas distintas y no la
   * renderizaba nadie, porque el shell manda los roles de administración por
   * `buildAdminSidebarGroups`. Su único consumidor, `role-nav.tsx`, no estaba
   * montado en ningún sitio y se borró en esta pasada.
   *
   * `roleNavigation` **sigue viva y hace falta**: de ella salen los menús de
   * residente, portería, consejo y superadmin.
   */

  it("`role-nav.tsx` ya no existe", () => {
    expect(fs.existsSync(path.resolve(RAIZ, "src/components/shared/role-nav.tsx"))).toBe(false);
  });

  it("en `src/`, `roleNavigation` solo lo consume el constructor de menús por rol", () => {
    const consumidores: string[] = [];
    const visitar = (dir: string) => {
      for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const completo = path.join(dir, entrada.name);
        if (entrada.isDirectory()) {
          if (entrada.name === "node_modules" || entrada.name === ".next") continue;
          visitar(completo);
        } else if (/\.tsx?$/.test(entrada.name)) {
          const rel = path.relative(RAIZ, completo);
          if (rel.endsWith("src/lib/constants/navigation.ts")) continue;
          if (/import\s*\{[^}]*roleNavigation/.test(leer(rel))) consumidores.push(rel);
        }
      }
    };
    visitar(path.resolve(RAIZ, "src"));
    expect(
      consumidores.sort(),
      "El menú del admin sale de ADMIN_SIDEBAR_GROUPS. Si un componente nuevo lee " +
        "`roleNavigation` para pintar administración, pintará una lista que nadie mantiene.",
    ).toEqual(["src/lib/navigation/role-sidebar-groups.ts"]);
  });

  it("el layout de administración entra al shell como `tenant_admin`", () => {
    // Es lo que hace `isAdminRole` verdadero y, con él, lo que manda el menú por
    // `buildAdminSidebarGroups` en vez de por `buildRoleSidebarGroups`.
    expect(leer("src/app/(admin)/admin/layout.tsx")).toContain('role="tenant_admin"');
  });

  it("el shell pinta el admin con `buildAdminSidebarGroups`", () => {
    const shell = leer("src/components/shared/app-shell.tsx");
    expect(shell).toContain("const isAdminRole = role === \"tenant_admin\" || role === \"admin_tenant\"");
    expect(shell).toContain("buildAdminSidebarGroups(");
  });
});

describe("4 · la forma de los grupos, que la pasada 2 da por hecha", () => {
  it("el primer grupo no lleva etiqueta y los demás sí", () => {
    // El menú plegable pliega por etiqueta: el primer grupo —Panel de Control—
    // es el que queda siempre fijo, y lo es por no tener etiqueta.
    const [primero, ...resto] = ADMIN_SIDEBAR_GROUPS;
    expect(primero.label).toBeUndefined();
    for (const grupo of resto) {
      expect(grupo.label, "un grupo sin etiqueta en medio no se puede plegar").toBeTruthy();
    }
  });

  it("ningún grupo está vacío", () => {
    for (const grupo of ADMIN_SIDEBAR_GROUPS) {
      expect(grupo.items.length, `el grupo ${grupo.label ?? "(sin etiqueta)"} está vacío`).toBeGreaterThan(0);
    }
  });

  it("las etiquetas de grupo no se repiten", () => {
    // La pasada 2 guarda el estado plegado en `localStorage` con la etiqueta como
    // clave: dos grupos con el mismo nombre se plegarían juntos.
    const etiquetas = ADMIN_SIDEBAR_GROUPS.map((g) => g.label).filter(Boolean);
    expect(etiquetas).toEqual([...new Set(etiquetas)]);
  });
});
