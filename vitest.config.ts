import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // Los patrones van con `**/` delante y NO con `tests/`: el script corre
    // `vitest run --dir tests` —obligatorio para no recoger las copias de
    // `.claude/worktrees/`— y con `--dir` las rutas dejan de casar contra un
    // prefijo `tests/`, así que las exclusiones se colaban y el emulador y
    // Playwright acababan dentro de la suite normal.
    exclude: [
      // Playwright E2E — correr con `npx playwright test`, no con vitest
      "**/*.spec.ts",
      // Este archivo usa @playwright/test pero tiene extensión .test.ts
      "**/visitor-invitation-flow.test.ts",
      // Requieren Firebase Emulator — ver el apartado del emulador en CLAUDE.md
      "**/firestore.rules.test.ts",
      "**/storage.rules.test.ts",
      "**/push-tokens.rules.test.ts",
      "**/puerta-de-buzones.rules.test.ts",
      // Copias de un worktree de Claude. `--dir tests` ya las deja fuera de
      // `npm test`, pero **una ruta suelta se salta el `--dir`**: `npx vitest run
      // tests/x.test.ts` recogía el fichero del worktree ADEMÁS del de verdad, y
      // corría una copia de otro commit sin decirlo. Aquí no depende del `--dir`.
      "**/.claude/worktrees/**",
      // Exclusiones estándar de vitest
      "**/node_modules/**",
      "**/dist/**",
    ],
  },
});
