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
      // Niewidoczne spacje (np. twarda spacja U+00A0, znak o zerowej szerokości) także
      // w napisach, szablonach, wyrażeniach regularnych i komentarzach: w kodzie mają być
      // zapisane jako \u00a0 itd. Narzędzie agenta raz wpisało taki znak dosłownie.
      "no-irregular-whitespace": [
        "error",
        { skipStrings: false, skipTemplates: false, skipRegExps: false, skipComments: false },
      ],
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
    // Zestaw strict zabrania też obsługi przeciągania (onDrop, onDragOver) na zwykłym <div>.
    // Strefa upuszczania pliku to dodatek dla myszy: z klawiatury i na telefonie działa
    // prawdziwy <button> w środku strefy. Dlatego tylko w tym pliku i tylko dla tej reguły
    // obowiązuje lista zdarzeń z zestawu recommended: kliknięcia i klawisze nadal są zakazane.
    files: ["src/components/PdfDrop.tsx"],
    rules: {
      "jsx-a11y/no-static-element-interactions": [
        "error",
        {
          allowExpressionValues: true,
          handlers: ["onClick", "onMouseDown", "onMouseUp", "onKeyPress", "onKeyDown", "onKeyUp"],
        },
      ],
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
