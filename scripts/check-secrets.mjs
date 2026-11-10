// @ts-check
// Szuka klucza API Anthropic tam, gdzie jego obecność oznacza dyskwalifikację: w plikach repozytorium,
// w całej historii git i w zbudowanym frontendzie (dist/). Sprawdza też, że frontend (src/, dist/)
// nie odwołuje się do zmiennej z kluczem. Znalezionej wartości nigdy nie drukuje — tylko miejsce.
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
 * Numery linii (od 1), w których występuje wzorzec.
 * @param {string} text
 * @param {RegExp | string} pattern
 */
function matchingLines(text, pattern) {
  const lines = text.split("\n");
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

function checkFullHistoryAvailable() {
  if (git(["rev-parse", "--is-shallow-repository"]).trim() === "true") {
    fail("płytki klon git: historia jest niepełna (w CI potrzebne fetch-depth: 0)");
    return false;
  }
  return true;
}

function checkWorkingTree() {
  // Pliki śledzone i nowe, nieignorowane: wszystko, co może trafić do commita.
  const files = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
    .split("\0")
    .filter((file) => file !== "" && existsSync(file));
  let found = false;
  for (const file of files) {
    const lines = matchingLines(readFileSync(file, "utf8"), KEY_PATTERN);
    for (const line of lines) {
      fail(`klucz API w pliku ${file}:${line}`);
      found = true;
    }
  }
  if (!found) {
    pass(`brak klucza API w plikach repozytorium (${files.length} plików)`);
  }
}

function checkHistory() {
  // Każda zmiana w każdym commicie ze wszystkich gałęzi, tagów i stash.
  const log = git([
    "log",
    "--all",
    "-p",
    "--text",
    "--no-color",
    "--no-ext-diff",
    "--format=@@commit %H",
  ]);
  /** @type {Set<string>} */
  const commits = new Set();
  let current = "";
  for (const line of log.split("\n")) {
    if (line.startsWith("@@commit ")) {
      current = line.slice("@@commit ".length, "@@commit ".length + 12);
    } else if (KEY_PATTERN.test(line)) {
      commits.add(current);
    }
  }
  for (const commit of commits) {
    fail(`klucz API w historii git, commit ${commit}`);
  }
  if (commits.size === 0) {
    const count = git(["rev-list", "--all", "--count"]).trim();
    pass(`brak klucza API w historii git (${count} commitów)`);
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

if (checkFullHistoryAvailable()) {
  checkHistory();
}
checkWorkingTree();
checkDirectory("src", [KEY_VARIABLE], `src/ nie odwołuje się do ${KEY_VARIABLE}`);
checkDirectory("dist", [KEY_PATTERN, KEY_VARIABLE], `dist/ bez klucza API i bez ${KEY_VARIABLE}`);
checkEnvExample();
