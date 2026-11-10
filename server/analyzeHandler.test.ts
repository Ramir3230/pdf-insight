import { describe, expect, it, vi } from "vitest";
import { MAX_TEXT_CHARS, type AnalysisResult } from "../src/lib/schema.js";
import type { AnalyzeOutcome } from "./analyze.js";
import { MAX_BODY_SIZE, handleAnalyze, type AnalyzeConfig } from "./analyzeHandler.js";
import { createRateLimiter } from "./rateLimit.js";

const allowedOrigin = "https://ramir3230.github.io";
const url = "https://example.vercel.app/api/analyze";
const validBody = { fileName: "umowa.pdf", pages: 4, text: "Umowa serwisowa nr 14." };

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
  keyPoints: ["Serwis urządzeń", "Wynagrodzenie 12 500 PLN", "Okres 12 miesięcy"],
  entities: { organizations: ["Alfa sp. z o.o."], people: [] },
  amounts: [{ value: 12500, currency: "PLN", context: "wynagrodzenie" }],
  dates: [{ date: "2026-10-01", context: "termin płatności" }],
  keywords: ["serwis"],
};

// Konfiguracja z podstawioną analizą: testy nie wywołują Claude ani sieci.
function setup(outcome: AnalyzeOutcome = { ok: true, result }, rateLimit = 10) {
  const analyze = vi.fn(async () => outcome);
  const config: AnalyzeConfig = {
    allowedOrigin,
    analyze,
    rateLimit: createRateLimiter(rateLimit, 60_000),
  };
  return { analyze, config };
}

type RequestOptions = { origin?: string | null; body?: string; ip?: string };

function request(method: string, { origin = allowedOrigin, body, ip }: RequestOptions = {}) {
  const headers = new Headers();
  if (origin) {
    headers.set("Origin", origin);
  }
  if (ip) {
    headers.set("x-forwarded-for", ip);
  }
  return new Request(url, { method, headers, body });
}

function post(body: unknown, options: RequestOptions = {}) {
  return request("POST", {
    ...options,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function errorCode(response: Response): Promise<string> {
  const json = (await response.json()) as { error: { code: string } };
  return json.error.code;
}

describe("handleAnalyze: CORS", () => {
  it("odpowiada na preflight z domeny demo i zwraca nagłówki CORS", async () => {
    const response = await handleAnalyze(request("OPTIONS"), setup().config);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("odrzuca preflight z obcej domeny bez nagłówków CORS", async () => {
    const response = await handleAnalyze(
      request("OPTIONS", { origin: "https://evil.example" }),
      setup().config,
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("odrzuca domenę, która tylko zaczyna się od adresu demo", async () => {
    const { analyze, config } = setup();
    const response = await handleAnalyze(
      post(validBody, { origin: `${allowedOrigin}.evil.example` }),
      config,
    );
    expect(response.status).toBe(403);
    expect(analyze).not.toHaveBeenCalled();
  });

  it("odrzuca żądanie bez nagłówka Origin", async () => {
    const response = await handleAnalyze(post(validBody, { origin: null }), setup().config);
    expect(response.status).toBe(403);
  });

  it("zwraca błąd w formacie { error: { code, message } }", async () => {
    const response = await handleAnalyze(
      post(validBody, { origin: "https://evil.example" }),
      setup().config,
    );
    expect(await response.json()).toEqual({
      error: { code: "forbidden_origin", message: expect.any(String) },
    });
  });
});

describe("handleAnalyze: metody", () => {
  it("odrzuca GET z kodem 405 i nagłówkiem Allow", async () => {
    const response = await handleAnalyze(request("GET"), setup().config);
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST, OPTIONS");
  });
});

describe("handleAnalyze: złe żądania nie docierają do Claude", () => {
  it("puste body {} → 400 invalid_request", async () => {
    const { analyze, config } = setup();
    const response = await handleAnalyze(post({}), config);
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid_request");
    expect(analyze).not.toHaveBeenCalled();
  });

  it("niepoprawny JSON → 400 invalid_request", async () => {
    const { analyze, config } = setup();
    const response = await handleAnalyze(post("{ to nie JSON"), config);
    expect(response.status).toBe(400);
    expect(analyze).not.toHaveBeenCalled();
  });

  it("brak liczby stron → 400 invalid_request", async () => {
    const { analyze, config } = setup();
    const response = await handleAnalyze(post({ ...validBody, pages: undefined }), config);
    expect(response.status).toBe(400);
    expect(analyze).not.toHaveBeenCalled();
  });

  it(`body większe niż ${MAX_BODY_SIZE} znaków → 413 payload_too_large`, async () => {
    const { analyze, config } = setup();
    const response = await handleAnalyze(post("x".repeat(MAX_BODY_SIZE + 1)), config);
    expect(response.status).toBe(413);
    expect(await errorCode(response)).toBe("payload_too_large");
    expect(analyze).not.toHaveBeenCalled();
  });

  it(`tekst dłuższy niż ${MAX_TEXT_CHARS} znaków → 413 text_too_long`, async () => {
    const { analyze, config } = setup();
    const response = await handleAnalyze(
      post({ ...validBody, text: "a".repeat(MAX_TEXT_CHARS + 1) }),
      config,
    );
    expect(response.status).toBe(413);
    expect(await errorCode(response)).toBe("text_too_long");
    expect(analyze).not.toHaveBeenCalled();
  });

  it("brak klucza API na serwerze → 500 not_configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const config: AnalyzeConfig = { ...setup().config, analyze: null };
    const response = await handleAnalyze(post(validBody), config);
    expect(response.status).toBe(500);
    expect(await errorCode(response)).toBe("not_configured");
  });
});

describe("handleAnalyze: analiza", () => {
  it("zwraca wynik z nagłówkami CORS i przekazuje sprawdzone dane do analizy", async () => {
    const { analyze, config } = setup();
    const response = await handleAnalyze(post(validBody), config);
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin);
    expect(await response.json()).toEqual(result);
    expect(analyze).toHaveBeenCalledWith(validBody);
  });

  it.each([
    ["refused", 422],
    ["invalid_response", 502],
    ["unavailable", 503],
  ] as const)("błąd analizy %s → %i z tym samym kodem", async (code, status) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { config } = setup({ ok: false, code });
    const response = await handleAnalyze(post(validBody), config);
    expect(response.status).toBe(status);
    expect(await errorCode(response)).toBe(code);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin);
  });
});

describe("handleAnalyze: limit żądań", () => {
  it("po wyczerpaniu limitu odpowiada 429 z Retry-After i nie wywołuje Claude", async () => {
    const { analyze, config } = setup({ ok: true, result }, 2);
    expect((await handleAnalyze(post(validBody, { ip: "1.1.1.1" }), config)).status).toBe(200);
    expect((await handleAnalyze(post(validBody, { ip: "1.1.1.1" }), config)).status).toBe(200);
    const limited = await handleAnalyze(post(validBody, { ip: "1.1.1.1" }), config);
    expect(limited.status).toBe(429);
    expect(await errorCode(limited)).toBe("rate_limited");
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  it("liczy osobno dla każdego adresu IP", async () => {
    const { config } = setup({ ok: true, result }, 1);
    expect((await handleAnalyze(post(validBody, { ip: "1.1.1.1" }), config)).status).toBe(200);
    expect((await handleAnalyze(post(validBody, { ip: "2.2.2.2" }), config)).status).toBe(200);
    expect((await handleAnalyze(post(validBody, { ip: "1.1.1.1" }), config)).status).toBe(429);
  });

  it("nie liczy do limitu złych żądań, które nie idą do Claude", async () => {
    const { config } = setup({ ok: true, result }, 1);
    expect((await handleAnalyze(post({}, { ip: "1.1.1.1" }), config)).status).toBe(400);
    expect((await handleAnalyze(post({}, { ip: "1.1.1.1" }), config)).status).toBe(400);
    expect((await handleAnalyze(post(validBody, { ip: "1.1.1.1" }), config)).status).toBe(200);
  });
});
