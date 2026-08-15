import { defineConfig } from "vitest/config";

/**
 * Pruebas que necesitan el emulador de Firestore levantado. Van aparte de las
 * demás por la misma razón que `tests/firestore.rules.test.ts` en la raíz: una
 * suite que falla cuando no hay emulador entrena a la gente a ignorar fallos.
 *
 *   export JAVA_HOME="$HOME/.local/java/jdk-21.0.12+8-jre/Contents/Home"
 *   export PATH="$JAVA_HOME/bin:$PATH"
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.emulator.test.ts"],
    // Las transacciones bajo contención reintentan; el default se queda corto.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
