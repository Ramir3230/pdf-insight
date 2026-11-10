// Sprawdzenie pliku, zanim przeczyta go pdf.js. Czyta tylko pierwsze 1024 bajty (nagłówek);
// cały plik czyta dopiero readPdf, po udanym sprawdzeniu. Kolejność sprawdzeń decyduje, który
// komunikat zobaczy użytkownik, gdy plik ma kilka wad naraz.

export const MAX_FILE_MB = 10;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

// Specyfikacja PDF pozwala, żeby nagłówek %PDF- zaczynał się w pierwszych 1024 bajtach pliku.
const SIGNATURE = "%PDF-";
const SIGNATURE_WINDOW_BYTES = 1024;

export type PdfFileErrorCode = "notOneFile" | "empty" | "tooLarge" | "notPdf";

export type PdfFileCheck = { ok: true; file: File } | { ok: false; code: PdfFileErrorCode };

// PDF poznajemy po treści, a nie po nazwie i typie MIME: nazwę można zmienić, a Windows przy
// przeciąganiu pliku potrafi podać pusty typ.
export async function checkPdfFiles(files: readonly File[]): Promise<PdfFileCheck> {
  const [file] = files;
  if (!file || files.length !== 1) {
    return { ok: false, code: "notOneFile" };
  }
  if (file.size === 0) {
    return { ok: false, code: "empty" };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, code: "tooLarge" };
  }
  const head = await file.slice(0, SIGNATURE_WINDOW_BYTES).arrayBuffer();
  // latin1 zamienia każdy bajt na jeden znak, więc znaki ASCII nagłówka zostają nietknięte.
  if (!new TextDecoder("latin1").decode(head).includes(SIGNATURE)) {
    return { ok: false, code: "notPdf" };
  }
  return { ok: true, file };
}
