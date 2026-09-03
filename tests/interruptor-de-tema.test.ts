import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { normalizarTema, temaEfectivo, TEMA_POR_DEFECTO, GUION_ANTI_DESTELLO, CLAVE_ESPEJO, ATRIBUTO } from "@/lib/ui/tema";
import { sanitizeUserProfilePatch } from "@/features/users/profile-service";

/**
 * El interruptor de tema. `PRD-V-FEAT-007` entrega 3.
 */

describe("PRD-V-FEAT-007 · la bandera gobierna algo (CA2 / RN-11)", () => {
  it("con la bandera APAGADA, quien tenga `oscuro` guardado ve CLARO", () => {
    // Este es el criterio que separa una bandera de un boton: si apagarla no
    // cambiara nada para quien ya eligio, no estaria gobernando nada.
    expect(temaEfectivo({ banderaEncendida: false, temaDelUsuario: "oscuro" })).toBe("claro");
  });

  it("con la bandera encendida, se respeta lo que la persona eligio", () => {
    expect(temaEfectivo({ banderaEncendida: true, temaDelUsuario: "oscuro" })).toBe("oscuro");
    expect(temaEfectivo({ banderaEncendida: true, temaDelUsuario: "claro" })).toBe("claro");
  });

  it("ausente NO es error: es el estado de todos los usuarios de hoy", () => {
    expect(temaEfectivo({ banderaEncendida: true, temaDelUsuario: undefined })).toBe(TEMA_POR_DEFECTO);
  });
});

describe("PRD-V-FEAT-007 · un valor desconocido se pinta claro y NO se corrige (CA9 / RN-03)", () => {
  it.each(["sistema", "", "OSCURO", 42, null, {}])("%s se pinta claro", (valor) => {
    expect(normalizarTema(valor)).toBe("claro");
  });

  it("y el parche NO lo escribe: corregirlo en silencio esconderia el defecto", () => {
    expect(sanitizeUserProfilePatch({ tema: "sistema" })).not.toHaveProperty("tema");
    expect(sanitizeUserProfilePatch({ tema: "oscuro" })).toEqual({ tema: "oscuro" });
  });

  it("y una edicion de perfil corriente sigue pasando sin tocar el tema", () => {
    const patch = sanitizeUserProfilePatch({ fullName: "Ana Ruiz", phone: "3001234567" });
    expect(patch).toEqual({ fullName: "Ana Ruiz", phone: "3001234567" });
    expect(patch).not.toHaveProperty("tema");
  });
});

/**
 * LOS CINCO SITIOS DEL CATALOGO.
 *
 * Registrar una bandera en cuatro de los cinco ya paso el 25 de agosto, y el que
 * se olvido fue justo el que permite encenderla POR CONJUNTO — o sea, la via del
 * canario. Esta prueba existe para que no vuelva a pasar en silencio.
 */
const CINCO_SITIOS = [
  "src/lib/feature-flags/catalog.ts",
  "functions/src/feature-flags.ts",
  "functions/scripts/seed-feature-flags.mjs",
  "functions/scripts/mover-bandera.mjs",
  "functions/scripts/mover-bandera-de-conjunto.mjs",
];

describe("PRD-V-FEAT-007 · la bandera esta en los CINCO sitios", () => {
  it.each(CINCO_SITIOS)("%s la conoce", (ruta) => {
    expect(readFileSync(ruta, "utf8")).toContain('"producto-modo-oscuro"');
  });

  it("y nace APAGADA, que es lo que toca en una capacidad nueva", () => {
    const catalogo = readFileSync("src/lib/feature-flags/catalog.ts", "utf8");
    const bloque = catalogo.slice(catalogo.indexOf('"producto-modo-oscuro": {'));
    expect(bloque.slice(0, bloque.indexOf("},"))).toContain("defaultEnabled: false");
    expect(readFileSync("functions/src/feature-flags.ts", "utf8")).toContain('"producto-modo-oscuro": false');
  });
});

describe("PRD-V-FEAT-007 · el guion anti-destello", () => {
  it("nombra la clave del espejo y el atributo, y no revienta si falla el almacenamiento", () => {
    expect(GUION_ANTI_DESTELLO).toContain(JSON.stringify(CLAVE_ESPEJO));
    expect(GUION_ANTI_DESTELLO).toContain(JSON.stringify(ATRIBUTO));
    expect(GUION_ANTI_DESTELLO).toMatch(/try\{[\s\S]*\}catch/);
  });

  it("va en un <script> DENTRO del <head>, o llega tarde y hay destello", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");

    // Se mira la ESTRUCTURA, no la palabra. La primera version afirmaba
    // `toContain("GUION_ANTI_DESTELLO")` y pasaba en verde con el `<script>`
    // borrado, porque el import solo ya la satisfacia. Es el mismo hueco que
    // tuvo el guardian de `@media screen`, y las dos veces lo destapo falsarlo.
    const head = layout.slice(layout.indexOf("<head>"), layout.indexOf("</head>"));
    expect(head, "el guion no esta dentro del <head>").toMatch(
      /<script\s+dangerouslySetInnerHTML=\{\{\s*__html:\s*GUION_ANTI_DESTELLO\s*\}\}\s*\/>/,
    );
    expect(layout.indexOf("<head>")).toBeLessThan(layout.indexOf("<body"));
    // `suppressHydrationWarning` porque el atributo diverge a proposito.
    expect(layout).toContain("suppressHydrationWarning");
  });
});

describe("PRD-V-FEAT-007 · el espejo se borra al CERRAR SESION, no en todo estado sin sesion", () => {
  it("logout lo borra", () => {
    const ctx = readFileSync("src/features/auth/auth-context.tsx", "utf8");
    const logout = ctx.slice(ctx.indexOf("const logout = useCallback"));
    expect(logout.slice(0, logout.indexOf("}, [])"))).toContain("borrarEspejo()");
  });

  it("y NO se borra por estar sin sesion: eso mataria el pintado sin destello", () => {
    const ctx = readFileSync("src/features/auth/auth-context.tsx", "utf8");
    // Solo puede aparecer una vez, dentro de logout.
    expect(ctx.match(/borrarEspejo\(\)/g)?.length).toBe(1);
  });
});

describe("PRD-V-FEAT-007 · nadie escribe el tema de otro (RN-04)", () => {
  it("updateUserProfile exige que el uid sea el de la sesion", () => {
    const svc = readFileSync("src/features/users/profile-service.ts", "utf8");
    expect(svc).toContain("auth.currentUser.uid !== uid");
  });

  it("ninguna pantalla muestra ni escribe el tema de otra persona", () => {
    // El campo solo se toca desde el propio perfil. Si alguien lo pintara en la
    // pantalla de usuarios del admin o en la consola, esto enrojece.
    const sospechosos = [
      "src/app/(admin)/admin/users/page.tsx",
      "src/features/superadmin/services.ts",
    ];
    for (const f of sospechosos) {
      expect(readFileSync(f, "utf8"), `${f} toca el tema de otro`).not.toMatch(/\btema\b/);
    }
  });
});
