// @ts-check
// Wspólny sposób raportowania dla skryptów kontrolnych. Błąd nie przerywa skryptu od razu:
// ustawia kod wyjścia 1, żeby jedno uruchomienie pokazało wszystkie problemy.

/** @param {string} message */
export function pass(message) {
  process.stdout.write(`OK   ${message}\n`);
}

/** @param {string} message */
export function fail(message) {
  process.stderr.write(`BŁĄD ${message}\n`);
  process.exitCode = 1;
}
