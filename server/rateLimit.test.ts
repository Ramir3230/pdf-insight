import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter } from "./rateLimit.js";

describe("createRateLimiter", () => {
  it("przepuszcza `limit` żądań w oknie, kolejne blokuje z czasem do odblokowania", () => {
    const limiter = createRateLimiter(2, 60_000);
    expect(limiter("ip", 0)).toEqual({ allowed: true });
    expect(limiter("ip", 10_000)).toEqual({ allowed: true });
    // Najstarsze żądanie (t=0) wypadnie z okna w t=60 000, czyli za 40 s.
    expect(limiter("ip", 20_000)).toEqual({ allowed: false, retryAfterSeconds: 40 });
  });

  it("okno się przesuwa: po upływie czasu najstarsze żądanie przestaje się liczyć", () => {
    const limiter = createRateLimiter(1, 60_000);
    expect(limiter("ip", 0).allowed).toBe(true);
    expect(limiter("ip", 59_999).allowed).toBe(false);
    expect(limiter("ip", 60_000).allowed).toBe(true);
  });

  it("odrzucone żądanie nie przedłuża blokady", () => {
    const limiter = createRateLimiter(1, 60_000);
    limiter("ip", 0);
    limiter("ip", 30_000);
    expect(limiter("ip", 60_000).allowed).toBe(true);
  });

  it("każdy klucz ma osobny limit", () => {
    const limiter = createRateLimiter(1, 60_000);
    expect(limiter("a", 0).allowed).toBe(true);
    expect(limiter("b", 0).allowed).toBe(true);
    expect(limiter("a", 1).allowed).toBe(false);
  });
});

describe("clientIp", () => {
  function withHeaders(headers: Record<string, string>): Request {
    return new Request("https://example.vercel.app/api/analyze", { headers });
  }

  it("bierze pierwszy adres z x-forwarded-for", () => {
    expect(clientIp(withHeaders({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7",
    );
  });

  it("bez nagłówka zwraca wspólny klucz unknown", () => {
    expect(clientIp(withHeaders({}))).toBe("unknown");
  });
});
