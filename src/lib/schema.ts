import { z } from "zod";

// Schematy wyniku analizy PDF. Są dwa, bo model i aplikacja potrzebują trochę innego kształtu:
// - modelOutputSchema — odpowiedź Claude (structured outputs), sprawdzana na backendzie;
// - analysisResultSchema — wynik końcowy według briefu: sprawdzany na froncie przed wyświetleniem,
//   w tej postaci trafia do pobranego pliku JSON.
//
// Structured outputs same pilnują typów, list wartości, null i formatu daty. Ograniczeń długości
// (3–5 zdań, 3–7 punktów, niepusty tekst) API nie egzekwuje: według dokumentacji SDK usuwa je ze
// schematu wysyłanego do modelu i sprawdza odpowiedź u siebie, a błąd oznacza ponowną próbę.
// Dlatego w schemacie modelu nie ma .optional(): każde pole jest wymagane, a brak informacji
// to null albo pusta lista.

// Tekst bez treści to null albo [], a nie pusty napis.
const nonEmptyText = z.string().min(1);

// ISO 8601, tylko pełna data RRRR-MM-DD. Sprawdza też kalendarz: 2026-02-30 nie przejdzie.
const isoDate = z.iso.date();

// ISO 639-1: dwie małe litery, np. "pl". Wzorzec zamiast listy kodów, bo ten sam schemat działa
// w przeglądarce i w Node, a lista kodów z Intl może się między nimi różnić.
const languageCode = z.string().regex(/^[a-z]{2}$/);

// ISO 4217: trzy wielkie litery, np. "PLN". Wzorzec z tego samego powodu co wyżej.
const currencyCode = z.string().regex(/^[A-Z]{3}$/);

// Bez fileName i pages: te dane znamy z pliku i z pdf.js, więc nie prosimy o nie modelu.
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
      currency: currencyCode,
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
// tekst. Kolejność kluczy jak w briefie — w tej kolejności zapisuje się pobrany plik JSON.
// Nieznane klucze schemat usuwa bez błędu: frontend i backend wdrażają się osobno, więc nowe pole
// z backendu nie może zepsuć starszej wersji frontendu.
export const analysisResultSchema = modelOutputSchema.extend({
  document: z.object({
    fileName: nonEmptyText,
    pages: z.number().int().positive(),
    ...modelDocumentSchema.shape,
  }),
  summary: nonEmptyText,
});

export type ModelOutput = z.infer<typeof modelOutputSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export interface SourceFile {
  fileName: string;
  pages: number;
}

// Składa wynik końcowy z odpowiedzi modelu i danych pliku. Wywołuje go backend.
export function toAnalysisResult(output: ModelOutput, file: SourceFile): AnalysisResult {
  return {
    ...output,
    document: { fileName: file.fileName, pages: file.pages, ...output.document },
    summary: output.summary.join(" "),
  };
}
