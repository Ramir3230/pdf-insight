import { describe, expect, it } from "vitest";
import { formatAmount, formatDate, jsonFileName, languageName } from "./format.js";

// Intl wstawia twarde spacje (np. między tysiącami i przed „zł”). Porównujemy po zamianie
// każdego białego znaku na zwykłą spację, żeby w testach nie było niewidocznych znaków.
function plain(text: string): string {
  return text.replace(/\s/g, " ");
}

describe("formatAmount", () => {
  it("formatuje kwotę z walutą po polsku", () => {
    expect(plain(formatAmount(12500, "PLN"))).toBe("12 500,00 zł");
    expect(plain(formatAmount(68080.5, "PLN"))).toBe("68 080,50 zł");
    expect(plain(formatAmount(8600, "EUR"))).toBe("8600,00 €");
    expect(plain(formatAmount(890, "USD"))).toBe("890,00 USD");
  });

  it("bez waluty pokazuje samą liczbę — niczego nie dopisuje", () => {
    expect(plain(formatAmount(1250, null))).toBe("1250,00");
  });
});

describe("formatDate", () => {
  // Testy działają w strefie America/Los_Angeles (vite.config.ts), gdzie północ UTC to jeszcze
  // poprzedni dzień — bez timeZone: "UTC" w formacie data przesunęłaby się o dzień.
  it("pokazuje datę ISO słownie po polsku, bez przesunięcia o dzień", () => {
    expect(formatDate("2026-03-12")).toBe("12 marca 2026");
    expect(formatDate("2028-12-31")).toBe("31 grudnia 2028");
    expect(formatDate("2026-01-01")).toBe("1 stycznia 2026");
  });
});

describe("languageName", () => {
  it("zamienia kod ISO 639-1 na nazwę po polsku", () => {
    expect(languageName("pl")).toBe("polski");
    expect(languageName("en")).toBe("angielski");
  });

  it("nieznany kod zostawia bez zmian", () => {
    expect(languageName("xx")).toBe("xx");
  });
});

describe("jsonFileName", () => {
  it("zamienia rozszerzenie .pdf na -analiza.json", () => {
    expect(jsonFileName("umowa.pdf")).toBe("umowa-analiza.json");
    expect(jsonFileName("Umowa 14.PDF")).toBe("Umowa 14-analiza.json");
  });

  it("plik bez nazwy dostaje nazwę zastępczą", () => {
    expect(jsonFileName(".pdf")).toBe("dokument-analiza.json");
  });
});
