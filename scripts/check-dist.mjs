// @ts-check
// Sprawdza zbudowany frontend pod kątem pułapek GitHub Pages:
// - każdy lokalny adres w index.html zaczyna się od /pdf-insight/ i wskazuje na plik, który
//   naprawdę jest w dist/;
// - worker pdf.js jest w dist/assets, a skrypt aplikacji odwołuje się do niego pełnym adresem;
// - adres backendu z VITE_API_URL jest w skrypcie aplikacji i to adres produkcyjny Vercel, a nie
//   adres konkretnego deploymentu (podgląd wymaga logowania). W CI zmienna jest wymagana,
//   lokalnie — gdy jej nie ma — ten punkt jest pomijany.
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

// Adres konkretnego deploymentu Vercel: <projekt>-<9 znaków hasha>-<zespół>.vercel.app.
// Taki adres jest chroniony logowaniem, więc demo by z niego nie skorzystało.
const DEPLOYMENT_URL = /^https:\/\/[a-z0-9-]+-[a-z0-9]{9}-[a-z0-9-]+\.vercel\.app\//;

function checkApiUrl() {
  const apiUrl = process.env.VITE_API_URL ?? "";
  if (!apiUrl) {
    if (process.env.CI) {
      fail("VITE_API_URL nie jest ustawione w CI — frontend nie wiedziałby, gdzie jest backend");
    } else {
      pass("VITE_API_URL nie ustawione lokalnie — adres backendu w bundle nie jest sprawdzany");
    }
    return;
  }
  if (DEPLOYMENT_URL.test(apiUrl)) {
    fail(`VITE_API_URL ${apiUrl} to adres deploymentu (wymaga logowania), a nie produkcyjny`);
    return;
  }
  const files = existsSync(ASSETS) ? readdirSync(ASSETS) : [];
  const inBundle = files
    .filter((name) => name.endsWith(".js"))
    .some((name) => readFileSync(join(ASSETS, name), "utf8").includes(apiUrl));
  if (!inBundle) {
    fail(`adresu backendu ${apiUrl} nie ma w skryptach ${ASSETS}`);
    return;
  }
  pass(`adres backendu ${apiUrl} jest w bundle`);
}

checkIndexHtml();
checkPdfWorker();
checkApiUrl();
