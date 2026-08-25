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
    /**
     * **Un fichero cada vez. El emulador es UNO y las colecciones son las
     * mismas.**
     *
     * Cada suite limpia en su `beforeEach` las colecciones que va a usar
     * —`billingStatements`, `ledgerEntries`, `advances`…— y esa limpieza es
     * global: borra también lo que acaba de sembrar la suite de al lado. En
     * paralelo eso da **fallos fantasma que cambian de sitio entre
     * ejecuciones**: al añadir `tenant-operable-cf8` salieron 9 fallos en una
     * corrida y 4 en la siguiente, sin tocar una línea, y tres de ellos en un
     * fichero que estaba verde.
     *
     * Es la misma trampa que ya documenta CLAUDE.md para las pruebas de reglas.
     * Aislarlo por nombres de documento no sirve: lo que colisiona es el
     * `.get()` de la colección entera que hace la limpieza.
     */
    fileParallelism: false,
  },
});
