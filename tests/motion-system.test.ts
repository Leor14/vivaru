/**
 * tests/motion-system.test.ts
 *
 * Motion Fase 1 + Fase 2 — verificación estática pura. Sin DOM, sin RTL.
 * Bloques: motion.ts | data-table.tsx | button.tsx | drawer.tsx | modal.tsx
 */

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DURATION, TRANSITION } from "../src/lib/constants/motion";

const ROOT = path.resolve(__dirname, "..");

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 1 — motion.ts: sistema de constantes
// ─────────────────────────────────────────────────────────────────────────────

describe("BLOQUE 1 — motion.ts: constantes", () => {
  it("DURATION exporta keys fast, base, slow", () => {
    expect(DURATION).toHaveProperty("fast");
    expect(DURATION).toHaveProperty("base");
    expect(DURATION).toHaveProperty("slow");
  });

  it("DURATION.fast <= 150", () => {
    expect(DURATION.fast).toBeLessThanOrEqual(150);
  });

  it("DURATION.base <= 200", () => {
    expect(DURATION.base).toBeLessThanOrEqual(200);
  });

  it("DURATION.slow <= 300", () => {
    expect(DURATION.slow).toBeLessThanOrEqual(300);
  });

  it("TRANSITION exporta keys fast, base, slow", () => {
    expect(TRANSITION).toHaveProperty("fast");
    expect(TRANSITION).toHaveProperty("base");
    expect(TRANSITION).toHaveProperty("slow");
  });

  it("TRANSITION.fast contiene 'duration-150'", () => {
    expect(TRANSITION.fast).toContain("duration-150");
  });

  it("TRANSITION.base contiene 'duration-200'", () => {
    expect(TRANSITION.base).toContain("duration-200");
  });

  it("TRANSITION.slow contiene 'duration-300'", () => {
    expect(TRANSITION.slow).toContain("duration-300");
  });

  it("TRANSITION.fast contiene 'transition'", () => {
    expect(TRANSITION.fast).toContain("transition");
  });

  it("TRANSITION.base contiene 'transition'", () => {
    expect(TRANSITION.base).toContain("transition");
  });

  it("TRANSITION.slow contiene 'transition'", () => {
    expect(TRANSITION.slow).toContain("transition");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 2 — data-table.tsx: hover transition en tr
// ─────────────────────────────────────────────────────────────────────────────

describe("BLOQUE 2 — data-table.tsx: tr hover transition", () => {
  const src = read("src/components/shared/data-table.tsx");

  // Aislar la fila de DATOS dentro de <tbody> — no la de esqueleto ni las de
  // error o vacío, que no llevan hover.
  //
  // Se ancla en `.map((row)` y NO en el nombre de la colección: la versión
  // anterior buscaba `rows.map` y dejó de encontrar nada el día que se añadió
  // paginación y el array pasó a llamarse `pageItems`. Al no encontrar nada
  // comparaba contra cadena vacía, así que las cuatro comprobaciones fallaban
  // sin que hubiera ninguna regresión — el componente conservaba sus
  // transiciones intactas. Una prueba que falla por el nombre de una variable
  // no está midiendo lo que dice medir.
  const tbodyMatch = src.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0] ?? "";
  const trMatch = tbodyMatch.match(/\.map\(\(row\)[\s\S]*?<tr[\s\S]*?className=\{cn\(([\s\S]*?)\)\}/);
  const trClasses = trMatch ? trMatch[0] : "";

  it("la extracción encuentra la fila de datos (si esto falla, el resto miente)", () => {
    expect(trMatch).not.toBeNull();
  });

  it("<tr> de filas contiene 'transition-colors'", () => {
    expect(trClasses).toContain("transition-colors");
  });

  it("<tr> de filas contiene 'duration-150'", () => {
    expect(trClasses).toContain("duration-150");
  });

  it("<tr> de filas contiene 'ease-'", () => {
    expect(trClasses).toMatch(/ease-/);
  });

  it("<tr> de filas mantiene hover:bg existente", () => {
    expect(trClasses).toMatch(/hover:bg-/);
  });

  it("<th> headers NO contienen 'transition-colors'", () => {
    // Aislar bloque <thead>
    const theadMatch = src.match(/<thead>[\s\S]*?<\/thead>/);
    const thead = theadMatch ? theadMatch[0] : "";
    expect(thead).not.toContain("transition-colors");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 3 — button.tsx: scale solo en variant default
// ─────────────────────────────────────────────────────────────────────────────

describe("BLOQUE 3 — button.tsx: scale en variant default", () => {
  const src = read("src/components/ui/button.tsx");

  // Aislar cada variant line
  const defaultLine = src.match(/default:\s*"[^"]*"/)?.[0] ?? "";
  const dangerLine = src.match(/danger:\s*"[^"]*"/)?.[0] ?? "";
  const ghostLine = src.match(/ghost:\s*"[^"]*"/)?.[0] ?? "";
  const outlineLine = src.match(/outline:\s*"[^"]*"/)?.[0] ?? "";

  it("variant default contiene 'hover:scale-[1.02]'", () => {
    expect(defaultLine).toContain("hover:scale-[1.02]");
  });

  it("variant default contiene 'active:scale-[0.98]'", () => {
    expect(defaultLine).toContain("active:scale-[0.98]");
  });

  it("variant default contiene 'motion-reduce:transform-none'", () => {
    expect(defaultLine).toContain("motion-reduce:transform-none");
  });

  it("variant danger NO contiene 'hover:scale'", () => {
    expect(dangerLine).not.toContain("hover:scale");
  });

  it("variant ghost NO contiene 'hover:scale'", () => {
    expect(ghostLine).not.toContain("hover:scale");
  });

  it("variant outline NO contiene 'hover:scale'", () => {
    expect(outlineLine).not.toContain("hover:scale");
  });

  it("base cva NO duplica 'transition' junto a variant default", () => {
    // base ya tiene "transition" — default NO debe agregar otro "transition " suelto
    const defaultClasses = defaultLine.replace(/default:\s*"/, "").replace(/"$/, "");
    const transitionWords = (defaultClasses.match(/\btransition\b/g) ?? []).length;
    expect(transitionWords).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 4 — drawer.tsx: animación CSS-first con data-state
// ─────────────────────────────────────────────────────────────────────────────
// Implementación: transiciones en globals.css vía clases .drawer-overlay /
// .drawer-panel controladas por data-state="open"|"closed". Las clases Tailwind
// inline de timing fueron eliminadas intencionalmente — la curva iOS
// (--ease-drawer) y el timing asimétrico (enter 300ms / exit 220ms) viven en
// el CSS para poder usar cubic-bezier arbitrarios sin depender del compilador.

describe("BLOQUE 4 — drawer.tsx: overlay + panel timing", () => {
  const src = read("src/components/ui/drawer.tsx");
  const css = read("src/app/globals.css");

  it("overlay tiene clase CSS 'drawer-overlay'", () => {
    expect(src).toContain("drawer-overlay");
  });

  it("overlay tiene atributo data-state para controlar la animación", () => {
    expect(src).toContain('data-state={dataState}');
  });

  it("panel tiene clase CSS 'drawer-panel'", () => {
    expect(src).toContain("drawer-panel");
  });

  it("panel tiene atributo data-state para controlar la animación", () => {
    // data-state aparece al menos dos veces (overlay + panel)
    const matches = src.match(/data-state=\{dataState\}/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("globals.css define .drawer-overlay con transition opacity", () => {
    expect(css).toContain(".drawer-overlay");
    expect(css).toMatch(/\.drawer-overlay\s*\{[^}]*transition[^}]*opacity/s);
  });

  it("globals.css define .drawer-panel con enter 300ms y curva --ease-drawer", () => {
    expect(css).toContain(".drawer-panel");
    expect(css).toContain("300ms");
    expect(css).toContain("--ease-drawer");
  });

  it("globals.css define exit asimétrico 220ms con ease-in acelerado", () => {
    expect(css).toContain("220ms");
    // curva ease-in acelerado para salida rápida
    expect(css).toMatch(/0\.4,\s*0,\s*1,\s*1/);
  });

  it("globals.css incluye prefers-reduced-motion para drawer", () => {
    // La sección reduced-motion cubre .drawer-overlay y .drawer-panel
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*drawer/);
  });

  it("drawer.tsx usa mounted + dataState para mantener el DOM durante exit", () => {
    expect(src).toContain("mounted");
    expect(src).toContain("dataState");
  });

  it("archivo NO importa tailwindcss-animate ni @keyframes propios", () => {
    expect(src).not.toContain("tailwindcss-animate");
    expect(src).not.toContain("@keyframes");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 5 — modal.tsx: sin cambios (intencional)
// ─────────────────────────────────────────────────────────────────────────────

describe("BLOQUE 5 — modal.tsx: sin animaciones (conditional render)", () => {
  const src = read("src/components/shared/modal.tsx");

  it("NO contiene 'animate-in'", () => {
    expect(src).not.toContain("animate-in");
  });

  it("NO contiene 'animate-out'", () => {
    expect(src).not.toContain("animate-out");
  });

  it("NO contiene clases data-[state=open] de animación", () => {
    expect(src).not.toContain("data-[state=open]:animate");
  });

  it("NO contiene tailwindcss-animate", () => {
    expect(src).not.toContain("tailwindcss-animate");
  });
});
