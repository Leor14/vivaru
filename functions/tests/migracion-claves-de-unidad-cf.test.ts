import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Los criterios que **deben fallar** de `PRD-V-FIX-002` (§10 · CF3, CF4, CF5, CF7).
 *
 * Se comprueban de dos formas distintas y a propósito:
 *
 *   - **CF3 y CF4 ejecutando el script de verdad.** Sus dos guardianes corren
 *     ANTES de `initializeApp()`, así que aquí no hacen falta credenciales ni red:
 *     lo que se mide es el código de salida real, no una frase del fichero.
 *   - **CF5 y CF7 leyendo el fichero**, porque son afirmaciones sobre lo que el
 *     script NO tiene: no hay ruta para el administrador y no hay ruta que cree ni
 *     borre un documento. Una ausencia no se puede ejecutar.
 */

const MIGRACION = path.resolve(__dirname, "../scripts/migrar-claves-de-unidad.mjs");
const INFORME = path.resolve(__dirname, "../scripts/informe-claves-de-unidad.mjs");

function correr(...args: string[]) {
  return spawnSync(process.execPath, [MIGRACION, ...args], { encoding: "utf8", timeout: 30_000 });
}

describe("CF3 · contra producción sin la bandera explícita", () => {
  it("rechaza, y lo dice", () => {
    const r = correr("hogaru-1", "un-conjunto", "--escribir", "--informe", "inexistente.json");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("PRODUCCIÓN");
  });

  it("la bandera es SOLO de producción: otro proyecto no la necesita", () => {
    // Si la exigiera en todas partes, la de producción dejaría de significar nada.
    const r = correr("vivaru-staging-02", "un-conjunto", "--escribir", "--informe", "inexistente.json");
    expect(r.stderr).not.toContain("PRODUCCIÓN");
  });

  it("un informe que NO existe se rechaza antes de tocar la red (sin credencial, esta prueba se colgaba)", () => {
    // Chip cerrado el 2 sep 2026. Hasta entonces el script pasaba las guardas, hacía
    // `initializeApp()` y LEÍA Firestore antes de abrir el informe: con la ADC caducada
    // la prueba de arriba esperaba el timeout entero. Un banco que enrojece por una
    // credencial enseña a ignorar su color. Se mide por el mensaje, que solo existe
    // en la guarda nueva, y por el código de salida.
    const r = correr("vivaru-staging-02", "un-conjunto", "--escribir", "--informe", "inexistente.json");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("inexistente.json no existe");
    expect(r.stderr).toContain("informe-claves-de-unidad.mjs");
    // Y NO llegó a mirar el conjunto: ese mensaje es el de después de la red.
    expect(r.stderr).not.toContain("No existe el conjunto");
  });
});

describe("CF4 · escribir sin haber corrido el informe", () => {
  it("rechaza, y dice cuál es el comando que falta", () => {
    const r = correr("hogaru-1", "un-conjunto", "--escribir", "--si-produccion");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--informe");
    expect(r.stderr).toContain("informe-claves-de-unidad.mjs");
  });

  it("en seco NO lo exige: mirar no necesita permiso", () => {
    const r = correr("hogaru-1");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Uso:");
  });
});

describe("CF7 · la migración no crea, no borra y no mueve documentos (R7)", () => {
  const fuente = fs.readFileSync(MIGRACION, "utf8");
  /** Solo el código: un comentario que NOMBRE `batch.set` no es una ruta que escriba. */
  const codigo = fuente
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");

  it("el filtro de comentarios deja código de verdad, no un fichero vacío", () => {
    expect(codigo).toContain("batch.update(");
  });

  /**
   * Se busca la llamada de FIRESTORE, no la palabra. `colecciones.add(` es un
   * `Set` y `map.set(` es un `Map`: prohibirlos por el nombre daría un rojo que
   * no significa nada, y un guardián que da rojos falsos se acaba desactivando.
   */
  const ESCRITURA_DE_FIRESTORE = /(?:batch|db\.collection\([^)]*\)|\.doc\([^)]*\)|\.ref)\s*\.(set|create|add|delete|update)\(/g;

  function llamadas(texto: string): Set<string> {
    return new Set([...texto.matchAll(ESCRITURA_DE_FIRESTORE)].map((m) => m[1]));
  }

  it("el detector encuentra la escritura que SÍ existe, o no está detectando nada", () => {
    expect(llamadas(codigo)).toContain("update");
  });

  it("no hay una sola ruta que cree, añada o borre un documento", () => {
    for (const prohibida of ["set", "create", "add", "delete"]) {
      expect(llamadas(codigo), `la migración no puede llamar a Firestore \`${prohibida}\``).not.toContain(prohibida);
    }
  });

  it("lo único que escribe es `update` — R7, «solo reescribe un campo»", () => {
    expect(llamadas(codigo)).toEqual(new Set(["update"]));
  });

  it("`FieldValue.delete()` sí está, y es otra cosa: borra un CAMPO al revertir", () => {
    expect(codigo).toContain("FieldValue.delete()");
    expect(codigo).not.toMatch(/\.ref\.delete\(\)/);
  });
});

describe("CF5 · un `tenant_admin` no tiene esa ruta", () => {
  it("la migración es un script de plataforma: no hay callable ni pantalla que la dispare", () => {
    const src = path.resolve(__dirname, "../src");
    const modulos = fs.readdirSync(src).filter((f) => f.endsWith(".ts"));
    for (const m of modulos) {
      const texto = fs.readFileSync(path.join(src, m), "utf8");
      expect(texto, `${m} expone la migración como función desplegada`).not.toContain("migrar-claves-de-unidad");
    }
  });
});

describe("el informe no escribe nunca", () => {
  it("no tiene bandera para escribir ni una llamada que escriba", () => {
    const fuente = fs.readFileSync(INFORME, "utf8");
    const codigo = fuente.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    expect(codigo).not.toContain("--escribir");
    const escrituras = [
      ...codigo.matchAll(/(?:batch|db\.collection\([^)]*\)|\.doc\([^)]*\)|\.ref)\s*\.(set|create|add|delete|update)\(/g),
    ].map((m) => m[1]);
    expect(escrituras, "el informe mira, no toca").toEqual([]);
    expect(codigo, "y no crea un lote siquiera").not.toContain("db.batch()");
  });
});
