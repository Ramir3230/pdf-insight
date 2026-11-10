import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Wersja w <meta name="build">: w GitHub Actions to commit (GITHUB_SHA), lokalnie "local".
// Test dymny po deployu czeka, aż GitHub Pages poda właśnie tę wersję.
const buildId = process.env.GITHUB_SHA || "local";

const buildIdPlugin: Plugin = {
  name: "build-id",
  transformIndexHtml: (html) => html.replace("__BUILD_ID__", buildId),
};

export default defineConfig({
  // GitHub Pages serwuje projekt pod https://ramir3230.github.io/pdf-insight/
  base: "/pdf-insight/",
  plugins: [react(), buildIdPlugin],
  build: {
    // Bundle to ok. 670 kB (ok. 205 kB gzip), z czego ok. 450 kB to pdf.js. Domyślny próg
    // ostrzeżenia to 500 kB. Leniwe ładowanie pdf.js pozwoliłoby narysować stronę chwilę
    // wcześniej i ukryć pobieranie za czasem wyboru pliku, ale zysk jest mały, a koszt to
    // dodatkowy stan „ładuję pdf.js”, obsługa błędu pobrania i przekazywanie loadera przez
    // moduły (testy w Node działają bez workera). Wybrana prostota; próg z zapasem na wyniki.
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
    // Testy działają w Node, a tam pdf.js wymaga wersji „legacy” (główna jest dla przeglądarek).
    // Tylko w testach; aplikacja w przeglądarce używa głównej wersji.
    alias: [{ find: /^pdfjs-dist$/, replacement: "pdfjs-dist/legacy/build/pdf.mjs" }],
  },
});
