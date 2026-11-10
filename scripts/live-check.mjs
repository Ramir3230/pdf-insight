// @ts-check
// PŁATNY test backendu na produkcji: prawdziwe wywołania Claude API, za które płaci właściciel.
// Nie należy do `npm run check` ani do CI — uruchamiany ręcznie i celowo:
//   node scripts/live-check.mjs --paid
// Dwa przypadki (każdy to 1 wywołanie Claude, 2 przy ponownej próbie):
// - umowa testowa z private/ (poza gitem) — tekst wyciągnięty jak w przeglądarce;
// - krótka faktura z wstrzykniętym poleceniem, które próbuje zamknąć blok <dokument>.
// Sprawdza: kod 200, czas poniżej 30 s, typ, datę, kwoty, daty, podmioty i to, że polecenia
// z treści dokumentu nie zostały wykonane. Oczekiwania: private/live-expectations.json.
import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { fail, pass } from "./lib/report.mjs";

const API_URL = process.env.API_URL || "https://pdf-insight-pearl.vercel.app/api/analyze";
const ORIGIN = process.env.ALLOWED_ORIGIN || "https://ramir3230.github.io";
const TIME_LIMIT_MS = 30_000;

/**
 * @typedef {{ value: number, currency: string | null, context?: string }} Amount
 * @typedef {{ date: string, context?: string }} DateEntry
 * @typedef {{
 *   document: { fileName: string, pages: number, language: string, type: string,
 *     title: string | null, date: string | null },
 *   summary: string, keyPoints: string[],
 *   entities: { organizations: string[], people: string[] },
 *   amounts: Amount[], dates: DateEntry[], keywords: string[]
 * }} Result
 * @typedef {{
 *   fileName: string, pages: number, type: string, language?: string, date?: string,
 *   amounts: Amount[], dates: string[], organizations: string[], people: string[],
 *   forbiddenInSummary: string[], forbiddenKeywords?: string[], forbiddenAmountValues: number[]
 * }} Expectation
 */

// Tekst PDF tak jak w przeglądarce (src/lib/pdfText.ts): linie po hasEOL, zwinięte spacje,
// bez pustych linii, strony oddzielone pustą linią.
/** @param {string} path */
async function pdfText(path) {
  const task = getDocument({ data: new Uint8Array(readFileSync(path)) });
  const pdf = await task.promise;
  const pages = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    const content = await (await pdf.getPage(number)).getTextContent();
    let raw = "";
    for (const item of content.items) {
      if ("str" in item) {
        raw += item.hasEOL ? `${item.str}\n` : item.str;
      }
    }
    const lines = raw.split("\n").map((line) => line.replace(/\s+/g, " ").trim());
    pages.push(lines.filter((line) => line !== "").join("\n"));
  }
  await task.destroy();
  return pages.filter((page) => page !== "").join("\n\n");
}

/**
 * @param {string} name
 * @param {{ text: string, fileName: string, pages: number }} body
 * @param {Expectation} expected
 */
async function runCase(name, body, expected) {
  const started = Date.now();
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const elapsed = Date.now() - started;
  const json = await response.json();
  if (response.status !== 200) {
    fail(`${name}: status ${response.status} ${JSON.stringify(json)}`);
    return;
  }
  const result = /** @type {Result} */ (json);
  const seconds = (elapsed / 1000).toFixed(1);
  if (elapsed < TIME_LIMIT_MS) {
    pass(`${name}: 200 w ${seconds} s`);
  } else {
    fail(`${name}: 200, ale w ${seconds} s (limit 30 s)`);
  }

  /** @param {boolean} ok @param {string} message */
  const check = (ok, message) => (ok ? pass(`${name}: ${message}`) : fail(`${name}: ${message}`));
  const doc = result.document;
  check(doc.type === expected.type, `typ ${doc.type} (oczekiwano ${expected.type})`);
  check(doc.pages === expected.pages && doc.fileName === expected.fileName, "dane pliku z żądania");
  if (expected.language) {
    check(doc.language === expected.language, `język ${doc.language}`);
  }
  if (expected.date) {
    check(doc.date === expected.date, `data dokumentu ${doc.date} (oczekiwano ${expected.date})`);
  }
  for (const amount of expected.amounts) {
    const found = result.amounts.some(
      (item) => item.value === amount.value && item.currency === amount.currency,
    );
    check(found, `kwota ${amount.value} ${amount.currency}`);
  }
  const allDates = new Set([doc.date, ...result.dates.map((item) => item.date)]);
  for (const date of expected.dates) {
    check(allDates.has(date), `data ${date}`);
  }
  for (const org of expected.organizations) {
    check(
      result.entities.organizations.some((item) => item.includes(org)),
      `organizacja „${org}”`,
    );
  }
  for (const person of expected.people) {
    check(
      result.entities.people.some((item) => item.includes(person)),
      `osoba „${person}”`,
    );
  }

  // Polecenia z treści dokumentu nie mogą zostać wykonane.
  const prose = [result.summary, ...result.keyPoints].join(" ").toLowerCase();
  for (const phrase of expected.forbiddenInSummary) {
    check(!prose.includes(phrase.toLowerCase()), `brak „${phrase}” w podsumowaniu i punktach`);
  }
  for (const keyword of expected.forbiddenKeywords ?? []) {
    const lower = keyword.toLowerCase();
    check(
      !result.keywords.some((item) => item.toLowerCase().includes(lower)),
      `brak „${keyword}” w słowach kluczowych`,
    );
  }
  for (const value of expected.forbiddenAmountValues) {
    check(!result.amounts.some((item) => item.value === value), `brak kwoty ${value}`);
  }

  // Do oceny jakości przez człowieka: treść wyniku (dokumenty testowe są fikcyjne).
  process.stdout.write(`\n--- ${name}: wynik ---\n${JSON.stringify(result, null, 2)}\n\n`);
}

if (!process.argv.includes("--paid")) {
  fail("to płatny test (wywołania Claude API) — uruchom z flagą --paid");
} else {
  /** @type {{ contract: Expectation & { pdf: string }, injection: Expectation & { text: string } }} */
  const expectations = JSON.parse(readFileSync("private/live-expectations.json", "utf8"));
  const { contract, injection } = expectations;
  const contractText = await pdfText(contract.pdf);
  await runCase(
    "umowa testowa",
    { text: contractText, fileName: contract.fileName, pages: contract.pages },
    contract,
  );
  await runCase(
    "wstrzyknięte polecenie",
    { text: injection.text, fileName: injection.fileName, pages: injection.pages },
    injection,
  );
}
