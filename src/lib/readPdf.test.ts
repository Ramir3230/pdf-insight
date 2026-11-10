import { describe, expect, it } from "vitest";
import { readPdf } from "./readPdf.js";
import { makeTestPdf, type TestPage } from "./testing/makeTestPdf.js";

function pdfFile(pages: readonly TestPage[], name = "umowa.pdf"): File {
  return new File([makeTestPdf(pages)], name, { type: "application/pdf" });
}

describe("readPdf", () => {
  it("zwraca nazwę pliku, tekst i liczbę stron", async () => {
    expect(await readPdf([pdfFile([["Umowa nr 14"], ["Aneks"]])])).toEqual({
      ok: true,
      fileName: "umowa.pdf",
      text: "Umowa nr 14\n\nAneks",
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
});
