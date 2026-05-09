import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "functions/lib/**",
    "functions/node_modules/**",
    "functions/scripts/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // React Compiler rules — disabled until codebase is fully migrated
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/globals": "off",
    },
  },
]);

export default eslintConfig;
