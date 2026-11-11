import type { AnalyzeErrorCode } from "../api/analyzeClient.js";
import { MAX_FILE_MB } from "./pdfFile.js";
import type { ReadErrorCode } from "./readPdf.js";
import { MAX_TEXT_CHARS, type AnalysisResult } from "./schema.js";

// Wszystkie teksty interfejsu w jednym miejscu: łatwo je przejrzeć i poprawić bez szukania po
// komponentach.

// Polska liczba mnoga ma trzy formy: 1 strona, 2–4 strony, 5–21 stron, 22–24 strony…
// Intl.PluralRules zna te reguły, więc nie liczymy końcówek ręcznie.
type PluralForms = { one: string; few: string; many: string };

const polishPlural = new Intl.PluralRules("pl");

export function countLabel(count: number, forms: PluralForms): string {
  const category = polishPlural.select(count);
  let word = forms.many;
  if (category === "one") {
    word = forms.one;
  } else if (category === "few") {
    word = forms.few;
  }
  return `${count.toLocaleString("pl-PL")} ${word}`;
}

const PAGES: PluralForms = { one: "strona", few: "strony", many: "stron" };
const CHARACTERS: PluralForms = { one: "znak", few: "znaki", many: "znaków" };

type DocumentType = AnalysisResult["document"]["type"];

export const messages = {
  appName: "PDF Insight",
  tagline: "Krótkie podsumowanie i uporządkowane dane JSON z pliku PDF.",
  // Stan pusty: co użytkownik dostanie, zanim wgra plik.
  intro:
    "Wgraj umowę, fakturę, ofertę albo raport w PDF. Dostaniesz podsumowanie w 3–5 zdaniach, " +
    "kluczowe punkty, organizacje i osoby, kwoty, daty oraz plik JSON do pobrania.",
  privacyNote:
    "Tekst z pliku zostanie wysłany do analizy przez Claude API (Anthropic). Sam plik PDF " +
    "nie opuszcza przeglądarki.",
  upload: {
    dropHint: "Przeciągnij tutaj plik PDF",
    or: "albo",
    choose: "Wybierz plik",
    chooseAnother: "Wybierz inny plik",
    limits: `Tylko PDF z warstwą tekstową, do ${MAX_FILE_MB} MB.`,
    reading: "Odczytuję tekst z pliku…",
  },
  readSummary: (fileName: string, pages: number, characters: number) =>
    `Odczytano plik „${fileName}”: ${countLabel(pages, PAGES)}, ` +
    `${countLabel(characters, CHARACTERS)} tekstu.`,
  readErrors: {
    notOneFile: "Wybierz jeden plik PDF.",
    empty: "Ten plik jest pusty.",
    tooLarge: `Plik jest większy niż ${MAX_FILE_MB} MB. Wybierz mniejszy plik PDF.`,
    notPdf: "To nie jest plik PDF. Wybierz plik w formacie PDF.",
    noText:
      "Ten PDF nie ma warstwy tekstowej albo ma jej bardzo mało — to prawdopodobnie skan. " +
      "Skanów nie obsługujemy: wybierz PDF, w którym da się zaznaczyć tekst.",
    password: "Ten PDF jest chroniony hasłem. Zapisz go bez hasła i spróbuj ponownie.",
    damaged: "Plik PDF jest uszkodzony i nie da się go odczytać.",
    readFailed: "Nie udało się odczytać pliku. Spróbuj ponownie.",
  } satisfies Record<ReadErrorCode, string>,
  analyze: {
    analyzing: "Analizuję dokument — zwykle trwa to 10–20 sekund…",
    retry: "Spróbuj ponownie",
  },
  analyzeErrors: {
    not_configured: "Aplikacja nie ma skonfigurowanego adresu serwera analizy.",
    text_too_long:
      `Dokument jest za długi do analizy: najwyżej ` +
      `${MAX_TEXT_CHARS.toLocaleString("pl-PL")} znaków tekstu.`,
    network: "Brak połączenia z serwerem analizy. Sprawdź internet i spróbuj ponownie.",
    timeout:
      "Analiza trwała zbyt długo. Spróbuj ponownie — a jeśli to się powtórzy, wybierz krótszy " +
      "dokument.",
    rate_limited: "Za dużo analiz w krótkim czasie. Spróbuj ponownie za kilka minut.",
    refused: "Model AI odmówił analizy tego dokumentu. Spróbuj z innym plikiem.",
    invalid_response:
      "AI zwróciło niepoprawny wynik, także przy ponownej próbie. Spróbuj ponownie.",
    unavailable: "Usługa AI jest chwilowo niedostępna. Spróbuj ponownie za chwilę.",
    misconfigured:
      "Serwer analizy nie może teraz korzystać z usługi AI (np. klucz albo limit wydatków). " +
      "Spróbuj później.",
    rejected: "Serwer odrzucił to żądanie. Spróbuj z innym plikiem.",
    bad_result:
      "Serwer zwrócił wynik niezgodny ze schematem, więc go nie pokazujemy. Odśwież stronę " +
      "i spróbuj ponownie.",
    server: "Błąd serwera analizy. Spróbuj ponownie.",
  } satisfies Record<AnalyzeErrorCode, string>,
  result: {
    untitled: "Dokument bez tytułu",
    type: "Rodzaj",
    date: "Data dokumentu",
    language: "Język",
    file: "Plik",
    elapsed: (seconds: number) => `Wynik po ${seconds.toLocaleString("pl-PL")} s`,
    summary: "Podsumowanie",
    keyPoints: "Kluczowe punkty",
    amounts: "Kwoty",
    dates: "Daty",
    organizations: "Organizacje",
    people: "Osoby",
    keywords: "Słowa kluczowe",
    none: "Brak w dokumencie",
    download: "Pobierz JSON",
    preview: "Podgląd JSON",
  },
  documentTypes: {
    faktura: "Faktura",
    umowa: "Umowa",
    oferta: "Oferta",
    raport: "Raport",
    inne: "Inny dokument",
  } satisfies Record<DocumentType, string>,
  pagesLabel: (pages: number) => countLabel(pages, PAGES),
};
