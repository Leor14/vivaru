/**
 * tests/import-feature-flag.test.ts
 *
 * La bandera `producto-importacion-masiva` sobre los dos asistentes de carga.
 *
 * Qué se protege aquí, y por qué merece test propio: el importador **ya estaba
 * vivo en producción** cuando se le puso bandera, así que hay dos formas de
 * romperlo y las dos son silenciosas. Una, que nazca apagada —añadir la bandera
 * sería apagar la función para todos—. Otra, que el corte tape los botones y
 * deje abierta la tercera entrada: al asistente también se llega por el
 * recorrido guiado (`?guia=`), que no pasa por ningún botón.
 *
 * LÍMITE, dicho aquí para que nadie lo descubra tarde: esto es verificación
 * estática del archivo, no una prueba de comportamiento. En este repo no hay
 * RTL ni jsdom, así que la pantalla no se puede renderizar. Un cambio de nombre
 * de variable rompe estos tests sin que el producto esté mal — y al revés, un
 * corte mal puesto puede pasar. Vale por lo que fija, no por lo que demuestra.
 */

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { FEATURE_FLAG_CATALOG } from "@/lib/feature-flags/catalog";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";

const FLAG = "producto-importacion-masiva" as const;

const paginaResidentes = fs.readFileSync(
  path.join(process.cwd(), "src/app/(admin)/admin/residents/page.tsx"),
  "utf8",
);

const espejoServidor = fs.readFileSync(
  path.join(process.cwd(), "functions/src/feature-flags.ts"),
  "utf8",
);

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 1 — el estado de reposo: encendida
// ─────────────────────────────────────────────────────────────────────────────

describe("la bandera no apaga nada por existir", () => {
  it("sin documento en Firestore, la importación sigue disponible", () => {
    expect(resolveFeatureFlag(FLAG, {})).toEqual({ enabled: true, source: "default_catalogo" });
  });

  it("el espejo del servidor declara el mismo default", () => {
    // No se puede importar `functions/` desde `tests/` —rompe el build de App
    // Hosting, ver CLAUDE.md—, así que el espejo se comprueba como texto. Es la
    // única guarda que tiene: los dos catálogos se editan a mano.
    expect(espejoServidor).toContain(`"${FLAG}": true`);
    expect(espejoServidor).toContain(`| "${FLAG}"`);
  });

  it("dice qué queda funcionando al apagarla, y menciona el alta manual", () => {
    const alApagar = FEATURE_FLAG_CATALOG[FLAG].alApagar;
    expect(alApagar).toMatch(/mano/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 2 — las tres entradas al asistente, cortadas
// ─────────────────────────────────────────────────────────────────────────────

describe("pantalla de residentes: el corte cubre las tres entradas", () => {
  it("la pantalla lee la bandera", () => {
    expect(paginaResidentes).toContain(`useFeatureFlag("${FLAG}")`);
  });

  it("el recorrido guiado exige la bandera en sus dos pasos", () => {
    // `unidades` y `residentes`. Es la entrada que no tiene botón: se llega por
    // URL, así que taparlos no la cierra.
    const enganches = paginaResidentes.match(/track === "cliente" && importacionMasiva/g) ?? [];
    expect(enganches).toHaveLength(2);
  });

  it("los dos botones de carga viven dentro del condicional", () => {
    const primerCorte = paginaResidentes.indexOf("{importacionMasiva && (");
    expect(primerCorte).toBeGreaterThan(-1);
    expect(paginaResidentes.indexOf("1 · Cargar unidades")).toBeGreaterThan(primerCorte);
    expect(paginaResidentes.indexOf("2 · Cargar residentes")).toBeGreaterThan(primerCorte);
  });

  it("los asistentes no se montan con la bandera abajo", () => {
    // Lo que de verdad cierra la puerta del recorrido guiado: si los modales se
    // montaran siempre, `?guia=` los abriría aunque no hubiera botones.
    const corteDeModales = paginaResidentes.lastIndexOf("{importacionMasiva && (");
    expect(corteDeModales).toBeGreaterThan(-1);
    expect(paginaResidentes.indexOf("<UnitBulkImportWizard")).toBeGreaterThan(corteDeModales);
    expect(paginaResidentes.indexOf("<ResidentBulkImportWizard")).toBeGreaterThan(corteDeModales);
  });

  it("apagada, el paso guiado sigue llevando a algún sitio", () => {
    // Un botón de la guía que no hace nada es peor que uno lento: la caída al
    // alta individual es parte del corte, no un adorno.
    expect(paginaResidentes).toContain("else openCreateUnit();");
  });
});
