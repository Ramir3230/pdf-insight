import { describe, expect, it } from "vitest";
import { PdfTextError, extractPdfText, toPdfTextError } from "./pdfText.js";
import { makeTestPdf } from "./testing/makeTestPdf.js";

// Testy uruchamiają prawdziwy pdf.js (w Node bez osobnego workera) na plikach z makeTestPdf.

async function errorCodeOf(promise: Promise<unknown>): Promise<string> {
  const error: unknown = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  return error instanceof PdfTextError ? error.code : `inny błąd: ${String(error)}`;
}

describe("extractPdfText", () => {
  it("zwraca tekst wszystkich stron i ich liczbę", async () => {
    const pdf = makeTestPdf([
      ["Umowa serwisowa nr 14/2026", "Strony: Alfa (sp. z o.o.)"],
      ["Termin platnosci: 2026-10-01"],
    ]);
    expect(await extractPdfText(pdf)).toEqual({
      text: "Umowa serwisowa nr 14/2026\nStrony: Alfa (sp. z o.o.)\n\nTermin platnosci: 2026-10-01",
      pages: 2,
    });
  });

  it("zwija spacje w linii do jednej", async () => {
    const pdf = makeTestPdf([["Kwota:     12 500   PLN"]]);
    expect((await extractPdfText(pdf)).text).toBe("Kwota: 12 500 PLN");
  });

  it("pomija strony bez tekstu, ale liczy je do liczby stron", async () => {
    const pdf = makeTestPdf([null, ["Aneks nr 1"]]);
    expect(await extractPdfText(pdf)).toEqual({ text: "Aneks nr 1", pages: 2 });
  });

  it("odrzuca PDF bez warstwy tekstowej (skan)", async () => {
    expect(await errorCodeOf(extractPdfText(makeTestPdf([null, null])))).toBe("noText");
  });

  it("odrzuca PDF, w którym tekst to same znaki bez liter i cyfr", async () => {
    expect(await errorCodeOf(extractPdfText(makeTestPdf([["- . -"]])))).toBe("noText");
  });

  it("odrzuca uszkodzony plik", async () => {
    const broken = new TextEncoder().encode("%PDF-1.4\nto nie jest PDF\n%%EOF\n");
    expect(await errorCodeOf(extractPdfText(broken))).toBe("damaged");
  });
});

describe("toPdfTextError", () => {
  // Zaszyfrowanego PDF nie da się zbudować w makeTestPdf, więc sprawdzamy samo tłumaczenie błędu
  // pdf.js na kod: pdf.js rozpoznaje błędy po nazwie klasy w `name`.
  function pdfjsError(name: string): Error {
    const error = new Error("pdf.js");
    error.name = name;
    return error;
  }

  it("zamienia błędy pdf.js na kody", () => {
    expect(toPdfTextError(pdfjsError("PasswordException")).code).toBe("password");
    expect(toPdfTextError(pdfjsError("InvalidPDFException")).code).toBe("damaged");
    expect(toPdfTextError(pdfjsError("UnknownErrorException")).code).toBe("readFailed");
    expect(toPdfTextError("nie Error").code).toBe("readFailed");
  });
});
