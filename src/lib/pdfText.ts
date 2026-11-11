import { InvalidPDFException, PasswordException, getDocument } from "pdfjs-dist";
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

// Średnio mniej liter na stronę niż ten próg traktujemy jak skan. Sam test „jest choć jedna
// litera” przepuściłby skan z pieczątką albo numerem strony („Docusign Envelope ID: …”), a taki
// plik poszedłby do płatnej analizy AI z bezwartościowym wynikiem. Strona prawdziwego tekstu ma
// setki liter.
export const MIN_LETTERS_PER_PAGE = 50;

// Tekst strony z elementów pdf.js. hasEOL oznacza koniec linii. Elementy mogą mieć spacje na
// brzegach, a puste elementy z hasEOL dają puste linie — po sklejeniu zwijamy spacje do jednej
// i pomijamy puste linie.
export function pageText(items: readonly (TextItem | TextMarkedContent)[]): string {
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

// Błędy z workera pdf.js trafiają do przeglądarki jako obiekty tych samych klas, więc wystarczy
// instanceof.
export function toPdfTextError(error: unknown): PdfTextError {
  if (error instanceof PasswordException) {
    return new PdfTextError("password");
  }
  if (error instanceof InvalidPDFException) {
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
    // Bez OCR skan nie ma czego analizować (patrz MIN_LETTERS_PER_PAGE).
    // PDF bez stron (pdf.js go otwiera, numPages = 0) też nie ma czego analizować.
    const letters = text.match(/\p{L}/gu)?.length ?? 0;
    if (pdf.numPages === 0 || letters < MIN_LETTERS_PER_PAGE * pdf.numPages) {
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
