import { MAX_FILE_MB } from "./pdfFile.js";
import type { ReadErrorCode } from "./readPdf.js";

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

export const messages = {
  appName: "PDF Insight",
  tagline: "Krótkie podsumowanie i uporządkowane dane JSON z pliku PDF.",
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
      "Ten PDF nie ma warstwy tekstowej — to prawdopodobnie skan. Skanów nie obsługujemy: " +
      "wybierz PDF, w którym da się zaznaczyć tekst.",
    password: "Ten PDF jest chroniony hasłem. Zapisz go bez hasła i spróbuj ponownie.",
    damaged: "Plik PDF jest uszkodzony i nie da się go odczytać.",
    readFailed: "Nie udało się odczytać pliku. Spróbuj ponownie.",
  } satisfies Record<ReadErrorCode, string>,
};
