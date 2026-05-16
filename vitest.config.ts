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
    exclude: [
      // Playwright E2E — correr con `npx playwright test`, no con vitest
      "**/*.spec.ts",
      // Este archivo usa @playwright/test pero tiene extensión .test.ts
      "tests/visitor-invitation-flow.test.ts",
      // Requiere Firebase Emulator en :8080 — correr por separado con emulador activo
      "tests/firestore.rules.test.ts",
      // Exclusiones estándar de vitest
      "**/node_modules/**",
      "**/dist/**",
    ],
  },
});
