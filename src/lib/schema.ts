import { z } from "zod";

// Schematy wyniku analizy PDF. Są dwa, bo model i aplikacja potrzebują trochę innego kształtu:
// - modelOutputSchema — odpowiedź Claude (structured outputs), sprawdzana na backendzie;
// - analysisResultSchema — wynik końcowy według briefu: sprawdzany na froncie przed wyświetleniem,
//   w tej postaci trafia do pobranego pliku JSON.
//
// Każde pole jest wymagane (nigdzie nie ma .optional()): model musi zwrócić każdy klucz, a brak
// informacji zapisuje jako null albo pustą listę — reguła briefu.
//
// Structured outputs same pilnują typów, list wartości, null i formatu daty. Ograniczeń długości
// (3–5 zdań, 3–7 punktów, niepusty tekst) API nie egzekwuje: według dokumentacji SDK usuwa je ze
// schematu wysyłanego do modelu i sprawdza dopiero gotową odpowiedź.

// Tekst z treścią: po obcięciu spacji z brzegów zostaje co najmniej jeden znak. Brak tekstu to
// null albo [], a nie pusty napis ani same spacje.
const nonEmptyText = z.string().trim().min(1);

// ISO 8601, tylko pełna data RRRR-MM-DD. Sprawdza też kalendarz: 2026-02-30 nie przejdzie.
const isoDate = z.iso.date();

// ISO 639-1: dwie małe litery, np. "pl". Wzorzec sprawdza tylko postać kodu, nie to, czy taki
// język istnieje ("xx" przejdzie). Lista kodów z Intl mogłaby się różnić między przeglądarką
// a Node, a ten sam schemat działa w obu miejscach.
const languageCode = z.string().regex(/^[a-z]{2}$/);

// ISO 4217: trzy wielkie litery, np. "PLN". Tak samo: postać kodu, nie jego istnienie.
const currencyCode = z.string().regex(/^[A-Z]{3}$/);

// Dane pliku, które zna przeglądarka: nazwa pliku i liczba stron z pdf.js. Modelu o nie nie pytamy.
// Nazwa do 255 znaków — tyle pozwalają systemy plików. Frontend dłuższą skraca przed wysłaniem.
export const MAX_FILE_NAME_CHARS = 255;

export const sourceFileSchema = z.object({
  fileName: nonEmptyText.max(MAX_FILE_NAME_CHARS),
  pages: z.number().int().positive(),
});

const modelDocumentSchema = z.object({
  language: languageCode,
  type: z.enum(["faktura", "umowa", "oferta", "raport", "inne"]),
  title: nonEmptyText.nullable(),
  date: isoDate.nullable(),
});

export const modelOutputSchema = z.object({
  document: modelDocumentSchema,
  // Lista zdań, a nie jeden tekst: liczba elementów to liczba zdań. Liczenie kropek w tekście
  // myli się na skrótach, np. „sp. z o.o.”.
  summary: z.array(nonEmptyText).min(3).max(5),
  keyPoints: z.array(nonEmptyText).min(3).max(7),
  entities: z.object({
    organizations: z.array(nonEmptyText),
    people: z.array(nonEmptyText),
  }),
  amounts: z.array(
    z.object({
      value: z.number(),
      // null, gdy dokument podaje kwotę bez waluty: model nie zgaduje.
      currency: currencyCode.nullable(),
      context: nonEmptyText,
    }),
  ),
  dates: z.array(
    z.object({
      date: isoDate,
      context: nonEmptyText,
    }),
  ),
  keywords: z.array(nonEmptyText),
});

// Wynik końcowy: odpowiedź modelu, dane pliku na początku `document` i podsumowanie jako jeden
// tekst. Schemat układa klucze w kolejności z briefu — w tej kolejności zapisuje się pobrany plik
// JSON. Nieznane klucze usuwa bez błędu: frontend i backend wdrażają się osobno, więc nowe pole
// z backendu nie może zepsuć starszej wersji frontendu.
export const analysisResultSchema = modelOutputSchema.extend({
  document: z.object({
    ...sourceFileSchema.shape,
    ...modelDocumentSchema.shape,
  }),
  summary: nonEmptyText,
});

// Najdłuższy tekst dokumentu, jaki przyjmuje backend: ok. 60–70 tys. tokenów. Dłuższy tekst to
// wyższy koszt i dłuższe czekanie na wynik. Ten sam limit sprawdza frontend przed wysłaniem.
export const MAX_TEXT_CHARS = 200_000;

// Żądanie do backendu: tekst wyciągnięty z PDF w przeglądarce i dane pliku.
export const analyzeRequestSchema = sourceFileSchema.extend({
  text: nonEmptyText.max(MAX_TEXT_CHARS),
});

export type SourceFile = z.infer<typeof sourceFileSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type ModelOutput = z.infer<typeof modelOutputSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

// Składa wynik końcowy z odpowiedzi modelu i danych pliku. Obie części muszą być wcześniej
// sprawdzone swoimi schematami: typ TypeScript nie pilnuje np. tego, że liczba stron jest dodatnia.
export function toAnalysisResult(output: ModelOutput, file: SourceFile): AnalysisResult {
  return {
    ...output,
    document: { fileName: file.fileName, pages: file.pages, ...output.document },
    summary: output.summary.join(" "),
  };
}
