import { describe, expect, it } from "vitest";
import { countLabel, messages } from "./messages.js";

const PAGES = { one: "strona", few: "strony", many: "stron" };

describe("countLabel", () => {
  it("dobiera polską formę liczby mnogiej", () => {
    expect(countLabel(1, PAGES)).toBe("1 strona");
    expect(countLabel(2, PAGES)).toBe("2 strony");
    expect(countLabel(4, PAGES)).toBe("4 strony");
    expect(countLabel(5, PAGES)).toBe("5 stron");
    expect(countLabel(12, PAGES)).toBe("12 stron");
    expect(countLabel(22, PAGES)).toBe("22 strony");
    expect(countLabel(25, PAGES)).toBe("25 stron");
  });

  it("grupuje cyfry dużych liczb po polsku", () => {
    // Separatorem tysięcy w pl-PL jest twarda spacja (U+00A0).
    expect(countLabel(12345, PAGES)).toBe("12\u00a0345 stron");
  });
});

describe("messages.readSummary", () => {
  it("łączy nazwę pliku, liczbę stron i znaków", () => {
    expect(messages.readSummary("umowa.pdf", 3, 1201)).toBe(
      "Odczytano plik „umowa.pdf”: 3 strony, 1201 znaków tekstu.",
    );
  });
});
