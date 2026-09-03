import path from "path";
import { defineConfig } from "vitest/config";

/**
 * Config aparte para las pruebas de REGLAS (Firestore y Storage).
 *
 * La suite normal las excluye a propósito: necesitan el emulador levantado y no
 * deben tumbar `npm test` en una máquina que no lo tiene. El problema es que esa
 * exclusión **no se puede deshacer desde la línea de comandos** — `--exclude`
 * SUMA patrones, no los sustituye —, así que `vitest run tests/storage.rules.test.ts`
 * salía con «No test files found» y en verde. Las pruebas de reglas no fallaban:
 * es que no existían para el corredor.
 *
 * El `include` va con rutas explícitas para no recoger las copias de
 * `.claude/worktrees/`, que comparten emulador y chocan con los mismos ids.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: [
      "tests/firestore.rules.test.ts",
      "tests/storage.rules.test.ts",
      "tests/push-tokens.rules.test.ts",
      "tests/puerta-de-buzones.rules.test.ts",
      "tests/informe-mensual.rules.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/**"],
    // Comparten emulador: en paralelo se pisan los mismos documentos.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
