import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ADMIN_SIDEBAR_GROUPS } from "../src/components/shared/admin-sidebar";
import { resolvePageIdentity } from "../src/lib/navigation/page-identity";
import { buildRoleSidebarGroups } from "../src/lib/navigation/role-sidebar-groups";

/**
 * **La cabecera de página (pasada 1 del corte de navegación).**
 *
 * Antes de esto, el título de la cabecera era constante *por rol*: el residente
 * leía «Portal del Residente» en sus doce pantallas y el administrador no tenía
 * cabecera en escritorio. Solo cinco de las diecinueve pantallas del admin se
 * nombraban a sí mismas.
 *
 * Lo que se prueba aquí es que el nombre **sale del menú y no de una lista
 * nueva** — y, sobre todo, que la regla del grupo es derivada y no una lista de
 * excepciones por rol: **el grupo se muestra solo cuando hay más de uno**.
 */

const RESIDENTE = buildRoleSidebarGroups("resident");
const PORTERIA = buildRoleSidebarGroups("security_guard");
const SUPERADMIN = buildRoleSidebarGroups("superadmin");

describe("1 · el administrador, que tiene seis grupos", () => {
  it("nombra la pantalla y su grupo", () => {
    expect(resolvePageIdentity("/admin/billing", ADMIN_SIDEBAR_GROUPS)).toEqual({
      group: "Financiero",
      title: "Cartera",
    });
  });

  it("capitaliza la etiqueta del menú sin perder la tilde", () => {
    // En el menú se guardan en mayúsculas porque así se pintan en la lateral.
    // En una migaja eso grita, y `CONFIGURACIÓN` en minúsculas debe conservar la Ó.
    expect(resolvePageIdentity("/admin/soporte", ADMIN_SIDEBAR_GROUPS)).toEqual({
      group: "Configuración",
      title: "Soporte",
    });
  });

  it("el Panel de Control no lleva grupo, porque su grupo no tiene etiqueta", () => {
    expect(resolvePageIdentity("/admin", ADMIN_SIDEBAR_GROUPS)).toEqual({
      title: "Panel de Control",
    });
  });

  it("distingue las tres pantallas de finanzas entre ellas", () => {
    expect(resolvePageIdentity("/admin/finanzas", ADMIN_SIDEBAR_GROUPS)?.title).toBe("Libro y fondos");
    expect(resolvePageIdentity("/admin/finanzas/egresos", ADMIN_SIDEBAR_GROUPS)?.title).toBe("Egresos");
    expect(resolvePageIdentity("/admin/finanzas/conciliacion", ADMIN_SIDEBAR_GROUPS)?.title).toBe("Conciliación");
  });

  it("toda pantalla del admin tiene nombre, y es el que dice el menú", () => {
    // Sin esto, una entrada nueva podría dejar su pantalla sin cabecera y nadie
    // lo vería hasta tenerla delante.
    for (const grupo of ADMIN_SIDEBAR_GROUPS) {
      for (const item of grupo.items) {
        const identidad = resolvePageIdentity(item.href, ADMIN_SIDEBAR_GROUPS);
        expect(identidad, `${item.href} se quedó sin identidad`).not.toBeNull();
        expect(identidad?.title).toBe(item.label);
      }
    }
  });
});

describe("2 · los roles de un solo grupo no repiten el grupo", () => {
  /**
   * Decisión de David, 27 de agosto de 2026: en el portal del residente la
   * migaja lleva **solo el nombre de la pantalla**. La regla que lo implementa es
   * derivada —«el grupo se muestra si hay más de uno»— y no una excepción escrita
   * por rol: el día que el residente tenga dos grupos, la migaja aparece sola.
   */

  it("el residente tiene un solo grupo", () => {
    // Si esto deja de ser cierto, la regla de abajo cambia de comportamiento y
    // hay que decidirlo a propósito, no descubrirlo.
    expect(RESIDENTE.filter((g) => g.label)).toHaveLength(1);
  });

  it("el residente ve solo el nombre de la pantalla", () => {
    expect(resolvePageIdentity("/resident/account", RESIDENTE)).toEqual({ title: "Estado de cuenta" });
    expect(resolvePageIdentity("/resident", RESIDENTE)).toEqual({ title: "Inicio" });
  });

  it("la portería tampoco lleva grupo", () => {
    expect(resolvePageIdentity("/guard/visitors", PORTERIA)).toEqual({ title: "Visitantes" });
  });

  it("el superadmin tampoco", () => {
    expect(resolvePageIdentity("/superadmin/tenants", SUPERADMIN)).toEqual({ title: "Tenants" });
  });

  it("ninguna pantalla del residente lleva `MI EDIFICIO` delante", () => {
    for (const grupo of RESIDENTE) {
      for (const item of grupo.items) {
        expect(resolvePageIdentity(item.href, RESIDENTE)?.group, `${item.href} arrastra el grupo`).toBeUndefined();
      }
    }
  });
});

describe("3 · las rutas que no son del menú", () => {
  it("una ruta de otro portal no inventa nombre", () => {
    // Devolver algo aquí sería peor que no devolver nada: quien llama tiene que
    // caer en el título del layout, que es constante pero honesto.
    expect(resolvePageIdentity("/resident/account", ADMIN_SIDEBAR_GROUPS)).toBeNull();
    expect(resolvePageIdentity("/", ADMIN_SIDEBAR_GROUPS)).toBeNull();
  });

  it("una ficha de detalle hereda el nombre de su lista", () => {
    // `/resident/visitors/[id]` no está en el menú. Decir «Visitantes» es cierto
    // —es la sección en la que estás— y es lo que marca el menú lateral.
    expect(resolvePageIdentity("/resident/visitors/abc123", RESIDENTE)).toEqual({ title: "Visitantes" });
    expect(resolvePageIdentity("/resident/visitors/abc123/qr", RESIDENTE)).toEqual({ title: "Visitantes" });
  });

  it("la barra final no cambia el nombre", () => {
    expect(resolvePageIdentity("/admin/pqrs/", ADMIN_SIDEBAR_GROUPS)?.title).toBe("PQRS");
  });
});

describe("4 · el `h1` es del shell, y solo hay uno por pantalla", () => {
  /**
   * **El defecto que esta guarda evita ya ocurrió, y lo cazó el navegador, no la
   * suite.** Al montar `PageHeader` aparecieron ONCE `<h1>` propios repartidos
   * por las páginas: seis se volvieron duplicados ese mismo día y **cinco ya lo
   * estaban desde antes** —el residente y el superadmin siempre tuvieron un `h1`
   * en la cabecera del shell—. En pantalla se leía «Usuarios» dos veces
   * separadas por 45 px.
   *
   * Dos encabezados de nivel 1 en una pantalla no son solo fealdad: para quien
   * navega con lector de pantalla, el `h1` es el ancla que dice dónde está.
   *
   * Ninguna prueba podía verlo: todas miraban datos y lógica, y esto es
   * estructura. Ahora sí.
   */
  const RAIZ = process.cwd();

  const PORTALES = ["src/app/(admin)", "src/app/(resident)", "src/app/(guard)", "src/app/(superadmin)"];

  function paginas(): string[] {
    const salida: string[] = [];
    const visitar = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const completo = path.join(dir, entrada.name);
        if (entrada.isDirectory()) visitar(completo);
        else if (/\.tsx$/.test(entrada.name)) salida.push(path.relative(RAIZ, completo));
      }
    };
    for (const portal of PORTALES) visitar(path.resolve(RAIZ, portal));
    return salida.sort();
  }

  const PAGINAS = paginas();

  it("el barrido mira ficheros de verdad", () => {
    // Una puerta que se abre sobre un conjunto vacío no verifica nada.
    expect(PAGINAS.length).toBeGreaterThan(40);
    expect(PAGINAS).toContain("src/app/(admin)/admin/users/page.tsx");
  });

  it("ninguna pantalla de los cuatro portales pinta su propio `h1`", () => {
    const culpables = PAGINAS.filter((rel) => /<h1[\s>]/.test(fs.readFileSync(path.resolve(RAIZ, rel), "utf8")));
    expect(
      culpables,
      "El `h1` de una pantalla lo pone el shell (`PageHeader` en escritorio, la " +
        "cabecera superior en el resto), y sale del nombre que ya tiene en el menú. " +
        "Un `<h1>` aquí es el nombre dos veces y dos anclas para el lector de " +
        "pantalla. Usa `<h2>` para un encabezado de sección:\n" + culpables.join("\n"),
    ).toEqual([]);
  });
});

describe("5 · el grupo aparece solo si hay más de uno", () => {
  it("con dos grupos etiquetados, sale el grupo", () => {
    const dos = [
      { label: "UNO", items: [{ href: "/a", label: "A", icon: (() => null) as never }] },
      { label: "DOS", items: [{ href: "/b", label: "B", icon: (() => null) as never }] },
    ];
    expect(resolvePageIdentity("/b", dos)).toEqual({ group: "Dos", title: "B" });
  });

  it("con uno solo, no sale", () => {
    const uno = [{ label: "UNO", items: [{ href: "/a", label: "A", icon: (() => null) as never }] }];
    expect(resolvePageIdentity("/a", uno)).toEqual({ title: "A" });
  });
});
