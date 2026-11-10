import { InvalidPDFException, PasswordException } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { describe, expect, it } from "vitest";
import {
  MIN_LETTERS_PER_PAGE,
  PdfTextError,
  extractPdfText,
  pageText,
  toPdfTextError,
} from "./pdfText.js";
import { makeTestPdf } from "./testing/makeTestPdf.js";

// Testy extractPdfText uruchamiają prawdziwy pdf.js (w Node bez osobnego workera) na plikach
// z makeTestPdf.

async function errorCodeOf(promise: Promise<unknown>): Promise<string> {
  const error: unknown = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  return error instanceof PdfTextError ? error.code : `inny błąd: ${String(error)}`;
}

// Linia z dokładnie `count` literami (plus spacje), np. "aaaaa aaaaa a".
function lettersLine(count: number): string {
  return "a"
    .repeat(count)
    .replace(/(.{5})/g, "$1 ")
    .trim();
}

const CONTRACT_LINE =
  "Umowa serwisowa nr 14/2026 zawarta w Gdansku pomiedzy firma Alfa i firma Beta";
const PAYMENT_LINE = "Termin platnosci wynagrodzenia uplywa z dniem 2026-10-01 bez wezwania";

describe("extractPdfText", () => {
  it("zwraca tekst wszystkich stron i ich liczbę", async () => {
    const pdf = makeTestPdf([[CONTRACT_LINE, "Strony: Alfa (sp. z o.o.)"], [PAYMENT_LINE]]);
    expect(await extractPdfText(pdf)).toEqual({
      text: `${CONTRACT_LINE}\nStrony: Alfa (sp. z o.o.)\n\n${PAYMENT_LINE}`,
      pages: 2,
    });
  });

  it("pomija strony bez tekstu, ale liczy je do liczby stron", async () => {
    const pdf = makeTestPdf([null, [CONTRACT_LINE, PAYMENT_LINE]]);
    expect(await extractPdfText(pdf)).toEqual({
      text: `${CONTRACT_LINE}\n${PAYMENT_LINE}`,
      pages: 2,
    });
  });

  it("odrzuca PDF bez warstwy tekstowej (skan)", async () => {
    expect(await errorCodeOf(extractPdfText(makeTestPdf([null, null])))).toBe("noText");
  });

  it("odrzuca skan z pieczątką tekstową na każdej stronie", async () => {
    const stamp = ["Docusign Envelope ID: 3F2504E0-4F89-11D3-9A0C"];
    expect(await errorCodeOf(extractPdfText(makeTestPdf([stamp, stamp])))).toBe("noText");
  });

  it(`wymaga średnio ${MIN_LETTERS_PER_PAGE} liter na stronę`, async () => {
    const below = makeTestPdf([[lettersLine(MIN_LETTERS_PER_PAGE - 1)]]);
    const exact = makeTestPdf([[lettersLine(MIN_LETTERS_PER_PAGE)]]);
    expect(await errorCodeOf(extractPdfText(below))).toBe("noText");
    expect((await extractPdfText(exact)).pages).toBe(1);
  });

  it("odrzuca uszkodzony plik", async () => {
    const broken = new TextEncoder().encode("%PDF-1.4\nto nie jest PDF\n%%EOF\n");
    expect(await errorCodeOf(extractPdfText(broken))).toBe("damaged");
  });
});

// Element tekstu pdf.js; pozostałe pola nie mają znaczenia dla pageText.
function item(str: string, hasEOL = false): TextItem {
  return { str, hasEOL, dir: "ltr", transform: [], width: 0, height: 0, fontName: "F1" };
}

describe("pageText", () => {
  it("skleja elementy i łamie linię po hasEOL", () => {
    expect(pageText([item("Umowa "), item("nr 14", true), item("Aneks")])).toBe(
      "Umowa nr 14\nAneks",
    );
  });

  it("zwija spacje na styku elementów do jednej", () => {
    expect(pageText([item("Kwota:  "), item("  12 500", true)])).toBe("Kwota: 12 500");
  });

  it("pomija puste linie i linie z samych spacji", () => {
    expect(pageText([item("Umowa", true), item("", true), item("   ", true), item("Aneks")])).toBe(
      "Umowa\nAneks",
    );
  });

  it("pomija znaczniki struktury bez tekstu", () => {
    expect(pageText([{ type: "beginMarkedContent", id: "1" }, item("Umowa")])).toBe("Umowa");
  });
});

describe("toPdfTextError", () => {
  // Zaszyfrowanego PDF nie da się zbudować w makeTestPdf, więc sprawdzamy tłumaczenie
  // prawdziwych klas błędów pdf.js na kody.
  it("zamienia błędy pdf.js na kody", () => {
    expect(toPdfTextError(new PasswordException("hasło", 1)).code).toBe("password");
    expect(toPdfTextError(new InvalidPDFException("uszkodzony")).code).toBe("damaged");
    expect(toPdfTextError(new Error("inny")).code).toBe("readFailed");
    expect(toPdfTextError("nie Error").code).toBe("readFailed");
  });
});
