// @ts-check
// Test dymny po deployu, na prawdziwych adresach:
// - demo na GitHub Pages odpowiada 200, ma oczekiwaną wersję (w CI: commit z GITHUB_SHA),
//   a jego skrypt się ładuje;
// - worker pdf.js, do którego odwołuje się skrypt, odpowiada 200 z typem JavaScript (inaczej
//   przeglądarka go nie uruchomi i odczyt PDF się nie uda);
// - backend jest dostępny bez logowania (adres produkcyjny Vercel, nie podgląd);
// - CORS przepuszcza domenę demo i odrzuca obcą.
// Nie wysyła tekstu do analizy, więc nie kosztuje nic w Claude API.
// Użycie: node scripts/smoke.mjs [--api-only]
import { fail, pass } from "./lib/report.mjs";

const DEMO_URL = process.env.DEMO_URL || "https://ramir3230.github.io/pdf-insight/";
const API_URL = process.env.API_URL || "https://pdf-insight-pearl.vercel.app/api/analyze";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://ramir3230.github.io";
const FOREIGN_ORIGIN = "https://example.com";
// W GitHub Actions to commit, który właśnie został zbudowany; lokalnie wersji nie sprawdzamy.
const EXPECTED_BUILD = process.env.GITHUB_SHA || "";
const apiOnly = process.argv.includes("--api-only");

const ATTEMPTS = 12;
const RETRY_DELAY_MS = 10_000;
const REQUEST_TIMEOUT_MS = 15_000;

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch z limitem czasu: zawieszony serwer nie blokuje testu na kilka minut.
 * @param {string} url
 * @param {RequestInit} [init]
 */
function request(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

/**
 * Powtarza zapytanie, dopóki `isReady` nie zwróci true. GitHub Pages potrzebuje chwili, zanim
 * nowa wersja trafi na CDN, a pojedynczy błąd sieci nie powinien oblewać testu.
 * Zwraca ostatnią odpowiedź (z treścią) albo opis ostatniego błędu.
 * @param {string} url
 * @param {(status: number, body: string) => boolean} isReady
 * @returns {Promise<{ status: number, body: string } | { error: string }>}
 */
async function fetchUntil(url, isReady) {
  /** @type {{ status: number, body: string } | { error: string }} */
  let last = { error: "brak odpowiedzi" };
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const response = await request(url);
      last = { status: response.status, body: await response.text() };
      if (isReady(last.status, last.body)) {
        return last;
      }
    } catch (error) {
      last = { error: error instanceof Error ? error.message : String(error) };
    }
    if (attempt < ATTEMPTS) {
      await sleep(RETRY_DELAY_MS);
    }
  }
  return last;
}

/** @param {string} html */
function buildIdOf(html) {
  return /<meta name="build" content="([^"]*)"/.exec(html)?.[1] ?? "";
}

async function checkDemo() {
  const page = await fetchUntil(
    DEMO_URL,
    (status, body) => status === 200 && (!EXPECTED_BUILD || buildIdOf(body) === EXPECTED_BUILD),
  );
  if ("error" in page) {
    fail(`demo ${DEMO_URL}: ${page.error}`);
    return;
  }
  if (page.status !== 200) {
    fail(`demo ${DEMO_URL}: status ${page.status}, oczekiwano 200`);
    return;
  }
  const build = buildIdOf(page.body);
  if (EXPECTED_BUILD && build !== EXPECTED_BUILD) {
    fail(`demo: wersja ${build || "brak"}, oczekiwano ${EXPECTED_BUILD} (stara wersja na CDN?)`);
    return;
  }
  const script = /<script[^>]+type="module"[^>]+src="([^"]+)"/.exec(page.body)?.[1];
  if (!script) {
    fail(`demo ${DEMO_URL}: w HTML brak skryptu aplikacji`);
    return;
  }
  const scriptUrl = new URL(script, DEMO_URL).href;
  const asset = await fetchUntil(scriptUrl, (status) => status === 200);
  if ("error" in asset || asset.status !== 200) {
    const reason = "error" in asset ? asset.error : `status ${asset.status}`;
    fail(`demo: skrypt ${scriptUrl}: ${reason}`);
    return;
  }
  pass(`demo ${DEMO_URL}: 200, wersja ${build || "?"}, skrypt aplikacji się ładuje`);
  await checkPdfWorker(asset.body, scriptUrl);
}

/**
 * @param {string} script treść skryptu aplikacji
 * @param {string} scriptUrl adres skryptu (do rozwiązania ścieżki workera)
 */
async function checkPdfWorker(script, scriptUrl) {
  // Adres wstawia Vite z importu `?url` (src/lib/pdfWorker.ts), np. /pdf-insight/assets/pdf.worker.min-HASH.mjs.
  const path = /[^"'`\s]*\/assets\/pdf\.worker[^"'`\s]*\.mjs/.exec(script)?.[0];
  if (!path) {
    fail(`demo: skrypt aplikacji nie odwołuje się do workera pdf.js`);
    return;
  }
  const workerUrl = new URL(path, scriptUrl).href;
  try {
    const response = await request(workerUrl);
    const type = response.headers.get("Content-Type") ?? "";
    await response.arrayBuffer();
    if (response.status !== 200 || !/javascript/.test(type)) {
      fail(`demo: worker ${workerUrl}: status ${response.status}, Content-Type ${type || "brak"}`);
      return;
    }
    pass(`demo: worker pdf.js się ładuje (${type})`);
  } catch (error) {
    fail(`demo: worker ${workerUrl}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** @param {string} origin */
function preflight(origin) {
  return request(API_URL, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
}

async function checkApiLogin() {
  // Logowanie sprawdzamy POST-em: na preflight (OPTIONS) Vercel Deployment Protection odpowiada
  // 204 nawet na chronionym adresie. Puste body backend odrzuca przed wywołaniem Claude API.
  const post = await request(API_URL, {
    method: "POST",
    headers: { Origin: ALLOWED_ORIGIN, "Content-Type": "application/json" },
    body: "{}",
  });
  if (post.status === 401) {
    fail(`API ${API_URL}: 401, wymaga logowania — to nie jest adres produkcyjny Vercel`);
    return false;
  }
  const allowOrigin = post.headers.get("Access-Control-Allow-Origin");
  const body = await post.text();
  // Zaślepka z bloku 1 odpowiada 501 not_implemented. Inny kod oznacza, że backend robi coś
  // innego niż oczekujemy — np. przepuścił puste body dalej.
  if (post.status !== 501 || !body.includes('"not_implemented"')) {
    fail(`API: POST {} zwraca ${post.status}, oczekiwano 501 not_implemented`);
  } else if (allowOrigin !== ALLOWED_ORIGIN) {
    fail(`API: POST z ${ALLOWED_ORIGIN} bez nagłówka Allow-Origin (jest: ${allowOrigin})`);
  } else {
    pass(`API: dostępne bez logowania, POST {} → ${post.status} z nagłówkami CORS`);
  }
  return true;
}

async function checkApiCors() {
  const allowed = await preflight(ALLOWED_ORIGIN);
  const allowOrigin = allowed.headers.get("Access-Control-Allow-Origin");
  if (allowed.status !== 204 || allowOrigin !== ALLOWED_ORIGIN) {
    fail(
      `API: preflight z ${ALLOWED_ORIGIN} zwraca ${allowed.status}, Allow-Origin=${allowOrigin}`,
    );
  } else {
    pass(`API: CORS przepuszcza ${ALLOWED_ORIGIN} (preflight 204)`);
  }

  const foreign = await preflight(FOREIGN_ORIGIN);
  const foreignAllow = foreign.headers.get("Access-Control-Allow-Origin");
  if (foreign.status !== 403 || foreignAllow !== null) {
    fail(
      `API: preflight z ${FOREIGN_ORIGIN} zwraca ${foreign.status}, Allow-Origin=${foreignAllow}`,
    );
  } else {
    pass(`API: CORS odrzuca ${FOREIGN_ORIGIN} (403, bez Allow-Origin)`);
  }
}

try {
  if (!apiOnly) {
    await checkDemo();
  }
  if (await checkApiLogin()) {
    await checkApiCors();
  }
} catch (error) {
  fail(`błąd sieci: ${error instanceof Error ? error.message : String(error)}`);
}
