import { defineConfig } from "vitest/config";

/**
 * Config propia de `functions/`. Sin esto, vitest sube al directorio padre y
 * usa `vitest.config.ts` de la raíz: heredaría su alias `@ -> src/` y sus
 * exclusiones, que no tienen nada que ver aquí, y bastaría un cambio en la raíz
 * para romper estas pruebas sin tocarlas.
 *
 * Extensión `.mts` porque `functions/package.json` no declara `type: module`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Las que necesitan emulador van en su propia config (vitest.emulator.config.mts).
    exclude: ["**/node_modules/**", "tests/**/*.emulator.test.ts"],
  },
});
