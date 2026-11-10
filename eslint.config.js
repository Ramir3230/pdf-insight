import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist", "coverage", "private"] },
  {
    // Komentarze eslint-disable nie działają: reguły obowiązują bez wyjątków w kodzie.
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "error" },
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // Niezdefiniowane nazwy sprawdza TypeScript (także w skryptach .mjs przez checkJs).
      "no-undef": "off",
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [
      react.configs.flat.recommended,
      react.configs.flat["jsx-runtime"],
      reactHooks.configs.flat.recommended,
      jsxA11y.flatConfigs.strict,
    ],
    settings: { react: { version: "detect" } },
    rules: {
      "react/no-danger": "error",
    },
  },
  {
    // Jedyny wyjątek: backend loguje błędy do logów Vercel (bez treści dokumentu).
    files: ["api/**/*.ts", "server/**/*.ts"],
    rules: {
      "no-console": ["error", { allow: ["error"] }],
    },
  },
);
