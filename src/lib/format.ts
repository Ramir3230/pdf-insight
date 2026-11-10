// Formatowanie wartości z wyniku analizy do wyświetlenia po polsku. To tylko widok: w pobieranym
// pliku JSON wartości zostają takie, jak zwrócił backend (liczby, daty ISO, kody).

const plainNumber = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Kwota z walutą ISO 4217, np. 12500 + "PLN" → „12 500,00 zł”. Bez waluty (null) — sama liczba:
// dokument jej nie podał, więc jej nie dopisujemy.
export function formatAmount(value: number, currency: string | null): string {
  if (currency === null) {
    return plainNumber.format(value);
  }
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency }).format(value);
}

// Data ISO RRRR-MM-DD → „12 marca 2026”. Strefa UTC, żeby data nie przesunęła się o dzień.
const longDate = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(isoDate: string): string {
  return longDate.format(new Date(`${isoDate}T00:00:00Z`));
}

// Kod języka ISO 639-1 → nazwa po polsku („pl” → „polski”). Nieznany kod zostaje kodem.
const languageNames = new Intl.DisplayNames(["pl"], { type: "language", fallback: "code" });

export function languageName(code: string): string {
  return languageNames.of(code) ?? code;
}

// Nazwa pobieranego pliku: „umowa.pdf” → „umowa-analiza.json”.
export function jsonFileName(pdfFileName: string): string {
  const base = pdfFileName.replace(/\.pdf$/i, "").trim();
  return `${base || "dokument"}-analiza.json`;
}
