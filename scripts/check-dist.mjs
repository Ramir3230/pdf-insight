// @ts-check
// Sprawdza zbudowany frontend pod kątem pułapek GitHub Pages:
// - każdy lokalny adres w index.html zaczyna się od /pdf-insight/ i wskazuje na plik, który
//   naprawdę jest w dist/;
// - worker pdf.js jest w dist/assets, a skrypt aplikacji odwołuje się do niego pełnym adresem.
// Użycie: node scripts/check-dist.mjs [katalog] — domyślnie dist (inny katalog do próbek).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fail, pass } from "./lib/report.mjs";

const BASE = "/pdf-insight/";
const DIST = process.argv[2] || "dist";
const ASSETS = join(DIST, "assets");
const indexPath = join(DIST, "index.html");

function checkIndexHtml() {
  if (!existsSync(indexPath)) {
    fail(`brak ${indexPath} (najpierw npm run build)`);
    return;
  }
  const html = readFileSync(indexPath, "utf8");
  const urls = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((match) => match[1] ?? "");
  const local = urls.filter((url) => !/^(https?:|data:|mailto:|#)/.test(url));

  if (!/<script[^>]+type="module"[^>]+src="/.test(html)) {
    fail(`${indexPath}: brak skryptu aplikacji`);
  }
  // Test dymny po deployu rozpoznaje wersję po tym znaczniku (vite.config.ts wstawia commit).
  const build = /<meta name="build" content="([^"]*)"/.exec(html)?.[1];
  if (!build || build.includes("__")) {
    fail(`${indexPath}: brak wersji w <meta name="build"> (jest: ${build ?? "brak"})`);
  }

  let problems = 0;
  for (const url of local) {
    if (!url.startsWith(BASE)) {
      fail(`${indexPath}: adres ${url} nie zaczyna się od ${BASE}`);
      problems++;
    } else if (!existsSync(join(DIST, url.slice(BASE.length)))) {
      fail(`${indexPath}: adres ${url} wskazuje na plik, którego nie ma w ${DIST}/`);
      problems++;
    }
  }
  if (problems === 0) {
    pass(`${indexPath}: ${local.length} lokalnych adresów pod ${BASE}, wszystkie pliki na miejscu`);
  }
}

// Worker pdf.js trafia do dist/assets dzięki importowi `?url` w src/lib/pdfWorker.ts. Bez niego
// albo ze złym adresem odczyt PDF w przeglądarce się nie uda, choć build przejdzie.
function checkPdfWorker() {
  const files = existsSync(ASSETS) ? readdirSync(ASSETS) : [];
  const workers = files.filter((name) => /^pdf\.worker.*\.mjs$/.test(name));
  if (workers.length !== 1) {
    fail(`${ASSETS}: oczekiwano jednego pliku workera pdf.js, jest ${workers.length}`);
    return;
  }
  const workerUrl = `${BASE}assets/${workers[0]}`;
  const scripts = files.filter((name) => name.endsWith(".js"));
  const referencing = scripts.filter((name) =>
    readFileSync(join(ASSETS, name), "utf8").includes(workerUrl),
  );
  if (referencing.length === 0) {
    fail(`${ASSETS}: żaden skrypt nie odwołuje się do workera ${workerUrl}`);
    return;
  }
  pass(`worker pdf.js ${workerUrl} jest w ${ASSETS}, odwołuje się do niego ${referencing[0]}`);
}

checkIndexHtml();
checkPdfWorker();
