// @ts-check
// Szuka klucza API Anthropic tam, gdzie jego obecność oznacza dyskwalifikację: w plikach repozytorium,
// w indeksie git (to, co pójdzie do commita), w całej historii git i w zbudowanym frontendzie
// (dist/). Sprawdza też, że frontend (src/, dist/) nie odwołuje się do zmiennej z kluczem.
// Znalezionej wartości nigdy nie drukuje — tylko miejsce.
//
// Tryby:
//   node scripts/check-secrets.mjs            — wszystko (npm run check, CI)
//   node scripts/check-secrets.mjs --staged   — tylko indeks git (hook pre-commit, szybki)
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fail, pass } from "./lib/report.mjs";

// Wzorzec składamy z dwóch części, żeby ten plik sam nie pasował do wzorca.
const KEY_PATTERN = new RegExp("sk-" + "ant-[A-Za-z0-9_-]{20,}");
const KEY_VARIABLE = "ANTHROPIC_API_KEY";

/** @param {string[]} args */
function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
}

/**
 * Usuwa bajty zerowe: plik zapisany w UTF-16 (domyślnie tak robi `>` w PowerShell 5.1) ma je
 * między znakami i bez tego wzorzec by go nie znalazł.
 * @param {string} text
 */
function withoutNulBytes(text) {
  return text.replaceAll("\0", "");
}

/**
 * Numery linii (od 1), w których występuje wzorzec.
 * @param {string} text
 * @param {RegExp | string} pattern
 */
function matchingLines(text, pattern) {
  const lines = withoutNulBytes(text).split("\n");
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const found = typeof pattern === "string" ? line.includes(pattern) : pattern.test(line);
    if (found) {
      result.push(i + 1);
    }
  }
  return result;
}

/** @param {string} dir */
function listFiles(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

function checkIndex() {
  // Zawartość z indeksu, a nie z dysku: plik mógł zostać dodany (git add) z kluczem, a potem
  // poprawiony tylko na dysku. Do commita pójdzie wersja z indeksu.
  const files = git(["ls-files", "-z", "--cached"])
    .split("\0")
    .filter((file) => file !== "");
  let found = false;
  for (const file of files) {
    const staged = git(["show", `:${file}`]);
    for (const line of matchingLines(staged, KEY_PATTERN)) {
      fail(`klucz API w indeksie git: ${file}:${line}`);
      found = true;
    }
  }
  if (!found) {
    pass(`brak klucza API w indeksie git (${files.length} plików)`);
  }
}

function checkWorkingTree() {
  // Nowe pliki, jeszcze niedodane i nieignorowane, oraz bieżące wersje śledzonych plików.
  const files = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
    .split("\0")
    .filter((file) => file !== "" && existsSync(file));
  let found = false;
  for (const file of files) {
    for (const line of matchingLines(readFileSync(file, "utf8"), KEY_PATTERN)) {
      fail(`klucz API w pliku ${file}:${line}`);
      found = true;
    }
  }
  if (!found) {
    pass(`brak klucza API w plikach na dysku (${files.length} plików)`);
  }
}

function checkFullHistoryAvailable() {
  if (git(["rev-parse", "--is-shallow-repository"]).trim() === "true") {
    fail("płytki klon git: historia jest niepełna (w CI potrzebne fetch-depth: 0)");
    return false;
  }
  return true;
}

function checkHistory() {
  // Każdy commit ze wszystkich gałęzi, tagów i stash: wiadomość commita (%B) i zmiany.
  // --diff-merges=first-parent pokazuje też zmiany wniesione przez merge (np. rozwiązanie
  // konfliktu) — bez tej opcji git log -p pomija commity merge.
  const log = git([
    "log",
    "--all",
    "-p",
    "--text",
    "--diff-merges=first-parent",
    "--no-color",
    "--no-ext-diff",
    "--format=@@commit %H%n%B",
  ]);
  /** @type {Set<string>} */
  const commits = new Set();
  let current = "";
  for (const line of withoutNulBytes(log).split("\n")) {
    if (line.startsWith("@@commit ")) {
      current = line.slice("@@commit ".length, "@@commit ".length + 12);
    } else if (KEY_PATTERN.test(line)) {
      commits.add(current);
    }
  }
  for (const commit of commits) {
    fail(`klucz API w historii git, commit ${commit}`);
  }

  // Opisy tagów z adnotacją nie są częścią żadnego commita.
  const tags = git(["for-each-ref", "refs/tags", "--format=%(refname:short)%00%(contents)%00"]);
  const parts = tags.split("\0");
  for (let i = 0; i + 1 < parts.length; i += 2) {
    if (KEY_PATTERN.test(parts[i + 1] ?? "")) {
      fail(`klucz API w opisie tagu ${parts[i]?.trim()}`);
      commits.add(`tag ${parts[i]}`);
    }
  }

  if (commits.size === 0) {
    const count = git(["rev-list", "--all", "--count"]).trim();
    pass(`brak klucza API w historii git (${count} commitów, z wiadomościami i merge'ami)`);
  }
}

/**
 * @param {string} dir
 * @param {Array<RegExp | string>} patterns
 * @param {string} description
 */
function checkDirectory(dir, patterns, description) {
  if (!existsSync(dir)) {
    fail(`brak katalogu ${dir}/ (najpierw npm run build)`);
    return;
  }
  let found = false;
  for (const file of listFiles(dir)) {
    const text = readFileSync(file, "utf8");
    for (const pattern of patterns) {
      for (const line of matchingLines(text, pattern)) {
        const what = typeof pattern === "string" ? pattern : "klucz API";
        fail(`${what} w ${file}:${line}`);
        found = true;
      }
    }
  }
  if (!found) {
    pass(description);
  }
}

function checkEnvExample() {
  const text = readFileSync(".env.example", "utf8");
  // [ \t] zamiast \s: \s obejmuje też znak nowej linii i „przeskakuje” na następną zmienną.
  const filled = new RegExp(`^[ \\t]*${KEY_VARIABLE}[ \\t]*=[ \\t]*\\S`, "m");
  if (filled.test(text)) {
    fail(`.env.example: ${KEY_VARIABLE} ma wpisaną wartość, a powinien być pusty`);
  } else {
    pass(`.env.example: ${KEY_VARIABLE} bez wartości`);
  }
}

if (process.argv.includes("--staged")) {
  checkIndex();
} else {
  if (checkFullHistoryAvailable()) {
    checkHistory();
  }
  checkIndex();
  checkWorkingTree();
  checkDirectory("src", [KEY_VARIABLE], `src/ nie odwołuje się do ${KEY_VARIABLE}`);
  checkDirectory("dist", [KEY_PATTERN, KEY_VARIABLE], `dist/ bez klucza API i bez ${KEY_VARIABLE}`);
  checkEnvExample();
}
