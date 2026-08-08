// tests/landing-contract.test.ts
// Red mínima del landing durante el rediseño (docs/plan-rediseno-landing.md).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Esto NO es un test de render: el entorno de vitest es `node` y el proyecto no
 * tiene jsdom ni testing-library. Montar ese stack para el rediseño sería
 * desproporcionado, así que este archivo cubre el riesgo concreto que sí puede
 * romperse en silencio: **perder la instrumentación al reescribir el marcado**.
 *
 * Un evento borrado no falla el typecheck, no rompe la página y no se nota
 * hasta que alguien mira el embudo semanas después. Leer el fuente y exigir que
 * la llamada siga ahí es tosco, pero detecta exactamente eso.
 *
 * Si algún día se añade jsdom, esto se sustituye por pruebas de render de
 * verdad y este archivo se borra sin pena.
 */

const RAIZ = join(__dirname, "..");
const leer = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");
const marketing = (archivo: string) => leer(`src/components/marketing/${archivo}`);

describe("analítica del landing", () => {
  // Los cinco eventos que viven en secciones que el rediseño toca.
  // Ver R3 del plan. Si un incremento los pierde, el embudo deja de medirse.
  const EVENTOS: Array<[string, string]> = [
    ["FAQ.tsx", "faq_open"],
    ["Perspectives.tsx", "perspective_tab_change"],
    ["FinalCTA.tsx", "cta_primary_view"],
    ["FinalCTA.tsx", "cta_secondary_click"],
    ["Topbar.tsx", "cta_login_click"],
  ];

  it.each(EVENTOS)("%s conserva el evento %s", (archivo, evento) => {
    expect(marketing(archivo)).toContain(`track("${evento}"`);
  });

  it("faq_open sigue mandando question_id", () => {
    // Sin el identificador el evento no dice qué pregunta se abrió.
    expect(marketing("FAQ.tsx")).toMatch(/track\("faq_open",\s*\{\s*question_id/);
  });

  it("perspective_tab_change sigue mandando origen y destino", () => {
    const src = marketing("Perspectives.tsx");
    expect(src).toMatch(/track\("perspective_tab_change"/);
    expect(src).toContain("from_tab");
  });
});

describe("identificadores del FAQ", () => {
  const ids = [...marketing("FAQ.tsx").matchAll(/^\s{4}id:\s*(\d+),/gm)].map((m) =>
    Number(m[1]),
  );

  it("no están vacíos", () => {
    expect(ids.length).toBeGreaterThanOrEqual(6);
  });

  it("no se repiten", () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("el 4 sigue retirado", () => {
    // La pregunta 4 se eliminó y NADIE renumeró, a propósito: reutilizar el 4
    // mezclaría en el histórico dos preguntas distintas bajo el mismo id.
    // Reordenar la rejilla es seguro; renumerar no lo es.
    expect(ids).not.toContain(4);
  });

  it("los nuevos van por encima del máximo actual, nunca rellenando huecos", () => {
    expect(Math.max(...ids)).toBeGreaterThanOrEqual(7);
  });
});

describe("composición de la página", () => {
  // Los comentarios del archivo nombran secciones desactivadas («reactivar
  // descomentando <Pricing /> debajo de <TrustOnboarding />»), así que buscar
  // en crudo encuentra la mención antes que el montaje real. Se quitan primero.
  const pagina = leer("src/app/(marketing)/mx/page.tsx")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  const SECCIONES = [
    "Topbar",
    "Hero",
    // Va entre Hero e ImpactBand a propósito: primero se ve qué es el
    // producto, después por qué hace falta.
    "ProductGlimpse",
    "ImpactBand",
    "Pain",
    "Solution",
    "PerspectivesLazy",
    "CasosDeUso",
    "MultiConjunto",
    "Differentiators",
    "TrustOnboarding",
    "FAQ",
    "FinalCTA",
  ];

  it.each(SECCIONES)("%s sigue montada", (seccion) => {
    expect(pagina).toContain(`<${seccion} `);
  });

  it("el orden de las secciones no cambia por accidente", () => {
    const posiciones = SECCIONES.map((s) => pagina.indexOf(`<${s} `));
    const ordenado = [...posiciones].sort((a, b) => a - b);
    expect(posiciones).toEqual(ordenado);
  });
});

describe("aislamiento de los tokens del landing", () => {
  const globals = leer("src/app/globals.css");

  it("el landing declara su propio fondo blanco", () => {
    // R1: el landing NO hereda de DESIGN.md. Tiene bloque propio, y su fondo
    // es blanco puro, no el #f4f7fb de la aplicación.
    const bloque = globals.slice(globals.indexOf(".marketing-theme {"));
    expect(bloque.slice(0, 400)).toMatch(/--background:\s*#FFFFFF/i);
  });

  it("no se cuela modo oscuro en los componentes de marketing", () => {
    // R2: el landing no tiene modo oscuro y este trabajo no lo introduce.
    const archivos = [
      "Topbar.tsx", "FAQ.tsx", "ImpactBand.tsx", "FinalCTA.tsx",
      "Perspectives.tsx", "Differentiators.tsx", "TrustOnboarding.tsx",
      "ProductGlimpse.tsx",
    ];
    for (const a of archivos) {
      expect(marketing(a)).not.toMatch(/prefers-color-scheme|dark:/);
    }
  });
});

describe("fondos por perfil de «Una plataforma, cuatro experiencias»", () => {
  const fuente = marketing("Perspectives.tsx");

  it("la meseta del degradado llega al 48 % del ancho", () => {
    // Es LA invariante de la sección, y se rompe sin querer al «afinar» el
    // degradado. El texto ocupa el 42 % del `container`, centrado a 1280 px:
    // en un viewport de 1920 eso cae entre el 17 % y el 45 % de la pantalla.
    // Si la meseta se acorta, el final de las líneas largas queda sobre la
    // zona clara y el contraste se cae por debajo de AA sin que nadie lo note,
    // porque la foto sigue viéndose bien.
    expect(fuente).toMatch(/0\.86\)\}\s*48%/);
  });

  it("cada perfil declara un color base sólido bajo la foto", () => {
    // Sin `base`, si la imagen tarda o falla queda texto blanco sobre blanco.
    const bases = fuente.match(/base:\s*"#[0-9A-Fa-f]{6}"/g) ?? [];
    expect(bases).toHaveLength(4);
  });

  it("los cuatro fondos existen en disco", () => {
    for (const k of ["admin", "residente", "porteria", "comite"]) {
      expect(existsSync(join(RAIZ, `public/product/perspectives-fondo-${k}.webp`))).toBe(true);
    }
  });

  it("el acento del perfil usa las variantes CLARAS, no las de marca", () => {
    // Sobre el fondo oscuro, #1A7A45 o #3D1460 no se leen. El titular pasó a
    // blanco y el color del perfil vive ahora en el ambiente y los números.
    const acentos = fuente.match(/acento:\s*"([^"]+)"/g) ?? [];
    expect(acentos).toHaveLength(4);
    for (const a of acentos) expect(a).toMatch(/light/);
  });
});

describe("animaciones del landing", () => {
  it("ningún componente de marketing anima propiedades de layout", () => {
    // `height`, `width`, `margin` y `padding` pasan por layout y pintado en
    // CADA fotograma. Es la regla que más se rompe sin querer —basta un
    // `transition-all` de más— y no la detecta el typecheck ni se nota en una
    // máquina rápida.
    const prohibidas = /transition-\[[^\]]*(height|width|margin|padding)/;
    for (const a of [
      "Hero.tsx", "Pain.tsx", "Solution.tsx", "CasosDeUso.tsx",
      "MultiConjunto.tsx", "Differentiators.tsx", "TrustOnboarding.tsx",
      "ImpactBand.tsx", "FinalCTA.tsx", "Perspectives.tsx",
    ]) {
      expect(marketing(a)).not.toMatch(prohibidas);
    }
  });

  it("el revelado vive en un solo sitio, no copiado por sección", () => {
    // Antes el mismo gesto tenía cuatro duraciones (250, 400, 280 ms y sueltos)
    // y tres desplazamientos (16, 12 y 4 px), porque se fue copiando de sección
    // en sección. Las que ya migraron no deben volver a declararlo a mano.
    for (const a of ["Solution.tsx", "CasosDeUso.tsx", "TrustOnboarding.tsx"]) {
      expect(marketing(a)).toMatch(/useRevelado/);
      expect(marketing(a)).not.toMatch(/transitionDelay:.*inView\s*\?/);
    }
  });
});

describe("la flecha de los CTA", () => {
  it("no vuelve a repetirse suelta en cada componente", () => {
    // Estaba copiada siete veces en cinco archivos, y en el hero iba suelta
    // dentro del texto —donde no se puede animar sin envolverla—.
    for (const a of ["Hero.tsx", "Topbar.tsx", "FinalCTA.tsx", "ImpactBand.tsx", "DemoDialog.tsx"]) {
      expect(marketing(a)).not.toMatch(/aria-hidden="true"\s+className="ml-0\.5"/);
    }
  });

  it("declara las DOS variantes de grupo", () => {
    // `group/button` no coincide con el selector de `group-hover:`, que busca la
    // clase `group` a secas. Sin las dos, la flecha funciona dentro del botón
    // compartido pero no en los enlaces que no lo usan.
    const flecha = leer("src/components/marketing/ui/flecha.tsx");
    expect(flecha).toMatch(/group-hover\/button:translate-x-1/);
    expect(flecha).toMatch(/group-hover:translate-x-1/);
  });
});
