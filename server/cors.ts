// Origin demo na GitHub Pages. Origin to schemat i domena, bez ścieżki /pdf-insight/.
export const DEFAULT_ALLOWED_ORIGIN = "https://ramir3230.github.io";

// Przepuszczamy tylko dokładnie jedną domenę. Brak nagłówka Origin też oznacza odmowę:
// przeglądarka zawsze wysyła go przy żądaniu z innej domeny.
export function isAllowedOrigin(origin: string | null, allowedOrigin: string): boolean {
  return origin === allowedOrigin;
}

// Nagłówki CORS dla odpowiedzi do dozwolonej domeny. "Vary: Origin" mówi pamięciom podręcznym,
// że odpowiedź zależy od nagłówka Origin.
export function corsHeaders(allowedOrigin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}
