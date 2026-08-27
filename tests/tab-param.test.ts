import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { escribirTab, leerTab } from "../src/lib/navigation/tab-param";

/**
 * **Las pestañas en la URL (pasada 3 del corte de navegación).**
 *
 * El portal de administración tenía **cuatro barras de pestañas hechas a mano** —
 * `billing`, `settings`, `regulations`, `documents`— y ninguna dejaba rastro: no
 * se podía enlazar una pestaña, el botón «atrás» salía de la pantalla en vez de
 * volver a la anterior, y recargar devolvía siempre a la primera. Ninguna
 * declaraba `role="tablist"` ni `aria-selected`, así que para un lector de
 * pantalla eran botones sueltos.
 *
 * **La garantía que protege la funcionalidad, y la que más importa aquí: sin
 * parámetro en la URL, cada pantalla se comporta exactamente igual que antes.**
 */

const CLAVES = ["campaigns", "individuals", "byUnit"] as const;

describe("1 · leer la pestaña de la URL", () => {
  it("sin parámetro, el valor por defecto — la pantalla abre como abría", () => {
    expect(leerTab("", "lista", CLAVES, "campaigns")).toBe("campaigns");
    expect(leerTab("?otra=cosa", "lista", CLAVES, "campaigns")).toBe("campaigns");
  });

  it("con un valor conocido, ése", () => {
    expect(leerTab("?lista=byUnit", "lista", CLAVES, "campaigns")).toBe("byUnit");
  });

  it("un valor desconocido cae al defecto en vez de dejar la pantalla en blanco", () => {
    // La URL la escribe cualquiera: un enlace viejo, una pestaña renombrada,
    // alguien tecleando. Abrir por donde abre siempre es mejor que no abrir.
    expect(leerTab("?lista=inventada", "lista", CLAVES, "campaigns")).toBe("campaigns");
    expect(leerTab("?lista=", "lista", CLAVES, "campaigns")).toBe("campaigns");
  });

  it("no se confunde con otro parámetro que empiece igual", () => {
    expect(leerTab("?listado=byUnit", "lista", CLAVES, "campaigns")).toBe("campaigns");
  });

  it("convive con los parámetros de otros", () => {
    expect(leerTab("?folder=abc&lista=byUnit&x=1", "lista", CLAVES, "campaigns")).toBe("byUnit");
  });
});

describe("2 · escribir la pestaña en la URL", () => {
  it("la pestaña por defecto BORRA el parámetro", () => {
    // Si no, cada pantalla tendría dos direcciones para la misma vista.
    expect(escribirTab("?lista=byUnit", "lista", "campaigns", "campaigns")).toBe("");
  });

  it("cualquier otra lo escribe", () => {
    expect(escribirTab("", "lista", "byUnit", "campaigns")).toBe("?lista=byUnit");
  });

  it("conserva los parámetros que no son nuestros", () => {
    // `documents` llega con `?folder=` desde un enlace profundo: perderlo
    // mandaría al usuario a la raíz de las carpetas sin decir nada.
    expect(escribirTab("?folder=abc", "lista", "byUnit", "campaigns")).toBe("?folder=abc&lista=byUnit");
    expect(escribirTab("?folder=abc&lista=byUnit", "lista", "campaigns", "campaigns")).toBe("?folder=abc");
  });

  it("ida y vuelta: lo que se escribe es lo que se lee", () => {
    for (const clave of CLAVES) {
      const busqueda = escribirTab("?folder=abc", "lista", clave, "campaigns");
      expect(leerTab(busqueda, "lista", CLAVES, "campaigns")).toBe(clave);
    }
  });
});

describe("3 · ninguna pantalla vuelve a hacerse su propia barra", () => {
  /**
   * Había cuatro implementaciones en el admin y dos en el residente, con tres
   * estilos y **una sola de las seis accesible**. Ahora hay un componente
   * (`src/components/ui/tabs.tsx`) con los tres estilos que ya se pintaban, y
   * `role="tablist"` no puede volver a aparecer suelto en una pantalla.
   */
  const RAIZ = process.cwd();
  const PORTALES = ["src/app/(admin)", "src/app/(resident)", "src/app/(guard)", "src/app/(superadmin)"];

  function ficheros(): string[] {
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

  const PANTALLAS = ficheros();

  it("el barrido mira ficheros de verdad", () => {
    expect(PANTALLAS.length).toBeGreaterThan(40);
    expect(PANTALLAS).toContain("src/app/(admin)/admin/billing/page.tsx");
  });

  it("ninguna pantalla declara `role=\"tablist\"` por su cuenta", () => {
    const culpables = PANTALLAS.filter((rel) =>
      fs.readFileSync(path.resolve(RAIZ, rel), "utf8").includes('role="tablist"'),
    );
    expect(
      culpables,
      "Las pestañas salen de `@/components/ui/tabs`. Una barra a mano se queda sin " +
        "navegación por flechas y sin `aria-selected`, y no lleva la pestaña a la URL:\n" +
        culpables.join("\n"),
    ).toEqual([]);
  });

  it("las seis pantallas con pestañas usan el componente y llevan la pestaña a la URL", () => {
    const CON_PESTANAS = [
      "src/app/(admin)/admin/billing/page.tsx",
      "src/app/(admin)/admin/settings/page.tsx",
      "src/app/(admin)/admin/regulations/page.tsx",
      "src/app/(admin)/admin/documents/page.tsx",
      "src/app/(resident)/resident/pqrs/page.tsx",
      "src/app/(resident)/resident/reservations/page.tsx",
    ];
    for (const rel of CON_PESTANAS) {
      const texto = fs.readFileSync(path.resolve(RAIZ, rel), "utf8");
      expect(texto, `${rel} dejó de usar el componente`).toContain('from "@/components/ui/tabs"');
      expect(texto, `${rel} dejó de llevar su pestaña a la URL`).toContain("useTabParam(");
    }
  });

  it("el componente declara los roles que un lector de pantalla necesita", () => {
    // Sin esto el componente sería el mismo defecto, centralizado.
    //
    // **Se mira SOLO EL CÓDIGO, sin comentarios.** La primera versión de esta
    // prueba leía el fichero entero y pasaba en verde con el `aria-selected`
    // borrado: la cabecera del componente NOMBRA los tres atributos al explicar
    // qué les faltaba a las barras viejas, y eso ya satisfacía el `toContain`.
    // Un guardián que se conforma con su propia prosa no vigila nada. Lo cazó
    // falsar, no escribir — es la misma trampa que resuelve `soloCodigo` en
    // `clave-de-unidad-guarda.test.ts`.
    const texto = fs.readFileSync(path.resolve(RAIZ, "src/components/ui/tabs.tsx"), "utf8");
    const soloCodigo = texto
      .split("\n")
      .filter((linea) => !/^\s*(\/\/|\*|\/\*)/.test(linea))
      .join("\n");
    for (const marca of ['role="tablist"', 'role="tab"', "aria-selected", "aria-label"]) {
      expect(soloCodigo, `al componente le falta ${marca}`).toContain(marca);
    }
  });
});
