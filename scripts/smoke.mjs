// @ts-check
// Test dymny po deployu, na prawdziwych adresach:
// - demo na GitHub Pages odpowiada 200, a jego skrypt się ładuje;
// - backend jest dostępny bez logowania (adres produkcyjny Vercel, nie podgląd);
// - CORS przepuszcza domenę demo i odrzuca obcą.
// Nie wysyła tekstu do analizy, więc nie kosztuje nic w Claude API.
// Użycie: API_URL=https://…/api/analyze node scripts/smoke.mjs [--api-only]
import { fail, pass } from "./lib/report.mjs";

const DEMO_URL = process.env.DEMO_URL || "https://ramir3230.github.io/pdf-insight/";
const API_URL = process.env.API_URL || "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://ramir3230.github.io";
const FOREIGN_ORIGIN = "https://example.com";
const apiOnly = process.argv.includes("--api-only");

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * GitHub Pages potrzebuje chwili, zanim nowa wersja trafi na CDN — kilka prób co 10 s.
 * @param {string} url
 */
async function fetchWithRetry(url) {
  let response = await fetch(url);
  for (let attempt = 1; attempt < 6 && response.status !== 200; attempt++) {
    await sleep(10_000);
    response = await fetch(url);
  }
  return response;
}

async function checkDemo() {
  const page = await fetchWithRetry(DEMO_URL);
  if (page.status !== 200) {
    fail(`demo ${DEMO_URL}: status ${page.status}, oczekiwano 200`);
    return;
  }
  const html = await page.text();
  const script = /<script[^>]+type="module"[^>]+src="([^"]+)"/.exec(html)?.[1];
  if (!script) {
    fail(`demo ${DEMO_URL}: w HTML brak skryptu aplikacji`);
    return;
  }
  const scriptUrl = new URL(script, DEMO_URL).href;
  const asset = await fetchWithRetry(scriptUrl);
  if (asset.status !== 200) {
    fail(`demo: skrypt ${scriptUrl} zwraca ${asset.status}`);
    return;
  }
  pass(`demo ${DEMO_URL}: 200, skrypt aplikacji się ładuje`);
}

/** @param {string} origin */
function preflight(origin) {
  return fetch(API_URL, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
}

async function checkApi() {
  if (!API_URL) {
    fail("brak API_URL (adres funkcji, np. https://…vercel.app/api/analyze)");
    return;
  }

  // Logowanie sprawdzamy POST-em: na preflight (OPTIONS) Vercel Deployment Protection odpowiada
  // 204 nawet na chronionym adresie. Puste body backend odrzuca przed wywołaniem Claude API.
  const post = await fetch(API_URL, {
    method: "POST",
    headers: { Origin: ALLOWED_ORIGIN, "Content-Type": "application/json" },
    body: "{}",
  });
  if (post.status === 401) {
    fail(`API ${API_URL}: 401, wymaga logowania — to nie jest adres produkcyjny Vercel`);
    return;
  }
  const postAllow = post.headers.get("Access-Control-Allow-Origin");
  if (postAllow !== ALLOWED_ORIGIN) {
    fail(`API: POST z ${ALLOWED_ORIGIN} zwraca ${post.status}, Allow-Origin=${postAllow}`);
  } else {
    pass(`API: dostępne bez logowania (POST: ${post.status}, Allow-Origin=${postAllow})`);
  }

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

if (!apiOnly) {
  await checkDemo();
}
await checkApi();
