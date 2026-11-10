import { describe, expect, it, vi } from "vitest";
import { MAX_TEXT_CHARS, type AnalysisResult } from "../lib/schema";
import { requestAnalysis } from "./analyzeClient";

const API_URL = "https://example.vercel.app/api/analyze";
const request = { fileName: "umowa.pdf", pages: 4, text: "Umowa serwisowa nr 14." };

const result: AnalysisResult = {
  document: {
    fileName: "umowa.pdf",
    pages: 4,
    language: "pl",
    type: "umowa",
    title: "Umowa serwisowa",
    date: "2026-09-01",
  },
  summary: "Umowa dotyczy serwisu. Strony to Alfa i Beta. Wynagrodzenie wynosi 12 500 PLN.",
  keyPoints: ["Serwis", "12 500 PLN", "12 miesięcy"],
  entities: { organizations: ["Alfa sp. z o.o."], people: [] },
  amounts: [{ value: 12500, currency: "PLN", context: "wynagrodzenie" }],
  dates: [{ date: "2026-10-01", context: "termin płatności" }],
  keywords: ["serwis"],
};

function respond(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(async () => Response.json(body, { status }));
}

describe("requestAnalysis", () => {
  it("wysyła POST z JSON-em i zwraca wynik sprawdzony schematem", async () => {
    const fetch = respond(result);
    expect(await requestAnalysis(request, API_URL, fetch)).toEqual({ ok: true, result });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(API_URL);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(request);
  });

  it("odpowiedź 200 niezgodna ze schematem → bad_result, nic nie trafia na ekran", async () => {
    const fetch = respond({ ...result, summary: 42 });
    expect(await requestAnalysis(request, API_URL, fetch)).toEqual({
      ok: false,
      code: "bad_result",
    });
  });

  it.each([
    "rate_limited",
    "refused",
    "invalid_response",
    "unavailable",
    "misconfigured",
    "timeout",
    "text_too_long",
  ])("błąd backendu %s → ten sam kod", async (code) => {
    const fetch = respond({ error: { code, message: "..." } }, 503);
    expect(await requestAnalysis(request, API_URL, fetch)).toEqual({ ok: false, code });
  });

  it("nieznany kod albo odpowiedź, która nie jest JSON-em → server", async () => {
    const unknownCode = respond({ error: { code: "invalid_request", message: "..." } }, 400);
    expect(await requestAnalysis(request, API_URL, unknownCode)).toEqual({
      ok: false,
      code: "server",
    });
    const html = vi.fn<typeof fetch>(async () => new Response("<html>502</html>", { status: 502 }));
    expect(await requestAnalysis(request, API_URL, html)).toEqual({ ok: false, code: "server" });
  });

  it("brak sieci → network", async () => {
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await requestAnalysis(request, API_URL, offline)).toEqual({
      ok: false,
      code: "network",
    });
  });

  it("przekroczony czas → timeout", async () => {
    const slow = vi.fn<typeof fetch>(async () => {
      throw new DOMException("signal timed out", "TimeoutError");
    });
    expect(await requestAnalysis(request, API_URL, slow)).toEqual({ ok: false, code: "timeout" });
  });

  it(`tekst dłuższy niż ${MAX_TEXT_CHARS} znaków → text_too_long bez wysyłki`, async () => {
    const fetch = respond(result);
    const long = { ...request, text: "a".repeat(MAX_TEXT_CHARS + 1) };
    expect(await requestAnalysis(long, API_URL, fetch)).toEqual({
      ok: false,
      code: "text_too_long",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("brak adresu backendu w buildzie → not_configured bez wysyłki", async () => {
    const fetch = respond(result);
    expect(await requestAnalysis(request, undefined, fetch)).toEqual({
      ok: false,
      code: "not_configured",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
