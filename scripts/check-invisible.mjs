// @ts-check
// Szuka niewidocznych znaków (twarda spacja, spacje typograficzne, znaki o zerowej szerokości,
// BOM) we wszystkich plikach tekstowych repozytorium, także jeszcze niedodanych do gita.
// W kodzie i dokumentach takie znaki zapisujemy kodem (np. U+00A0 jako escape w napisie), bo
// dosłownie ich nie widać — narzędzie zapisu agenta kilka razy wstawiło je dosłownie.
// Znaki są tu podane liczbami, a nie jako escape w tekście, z tego samego powodu.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fail, pass } from "./lib/report.mjs";

/** @param {number} from @param {number} to */
function range(from, to) {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

// U+00A0, U+2000–U+200D, U+202F, U+2060, U+FEFF.
const CODES = new Set([0x00a0, ...range(0x2000, 0x200d), 0x202f, 0x2060, 0xfeff]);
const BINARY = /\.(png|jpe?g|gif|ico|pdf|woff2?)$/i;

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((name) => name !== "" && !BINARY.test(name));

let found = 0;
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // plik usunięty z dysku, ale jeszcze w indeksie
  }
  text.split("\n").forEach((line, index) => {
    for (const char of line) {
      const code = char.codePointAt(0) ?? 0;
      if (CODES.has(code)) {
        const hex = code.toString(16).toUpperCase().padStart(4, "0");
        fail(`${file}:${index + 1}: niewidoczny znak U+${hex} — zapisz go kodem`);
        found++;
      }
    }
  });
}
if (found === 0) {
  pass(`brak niewidocznych znaków w plikach tekstowych (${files.length})`);
}
