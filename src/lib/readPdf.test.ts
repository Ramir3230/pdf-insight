import { describe, expect, it, vi } from "vitest";
import { readPdf } from "./readPdf.js";
import { makeTestPdf, type TestPage } from "./testing/makeTestPdf.js";

// Linia z ponad 50 literami — tyle wymaga odczyt na stronę, żeby PDF nie był uznany za skan.
const LONG_LINE = "Umowa serwisowa zawarta pomiedzy firma Alfa a firma Beta w Gdansku";

function pdfFile(pages: readonly TestPage[], name = "umowa.pdf"): File {
  return new File([makeTestPdf(pages)], name, { type: "application/pdf" });
}

describe("readPdf", () => {
  it("zwraca nazwę pliku, tekst i liczbę stron", async () => {
    expect(await readPdf([pdfFile([[LONG_LINE], [LONG_LINE]])])).toEqual({
      ok: true,
      fileName: "umowa.pdf",
      text: `${LONG_LINE}\n\n${LONG_LINE}`,
      pages: 2,
    });
  });

  it("zwraca kod błędu sprawdzenia pliku, zanim uruchomi pdf.js", async () => {
    const notPdf = new File(["zwykły tekst"], "umowa.pdf", { type: "application/pdf" });
    expect(await readPdf([notPdf])).toEqual({ ok: false, code: "notPdf" });
  });

  it("zwraca kod błędu pdf.js dla skanu", async () => {
    expect(await readPdf([pdfFile([null])])).toEqual({ ok: false, code: "noText" });
  });

  it("nie rzuca, gdy pliku nie da się przeczytać — zwraca readFailed", async () => {
    // Tak zachowuje się przeglądarka, gdy plik zniknął z dysku po wybraniu albo gdy
    // upuszczono folder: już pierwsze czytanie (nagłówek w checkPdfFiles) kończy się błędem.
    const file = pdfFile([[LONG_LINE]]);
    vi.spyOn(file, "slice").mockReturnValue({
      arrayBuffer: () => Promise.reject(new Error("NotReadableError")),
    } as unknown as Blob);
    expect(await readPdf([file])).toEqual({ ok: false, code: "readFailed" });
  });
});
