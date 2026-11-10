import { describe, expect, it, vi } from "vitest";
import type { ModelOutput } from "../src/lib/schema.js";
import { analyzeDocument } from "./analyze.js";
import type { ModelReply } from "./claude.js";

const output: ModelOutput = {
  document: { language: "pl", type: "umowa", title: "Umowa serwisowa", date: "2026-09-01" },
  summary: ["Umowa dotyczy serwisu.", "Strony to Alfa i Beta.", "Wynagrodzenie to 12 500 PLN."],
  keyPoints: ["Serwis", "12 500 PLN", "12 miesięcy"],
  entities: { organizations: ["Alfa sp. z o.o."], people: [] },
  amounts: [{ value: 12500, currency: "PLN", context: "wynagrodzenie" }],
  dates: [{ date: "2026-10-01", context: "termin płatności" }],
  keywords: ["serwis"],
};

const request = { fileName: "umowa.pdf", pages: 4, text: "Umowa serwisowa nr 14." };

const ok: ModelReply = { kind: "ok", output };
const invalid: ModelReply = { kind: "invalid" };
const refused: ModelReply = { kind: "refused" };
const overloaded: ModelReply = { kind: "unavailable", retryable: true, status: 529 };
const badKey: ModelReply = { kind: "unavailable", retryable: false, status: 401 };

// Podstawiony model: kolejne wywołania zwracają kolejne odpowiedzi z listy.
function model(...replies: ModelReply[]) {
  const ask = vi.fn<(text: string) => Promise<ModelReply>>();
  for (const reply of replies) {
    ask.mockResolvedValueOnce(reply);
  }
  return ask;
}

describe("analyzeDocument", () => {
  it("składa wynik: dane pliku z żądania, podsumowanie w jeden tekst", async () => {
    const ask = model(ok);
    const outcome = await analyzeDocument(request, ask);
    expect(outcome).toMatchObject({
      ok: true,
      result: {
        document: { fileName: "umowa.pdf", pages: 4, type: "umowa" },
        summary: "Umowa dotyczy serwisu. Strony to Alfa i Beta. Wynagrodzenie to 12 500 PLN.",
      },
    });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask).toHaveBeenCalledWith(request.text);
  });

  it("zła odpowiedź AI → jedna ponowna próba, która się udaje", async () => {
    const ask = model(invalid, ok);
    expect((await analyzeDocument(request, ask)).ok).toBe(true);
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("dwie złe odpowiedzi → błąd invalid_response po dokładnie dwóch próbach", async () => {
    const ask = model(invalid, invalid, ok);
    expect(await analyzeDocument(request, ask)).toEqual({ ok: false, code: "invalid_response" });
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("przejściowy błąd API (np. 529) → jedna ponowna próba", async () => {
    const ask = model(overloaded, ok);
    expect((await analyzeDocument(request, ask)).ok).toBe(true);
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("trwały błąd API (np. 401) → bez ponownej próby", async () => {
    const ask = model(badKey, ok);
    expect(await analyzeDocument(request, ask)).toEqual({
      ok: false,
      code: "unavailable",
      status: 401,
    });
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("odmowa modelu → bez ponownej próby", async () => {
    const ask = model(refused, ok);
    expect(await analyzeDocument(request, ask)).toEqual({ ok: false, code: "refused" });
    expect(ask).toHaveBeenCalledTimes(1);
  });
});
