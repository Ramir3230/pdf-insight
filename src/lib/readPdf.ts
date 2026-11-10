import { checkPdfFiles, type PdfFileErrorCode } from "./pdfFile.js";
import { PdfTextError, extractPdfText, type PdfTextErrorCode } from "./pdfText.js";

// Cała droga od wybranych plików do tekstu: najpierw sprawdzenie pliku, potem pdf.js.
// Nie rzuca wyjątków — każdy problem to kod błędu, który interfejs zamienia na komunikat.

export type ReadErrorCode = PdfFileErrorCode | PdfTextErrorCode;

export type ReadPdfResult =
  { ok: true; fileName: string; text: string; pages: number } | { ok: false; code: ReadErrorCode };

export async function readPdf(files: readonly File[]): Promise<ReadPdfResult> {
  // Całość w try: czytanie pliku może się nie udać już przy sprawdzaniu nagłówka, np. gdy plik
  // zniknął z dysku po wybraniu albo gdy upuszczono folder.
  try {
    const check = await checkPdfFiles(files);
    if (!check.ok) {
      return check;
    }
    const data = new Uint8Array(await check.file.arrayBuffer());
    const { text, pages } = await extractPdfText(data);
    return { ok: true, fileName: check.file.name, text, pages };
  } catch (error) {
    return { ok: false, code: error instanceof PdfTextError ? error.code : "readFailed" };
  }
}
