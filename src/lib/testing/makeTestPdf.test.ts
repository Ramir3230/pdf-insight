import { describe, expect, it } from "vitest";
import { makeTestPdf } from "./makeTestPdf.js";

describe("makeTestPdf", () => {
  it("odrzuca znaki spoza drukowalnego ASCII, zamiast zbudować plik z błędną tabelą xref", () => {
    expect(() => makeTestPdf([["Termin płatności"]])).toThrow(/tylko drukowalne ASCII/);
  });
});
