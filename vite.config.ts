import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // GitHub Pages serwuje projekt pod https://ramir3230.github.io/pdf-insight/
  base: "/pdf-insight/",
  plugins: [react()],
  test: {
    include: ["src/**/*.test.ts", "server/**/*.test.ts"],
  },
});
