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
  test: {
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
  },
});
