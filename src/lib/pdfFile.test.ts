import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, checkPdfFiles } from "./pdfFile.js";
import { makeTestPdf } from "./testing/makeTestPdf.js";

const pdfBytes = makeTestPdf([["Umowa"]]);

function pdfFile(name = "umowa.pdf", type = "application/pdf"): File {
  return new File([pdfBytes], name, { type });
}

// Plik o zadanym rozmiarze, który zaczyna się nagłówkiem PDF.
function pdfOfSize(bytes: number): File {
  const data = new Uint8Array(bytes);
  data.set(new TextEncoder().encode("%PDF-1.4\n"));
  return new File([data], "duzy.pdf", { type: "application/pdf" });
}

describe("checkPdfFiles", () => {
  it("przyjmuje jeden plik PDF", async () => {
    const file = pdfFile();
    expect(await checkPdfFiles([file])).toEqual({ ok: true, file });
  });

  it("poznaje PDF po treści, nie po nazwie i typie MIME", async () => {
    const file = pdfFile("dokument.bin", "");
    expect(await checkPdfFiles([file])).toEqual({ ok: true, file });
  });

  it("odrzuca brak pliku i kilka plików naraz", async () => {
    expect(await checkPdfFiles([])).toEqual({ ok: false, code: "notOneFile" });
    expect(await checkPdfFiles([pdfFile(), pdfFile()])).toEqual({ ok: false, code: "notOneFile" });
  });

  it("odrzuca pusty plik", async () => {
    const empty = new File([], "pusty.pdf", { type: "application/pdf" });
    expect(await checkPdfFiles([empty])).toEqual({ ok: false, code: "empty" });
  });

  it("przyjmuje dokładnie 10 MB i odrzuca bajt więcej", async () => {
    expect(await checkPdfFiles([pdfOfSize(MAX_FILE_BYTES)])).toMatchObject({ ok: true });
    expect(await checkPdfFiles([pdfOfSize(MAX_FILE_BYTES + 1)])).toEqual({
      ok: false,
      code: "tooLarge",
    });
  });

  it("przy kilku wadach naraz zgłasza rozmiar przed brakiem nagłówka", async () => {
    const bigNotPdf = new File([new Uint8Array(MAX_FILE_BYTES + 1)], "duzy.docx");
    expect(await checkPdfFiles([bigNotPdf])).toEqual({ ok: false, code: "tooLarge" });
  });

  it("odrzuca plik bez nagłówka PDF, nawet z nazwą .pdf i typem application/pdf", async () => {
    const fake = new File(["To jest zwykły tekst."], "faktura.pdf", { type: "application/pdf" });
    expect(await checkPdfFiles([fake])).toEqual({ ok: false, code: "notPdf" });
  });

  it("szuka nagłówka tylko w pierwszych 1024 bajtach", async () => {
    const within = new File([" ".repeat(1000), pdfBytes], "a.pdf");
    const beyond = new File([" ".repeat(1024), pdfBytes], "b.pdf");
    expect(await checkPdfFiles([within])).toMatchObject({ ok: true });
    expect(await checkPdfFiles([beyond])).toEqual({ ok: false, code: "notPdf" });
  });
});
