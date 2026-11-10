import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  analysisResultSchema,
  modelOutputSchema,
  toAnalysisResult,
  type ModelOutput,
} from "./schema.js";

// Przykład z briefu uzupełniony do minimum schematu: w briefie podsumowanie ma jedno zdanie,
// a keyPoints jedną pozycję. Funkcja, a nie stała: każdy test dostaje własną kopię.
function validOutput(): ModelOutput {
  return {
    document: { language: "pl", type: "umowa", title: "Umowa serwisowa", date: "2026-09-01" },
    summary: [
      "Umowa określa zasady serwisu urządzeń dla Przykład sp. z o.o.",
      "Wynagrodzenie za serwis wynosi 12 500 PLN.",
      "Płatność jest należna do 1 października 2026 r.",
    ],
    keyPoints: ["Okres umowy 12 mies.", "Wynagrodzenie 12 500 PLN", "Czas reakcji serwisu 24 h"],
    entities: { organizations: ["Przykład sp. z o.o."], people: [] },
    amounts: [{ value: 12500, currency: "PLN", context: "wynagrodzenie" }],
    dates: [{ date: "2026-10-01", context: "termin płatności" }],
    keywords: ["serwis", "SLA"],
  };
}

const file = { fileName: "umowa.pdf", pages: 4 };

// Kolejność kluczy z przykładu w briefie.
const briefKeys = ["document", "summary", "keyPoints", "entities", "amounts", "dates", "keywords"];
const briefDocumentKeys = ["fileName", "pages", "language", "type", "title", "date"];

// Odrzucenie ma wskazywać dokładnie to pole i nic więcej. Samo `success: false` nie wystarczy:
// test „brak pola” przeszedłby też przez przypadkowy błąd w innym miejscu próbki.
function expectRejectedAt(schema: z.ZodType, value: unknown, path: (string | number)[]): void {
  const result = schema.safeParse(value);
  expect(result.success).toBe(false);
  expect(result.error?.issues.map((issue) => issue.path)).toEqual([path]);
}

function sentences(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Zdanie numer ${index + 1}.`);
}

describe("modelOutputSchema: poprawna odpowiedź", () => {
  it("przyjmuje odpowiedź zgodną z briefem", () => {
    expect(modelOutputSchema.safeParse(validOutput()).success).toBe(true);
  });

  it("przyjmuje brak informacji jako null i puste listy", () => {
    const valid = validOutput();
    const result = modelOutputSchema.safeParse({
      ...valid,
      document: { ...valid.document, title: null, date: null },
      entities: { organizations: [], people: [] },
      amounts: [],
      dates: [],
      keywords: [],
    });
    expect(result.success).toBe(true);
  });

  it("przyjmuje kwotę bez waluty", () => {
    const output = { ...validOutput(), amounts: [{ value: 100, currency: null, context: "kara" }] };
    expect(modelOutputSchema.safeParse(output).success).toBe(true);
  });

  it.each([3, 5])("przyjmuje podsumowanie z %i zdań", (count) => {
    const result = modelOutputSchema.safeParse({ ...validOutput(), summary: sentences(count) });
    expect(result.success).toBe(true);
  });

  it.each([3, 7])("przyjmuje %i kluczowych punktów", (count) => {
    const result = modelOutputSchema.safeParse({ ...validOutput(), keyPoints: sentences(count) });
    expect(result.success).toBe(true);
  });
});

describe("modelOutputSchema: odrzucone odpowiedzi", () => {
  it("odrzuca brak pola", () => {
    const output: Record<string, unknown> = { ...validOutput() };
    delete output.keywords;
    expectRejectedAt(modelOutputSchema, output, ["keywords"]);
  });

  it("odrzuca brak pola, które może mieć wartość null", () => {
    const valid = validOutput();
    const document: Record<string, unknown> = { ...valid.document };
    delete document.title;
    expectRejectedAt(modelOutputSchema, { ...valid, document }, ["document", "title"]);
  });

  it("odrzuca typ dokumentu spoza listy", () => {
    const valid = validOutput();
    const output = { ...valid, document: { ...valid.document, type: "kontrakt" } };
    expectRejectedAt(modelOutputSchema, output, ["document", "type"]);
  });

  it.each(["2026-13-01", "2026-02-30", "01.10.2026", "2026-10", "2026-10-01T10:00:00Z"])(
    "odrzuca datę %s",
    (date) => {
      const output = { ...validOutput(), dates: [{ date, context: "termin płatności" }] };
      expectRejectedAt(modelOutputSchema, output, ["dates", 0, "date"]);
    },
  );

  it("odrzuca złą datę dokumentu", () => {
    const valid = validOutput();
    const output = { ...valid, document: { ...valid.document, date: "1 września 2026" } };
    expectRejectedAt(modelOutputSchema, output, ["document", "date"]);
  });

  it("odrzuca pozycję w dates bez daty", () => {
    const output = { ...validOutput(), dates: [{ date: null, context: "termin płatności" }] };
    expectRejectedAt(modelOutputSchema, output, ["dates", 0, "date"]);
  });

  it.each(["zł", "pln", "EURO", ""])("odrzuca walutę „%s”", (currency) => {
    const output = { ...validOutput(), amounts: [{ value: 100, currency, context: "kara" }] };
    expectRejectedAt(modelOutputSchema, output, ["amounts", 0, "currency"]);
  });

  it.each(["pol", "PL", "polski"])("odrzuca język „%s”", (language) => {
    const valid = validOutput();
    const output = { ...valid, document: { ...valid.document, language } };
    expectRejectedAt(modelOutputSchema, output, ["document", "language"]);
  });

  it.each([2, 6])("odrzuca podsumowanie z %i zdań", (count) => {
    const output = { ...validOutput(), summary: sentences(count) };
    expectRejectedAt(modelOutputSchema, output, ["summary"]);
  });

  it.each([2, 8])("odrzuca %i kluczowych punktów", (count) => {
    const output = { ...validOutput(), keyPoints: sentences(count) };
    expectRejectedAt(modelOutputSchema, output, ["keyPoints"]);
  });

  it.each(["", "   ", "\n"])("odrzuca tekst bez treści: %j", (keyword) => {
    const output = { ...validOutput(), keywords: [keyword] };
    expectRejectedAt(modelOutputSchema, output, ["keywords", 0]);
  });

  it("odrzuca null zamiast pustej listy", () => {
    const valid = validOutput();
    const output = { ...valid, entities: { ...valid.entities, people: null } };
    expectRejectedAt(modelOutputSchema, output, ["entities", "people"]);
  });

  it("odrzuca kwotę zapisaną jako tekst", () => {
    const output = {
      ...validOutput(),
      amounts: [{ value: "12500", currency: "PLN", context: "wynagrodzenie" }],
    };
    expectRejectedAt(modelOutputSchema, output, ["amounts", 0, "value"]);
  });
});

describe("modelOutputSchema: kształt dla modelu", () => {
  it("nie prosi modelu o fileName i pages", () => {
    expect(Object.keys(modelOutputSchema.shape.document.shape)).toEqual([
      "language",
      "type",
      "title",
      "date",
    ]);
  });

  it("nie zawiera konstrukcji bez odpowiednika w JSON Schema", () => {
    // Structured outputs dostają schemat jako JSON Schema, a np. .transform() nie ma w nim
    // odpowiednika i z.toJSONSchema rzuca błąd. To warunek konieczny, a nie pełna zgodność
    // z tym, co SDK wysyła do API.
    expect(() => z.toJSONSchema(modelOutputSchema)).not.toThrow();
  });
});

describe("toAnalysisResult i analysisResultSchema", () => {
  it("składa podsumowanie w jeden tekst i dodaje dane pliku", () => {
    const result = toAnalysisResult(validOutput(), file);
    expect(result.summary).toBe(
      "Umowa określa zasady serwisu urządzeń dla Przykład sp. z o.o. " +
        "Wynagrodzenie za serwis wynosi 12 500 PLN. " +
        "Płatność jest należna do 1 października 2026 r.",
    );
    expect(result.document.fileName).toBe("umowa.pdf");
    expect(result.document.pages).toBe(4);
    expect(analysisResultSchema.safeParse(result).success).toBe(true);
  });

  it("toAnalysisResult układa klucze w kolejności z briefu", () => {
    const result = toAnalysisResult(validOutput(), file);
    expect(Object.keys(result)).toEqual(briefKeys);
    expect(Object.keys(result.document)).toEqual(briefDocumentKeys);
  });

  it("schemat układa klucze w kolejności z briefu, nawet gdy przyszły pomieszane", () => {
    // Plik JSON do pobrania powstanie z wyniku sprawdzonego schematem na froncie.
    const result = toAnalysisResult(validOutput(), file);
    const shuffled = {
      keywords: result.keywords,
      dates: result.dates,
      amounts: result.amounts,
      entities: result.entities,
      keyPoints: result.keyPoints,
      summary: result.summary,
      document: {
        date: result.document.date,
        title: result.document.title,
        type: result.document.type,
        language: result.document.language,
        pages: result.document.pages,
        fileName: result.document.fileName,
      },
    };
    const parsed = analysisResultSchema.parse(shuffled);
    expect(Object.keys(parsed)).toEqual(briefKeys);
    expect(Object.keys(parsed.document)).toEqual(briefDocumentKeys);
  });

  it("odrzuca wynik bez nazwy pliku", () => {
    const result = toAnalysisResult(validOutput(), file);
    const document: Record<string, unknown> = { ...result.document };
    delete document.fileName;
    expectRejectedAt(analysisResultSchema, { ...result, document }, ["document", "fileName"]);
  });

  it.each([0, -1, 1.5])("odrzuca liczbę stron %s", (pages) => {
    const result = toAnalysisResult(validOutput(), file);
    const output = { ...result, document: { ...result.document, pages } };
    expectRejectedAt(analysisResultSchema, output, ["document", "pages"]);
  });

  it("odrzuca puste podsumowanie", () => {
    const result = { ...toAnalysisResult(validOutput(), file), summary: "" };
    expectRejectedAt(analysisResultSchema, result, ["summary"]);
  });

  it("odrzuca surową odpowiedź modelu z podsumowaniem jako listą", () => {
    const result = { ...toAnalysisResult(validOutput(), file), summary: validOutput().summary };
    expectRejectedAt(analysisResultSchema, result, ["summary"]);
  });

  it("usuwa nieznane klucze bez błędu", () => {
    const result = { ...toAnalysisResult(validOutput(), file), newField: "z nowszego backendu" };
    const parsed = analysisResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty("newField");
  });
});
