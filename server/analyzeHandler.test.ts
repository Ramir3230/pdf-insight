import { describe, expect, it } from "vitest";
import { handleAnalyze } from "./analyzeHandler.js";

const allowedOrigin = "https://ramir3230.github.io";
const config = { allowedOrigin };
const url = "https://example.vercel.app/api/analyze";

function request(method: string, origin?: string): Request {
  const headers = new Headers();
  if (origin) {
    headers.set("Origin", origin);
  }
  return new Request(url, { method, headers });
}

describe("handleAnalyze: CORS", () => {
  it("odpowiada na preflight z domeny demo i zwraca nagłówki CORS", () => {
    const response = handleAnalyze(request("OPTIONS", allowedOrigin), config);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(allowedOrigin);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("odrzuca preflight z obcej domeny bez nagłówków CORS", () => {
    const response = handleAnalyze(request("OPTIONS", "https://evil.example"), config);
    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("odrzuca domenę, która tylko zaczyna się od adresu demo", () => {
    const response = handleAnalyze(request("POST", `${allowedOrigin}.evil.example`), config);
    expect(response.status).toBe(403);
  });

  it("odrzuca żądanie bez nagłówka Origin", () => {
    const response = handleAnalyze(request("POST"), config);
    expect(response.status).toBe(403);
  });

  it("zwraca błąd w formacie { error: { code, message } }", async () => {
    const response = handleAnalyze(request("POST", "https://evil.example"), config);
    expect(await response.json()).toEqual({
      error: { code: "forbidden_origin", message: expect.any(String) },
    });
  });
});

describe("handleAnalyze: metody", () => {
  it("odrzuca GET z kodem 405 i nagłówkiem Allow", () => {
    const response = handleAnalyze(request("GET", allowedOrigin), config);
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST, OPTIONS");
  });
});
