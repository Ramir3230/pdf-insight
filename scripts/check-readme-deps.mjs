// @ts-check
// Każda zależność z package.json musi mieć w README swój powód (zasada projektu: żadnych
// zależności „na zapas”). Skrypt sprawdza, że nazwa pakietu występuje w README w `backtickach`.
import { readFileSync } from "node:fs";
import { fail, pass } from "./lib/report.mjs";

/** @type {{ dependencies?: Record<string, string>, devDependencies?: Record<string, string> }} */
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const readme = readFileSync("README.md", "utf8");

const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
const missing = names.filter((name) => !readme.includes(`\`${name}\``));

for (const name of missing) {
  fail(`README.md nie opisuje zależności ${name}`);
}
if (missing.length === 0) {
  pass(`README.md opisuje wszystkie zależności (${names.length})`);
}
