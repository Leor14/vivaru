import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **La colisión entre `--spacing-*` y `max-w-*` (27 de agosto de 2026).**
 *
 * Tailwind v4 mapea `--spacing-{nombre}` a **todas** las utilidades de tamaño,
 * `max-w-*` incluida. Como `globals.css` declara `--spacing-sm: 8px`,
 * `--spacing-xl: 32px` y compañía, la clase `max-w-xl` pasa a valer 32 píxeles.
 *
 * Ya había un parche para las clases SIN prefijo, con su porqué escrito. Nadie
 * cubrió las variantes con punto de corte, y el resultado estaba **vivo en
 * producción**: medido en pantalla, el formulario de cambio de contraseña del
 * administrador media **32 píxeles de ancho**, y los dos formularios del perfil
 * del residente lo mismo.
 *
 * **Se manifiesta sin error.** Compila, pasa el typecheck, pasa las 1.269
 * pruebas y se despliega: solo se ve entrando a la pantalla. Por eso hace falta
 * un guardián que lo vigile por construcción.
 *
 * Esta prueba no comprueba las tres instancias que había: comprueba **la clase
 * entera de defecto**. Enrojece si aparece un token de espaciado nuevo que
 * colisione, o si alguien usa una combinación que no está parcheada.
 */

const RAIZ = process.cwd();
const GLOBALS = "src/app/globals.css";

function leer(rel: string): string {
  return fs.readFileSync(path.resolve(RAIZ, rel), "utf8");
}

const css = leer(GLOBALS);

/** Los nombres de la escala `max-w-*` de Tailwind. `2xl` está a propósito. */
const ESCALA_MAX_W = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl"];

/** Tokens de espaciado declarados hoy en el `@theme`. */
function tokensDeEspaciado(): string[] {
  return [...css.matchAll(/^\s+--spacing-([a-z0-9]+):/gm)].map((m) => m[1]);
}

/** Un nombre colisiona si es token de espaciado Y existe en la escala de `max-w`. */
function nombresQueColisionan(): string[] {
  return tokensDeEspaciado().filter((n) => ESCALA_MAX_W.includes(n));
}

/** Todo `<punto-de-corte>:max-w-<nombre>` escrito en el producto. */
function combinacionesUsadas(): { combo: string; bp: string; tam: string; fichero: string }[] {
  const salida: { combo: string; bp: string; tam: string; fichero: string }[] = [];
  const patron = /\b(sm|md|lg|xl|2xl):max-w-(xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)\b/g;

  const visitar = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name === "node_modules" || entrada.name === ".next") continue;
        visitar(completo);
      } else if (/\.tsx?$/.test(entrada.name)) {
        const rel = path.relative(RAIZ, completo);
        for (const m of leer(rel).matchAll(patron)) {
          salida.push({ combo: m[0], bp: m[1], tam: m[2], fichero: rel });
        }
      }
    }
  };
  // `components/` y `features/` de la RAÍZ también: el portal del residente
  // importa de ahí, y un barrido sobre `src/` solo no los vería.
  for (const d of ["src", "components", "features"]) visitar(path.resolve(RAIZ, d));
  return salida;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("1 · el barrido mira cosas de verdad", () => {
  it("encuentra los tokens de espaciado", () => {
    // Una puerta que se abre sobre un conjunto vacío no verifica nada.
    expect(tokensDeEspaciado().length).toBeGreaterThan(4);
    expect(tokensDeEspaciado()).toContain("xl");
  });

  it("encuentra combinaciones con punto de corte en el producto", () => {
    expect(combinacionesUsadas().length).toBeGreaterThan(5);
  });
});

describe("2 · toda combinación usada está parcheada", () => {
  /**
   * El parche vive sin capa (`unlayered`) en `globals.css` para ganarle a
   * `@layer utilities`. `@utility` NO sirve: sus declaraciones se fusionan con
   * la regla autogenerada en un solo bloque y gana la última — está explicado
   * en el propio fichero, encima del parche.
   */
  it("ninguna combinación usada resuelve a un token de espaciado", () => {
    const colisionan = nombresQueColisionan();
    const rotas = combinacionesUsadas()
      .filter((u) => colisionan.includes(u.tam))
      .filter((u) => !css.includes(`.${u.bp}\\:max-w-${u.tam} {`));

    expect(
      rotas.map((r) => `${r.combo} en ${r.fichero}`),
      "Estas clases valen unos pocos PÍXELES en pantalla, no rem. Añade su regla " +
        "al bloque de variantes con punto de corte de globals.css:\n" +
        rotas.map((r) => `  .${r.bp}\\:max-w-${r.tam} { max-width: …; }`).join("\n"),
    ).toEqual([]);
  });

  it("los seis nombres que colisionan están parcheados en los cinco puntos de corte", () => {
    // Se parchea la clase entera de defecto, no solo lo que hoy se usa: así el
    // próximo `lg:max-w-md` que alguien escriba ya nace bien.
    const faltan: string[] = [];
    for (const bp of ["sm", "md", "lg", "xl", "2xl"]) {
      for (const tam of nombresQueColisionan()) {
        if (!css.includes(`.${bp}\\:max-w-${tam} {`)) faltan.push(`${bp}:max-w-${tam}`);
      }
    }
    expect(faltan, "faltan reglas en el bloque de variantes:\n" + faltan.join("\n")).toEqual([]);
  });
});

describe("3 · `2xl` se salva, y conviene saber por qué", () => {
  it("no hay token `--spacing-2xl` — el nuestro se llama `xxl`", () => {
    // Por eso `md:max-w-2xl` resuelve bien a `--container-2xl` y no hace falta
    // parchearlo. El día que alguien renombre `xxl` a `2xl`, la prueba de
    // arriba enrojece sola.
    expect(tokensDeEspaciado()).not.toContain("2xl");
    expect(tokensDeEspaciado()).toContain("xxl");
  });
});
