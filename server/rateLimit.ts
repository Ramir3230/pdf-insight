// Limit żądań na adres IP: najwyżej `limit` analiz w oknie `windowMs`. Pamięć jest w instancji
// funkcji Vercel — znika przy zimnym starcie, a każda równoległa instancja liczy osobno. To
// ochrona przed pętlą albo prostym nadużyciem, nie twardy limit; twardy limit kosztów to limit
// wydatków ustawiony na kluczu API (opisane w README).

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type RateLimiter = (key: string, now?: number) => RateLimitDecision;

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  // Dla każdego klucza: czasy żądań z ostatniego okna, od najstarszego.
  const hits = new Map<string, number[]>();

  return (key, now = Date.now()) => {
    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    const oldest = recent[0];
    if (oldest !== undefined && recent.length >= limit) {
      hits.set(key, recent);
      return { allowed: false, retryAfterSeconds: Math.ceil((oldest + windowMs - now) / 1000) };
    }
    recent.push(now);
    hits.set(key, recent);
    return { allowed: true };
  };
}

// Adres klienta. Według dokumentacji Vercel (Request headers) platforma nadpisuje
// x-forwarded-for i nie przekazuje adresów podanych z zewnątrz — ochrona przed podszywaniem się.
// Pierwszy adres na liście to klient.
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
