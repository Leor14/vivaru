import { describe, expect, it } from "vitest";

import { ADMIN_SIDEBAR_GROUPS, type AdminSidebarGroup } from "../src/components/shared/admin-sidebar";
import { debePlegarse, pendientesDelGrupo } from "../src/lib/navigation/sidebar-collapse";

/**
 * **El menú plegable (pasada 2 del corte de navegación).**
 *
 * El problema medido: a 671 px de alto útil solo se veían **siete de las
 * diecinueve** entradas del admin. La lateral tiene su propio scroll anidado y
 * nada avisaba de que hubiera más abajo, así que Financiero, Reportes y
 * Configuración quedaban fuera de la vista.
 *
 * De todo lo que hace la pasada —plegar, apretar la densidad, pintar el
 * degradado— solo dos cosas pueden romper algo **en silencio**, y son las dos que
 * se prueban aquí. Lo demás se ve al mirar la pantalla; esto no.
 */

const grupo = (label: string | undefined, hrefs: string[]): AdminSidebarGroup => ({
  label,
  items: hrefs.map((href) => ({ href, label: href, icon: (() => null) as never })),
});

describe("1 · el grupo de la pantalla actual nunca se pliega", () => {
  /**
   * Si se plegara, el ítem marcado desaparecería del menú y con él la única
   * señal de dónde estás — el defecto que esta pasada viene a arreglar,
   * reintroducido por la puerta de atrás.
   */

  it("un grupo guardado como plegado se pliega si no contiene el ítem activo", () => {
    expect(debePlegarse("FINANCIERO", false, { FINANCIERO: true })).toBe(true);
  });

  it("pero NO se pliega si contiene el ítem activo", () => {
    expect(debePlegarse("FINANCIERO", true, { FINANCIERO: true })).toBe(false);
  });

  it("un grupo sin etiqueta no se pliega nunca", () => {
    // Es el primero, el del Panel de Control: queda siempre a la vista.
    //
    // **El caso tiene que llevar la clave literal `"undefined"`**, y no un mapa
    // vacío. Con `{}` la prueba pasaba igual CON la guarda y SIN ella —
    // `guardado[undefined]` ya devuelve `undefined`— así que no distinguía el
    // código bueno del roto, que es lo mismo que no probar nada. Lo cazó falsar,
    // no escribir: la mutación que borra la guarda dejaba todo en verde.
    expect(debePlegarse(undefined, false, {})).toBe(false);
    expect(debePlegarse(undefined, false, { undefined: true })).toBe(false);
  });

  it("sin nada guardado, todo abierto — que es como estaba antes", () => {
    expect(debePlegarse("FINANCIERO", false, {})).toBe(false);
  });

  it("con TODOS los grupos plegados, el de la pantalla actual sigue abierto", () => {
    // La falsación que pedía el plan, escrita como prueba: plegar todo y
    // comprobar que la pantalla en la que estás sigue alcanzable.
    const todosPlegados = Object.fromEntries(
      ADMIN_SIDEBAR_GROUPS.filter((g) => g.label).map((g) => [g.label!, true]),
    );
    const abiertos = ADMIN_SIDEBAR_GROUPS.filter((g, i) => {
      const contieneActivo = g.items.some((item) => item.href === "/admin/billing");
      return i === 0 || !debePlegarse(g.label, contieneActivo, todosPlegados);
    });
    // Queda abierto el primero (sin etiqueta) y el que contiene Cartera.
    expect(abiertos.map((g) => g.label)).toEqual([undefined, "FINANCIERO"]);
  });
});

describe("2 · los pendientes de un grupo plegado suben a su cabecera", () => {
  /**
   * Sin esto, plegar «Operativo» escondería los PQRS sin atender **sin decirlo**,
   * y un distintivo existe precisamente para no tener que abrir nada.
   */

  it("suma los de todas sus entradas", () => {
    const g = grupo("OPERATIVO", ["/a", "/b", "/c"]);
    const badges = {
      "/a": { count: 3, tone: "amber" as const },
      "/c": { count: 2, tone: "amber" as const },
    };
    expect(pendientesDelGrupo(g, badges)).toEqual({ count: 5, tone: "amber" });
  });

  it("un solo rojo tiñe de rojo el del grupo", () => {
    // Un pendiente urgente no se degrada por viajar con otros que no lo son.
    const g = grupo("OPERATIVO", ["/a", "/b"]);
    const badges = {
      "/a": { count: 1, tone: "red" as const },
      "/b": { count: 9, tone: "amber" as const },
    };
    expect(pendientesDelGrupo(g, badges)).toEqual({ count: 10, tone: "red" });
  });

  it("sin pendientes devuelve cero, y con cero no se pinta nada", () => {
    expect(pendientesDelGrupo(grupo("OPERATIVO", ["/a"]), {})).toEqual({ count: 0, tone: "amber" });
    expect(pendientesDelGrupo(grupo("OPERATIVO", ["/a"]), undefined)).toEqual({ count: 0, tone: "amber" });
  });

  it("los dos grupos que llevan distintivos hoy quedan cubiertos", () => {
    // PQRS y Paquetería son los únicos con badge, y los dos están en OPERATIVO:
    // es exactamente el grupo que más se va a plegar por estar en medio.
    const operativo = ADMIN_SIDEBAR_GROUPS.find((g) => g.label === "OPERATIVO");
    expect(operativo, "el grupo OPERATIVO cambió de nombre").toBeTruthy();
    const hrefs = operativo!.items.map((i) => i.href);
    expect(hrefs).toContain("/admin/pqrs");
    expect(hrefs).toContain("/admin/packages");
    expect(
      pendientesDelGrupo(operativo!, {
        "/admin/pqrs": { count: 4, tone: "red" },
        "/admin/packages": { count: 7, tone: "amber" },
      }),
    ).toEqual({ count: 11, tone: "red" });
  });
});
