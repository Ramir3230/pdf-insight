import { getDocument } from "pdfjs-dist";
import type { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";

// Odczyt tekstu i liczby stron z PDF przez pdf.js. Plik nie opuszcza przeglądarki: dalej idzie
// tylko tekst.

export type PdfTextErrorCode = "noText" | "password" | "damaged" | "readFailed";

export class PdfTextError extends Error {
  readonly code: PdfTextErrorCode;

  constructor(code: PdfTextErrorCode) {
    super(`PDF: ${code}`);
    this.name = "PdfTextError";
    this.code = code;
  }
}

export type PdfText = { text: string; pages: number };

// Tekst strony z elementów pdf.js. hasEOL oznacza koniec linii. Spacje w linii zwijamy do jednej
// i pomijamy puste linie: model dostaje mniej tokenów, a treść się nie zmienia.
function pageText(items: readonly (TextItem | TextMarkedContent)[]): string {
  let raw = "";
  for (const item of items) {
    // TextMarkedContent to znaczniki struktury dokumentu, bez tekstu.
    if ("str" in item) {
      raw += item.hasEOL ? `${item.str}\n` : item.str;
    }
  }
  return raw
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n");
}

// pdf.js zgłasza błędy jako obiekty z nazwą klasy w `name`.
export function toPdfTextError(error: unknown): PdfTextError {
  const name = error instanceof Error ? error.name : "";
  if (name === "PasswordException") {
    return new PdfTextError("password");
  }
  if (name === "InvalidPDFException") {
    return new PdfTextError("damaged");
  }
  return new PdfTextError("readFailed");
}

export async function extractPdfText(data: Uint8Array): Promise<PdfText> {
  const task = getDocument({ data });
  try {
    const pdf = await task.promise;
    const pages: string[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      pages.push(pageText(content.items));
    }

    const text = pages.filter((page) => page !== "").join("\n\n");
    // Bez żadnej litery ani cyfry to skan albo same obrazy: bez OCR nie ma czego analizować.
    if (!/[\p{L}\p{N}]/u.test(text)) {
      throw new PdfTextError("noText");
    }
    return { text, pages: pdf.numPages };
  } catch (error) {
    throw error instanceof PdfTextError ? error : toPdfTextError(error);
  } finally {
    // Zwalnia pamięć dokumentu w workerze — także po błędzie.
    await task.destroy();
  }
}
