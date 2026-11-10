import { MAX_TEXT_CHARS, analyzeRequestSchema, type AnalyzeRequest } from "../src/lib/schema.js";
import type { AnalyzeErrorCode, AnalyzeOutcome } from "./analyze.js";
import { corsHeaders, isAllowedOrigin } from "./cors.js";
import { clientIp, type RateLimiter } from "./rateLimit.js";

export interface AnalyzeConfig {
  allowedOrigin: string;
  // null, gdy na serwerze brak klucza API — odpowiadamy 500 zamiast próbować wywołać Claude.
  analyze: ((request: AnalyzeRequest) => Promise<AnalyzeOutcome>) | null;
  rateLimit: RateLimiter;
}

export type ErrorCode =
  | "forbidden_origin"
  | "method_not_allowed"
  | "payload_too_large"
  | "invalid_request"
  | "text_too_long"
  | "rate_limited"
  | "not_configured"
  | "internal_error"
  | AnalyzeErrorCode;

// Status HTTP i komunikat dla każdego błędu analizy.
const ANALYZE_ERRORS: Record<AnalyzeErrorCode, [number, string]> = {
  refused: [422, "Model AI odmówił analizy tego dokumentu. Spróbuj z innym plikiem."],
  invalid_response: [
    502,
    "AI zwróciło niepoprawny wynik, także przy ponownej próbie. Spróbuj ponownie.",
  ],
  timeout: [
    504,
    "Analiza trwała zbyt długo — dokument może być za długi. Spróbuj z krótszym dokumentem.",
  ],
  unavailable: [503, "Usługa AI jest chwilowo niedostępna. Spróbuj ponownie za chwilę."],
  misconfigured: [
    500,
    "Usługa AI odrzuciła żądanie serwera (np. klucz albo limit wydatków). Spróbuj później.",
  ],
};

// Największe body żądania: 1 000 000 bajtów według Content-Length i tyle samo znaków po
// odczycie. Tekst do MAX_TEXT_CHARS znaków zajmuje w JSON zwykle niewiele więcej (escapowane
// są cudzysłowy i nowe linie), więc to duży zapas. Większe body odrzucamy bez parsowania JSON.
export const MAX_BODY_SIZE = 1_000_000;

// Ile analiz na jeden adres IP w oknie czasu (patrz rateLimit.ts).
export const RATE_LIMIT = 10;
export const RATE_WINDOW_MS = 10 * 60 * 1000;

function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  headers: Record<string, string>,
): Response {
  return Response.json({ error: { code, message } }, { status, headers });
}

// Odczyt body z limitem: najpierw nagłówek Content-Length (bez czytania), potem faktyczna długość.
async function readBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_BODY_SIZE) {
    return null;
  }
  const body = await request.text();
  return body.length > MAX_BODY_SIZE ? null : body;
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

// Punkt wejścia: każdy nieprzewidziany wyjątek też kończy się odpowiedzią JSON z nagłówkami
// CORS — inaczej Vercel oddałby goły błąd 500, a przeglądarka zgłosiłaby tylko błąd CORS.
export async function handleAnalyze(request: Request, config: AnalyzeConfig): Promise<Response> {
  try {
    return await handle(request, config);
  } catch (error) {
    console.error(
      "analyze: nieoczekiwany błąd",
      error instanceof Error ? error.name : typeof error,
    );
    return errorResponse(
      500,
      "internal_error",
      "Wewnętrzny błąd serwera. Spróbuj ponownie.",
      corsHeaders(config.allowedOrigin),
    );
  }
}

async function handle(request: Request, config: AnalyzeConfig): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (!isAllowedOrigin(origin, config.allowedOrigin)) {
    // Bez nagłówków CORS: przeglądarka na obcej stronie nie odczyta tej odpowiedzi.
    return errorResponse(403, "forbidden_origin", "Żądania z tej domeny są niedozwolone.", {
      Vary: "Origin",
    });
  }

  const cors = corsHeaders(config.allowedOrigin);

  if (request.method === "OPTIONS") {
    // Preflight: przeglądarka pyta, czy może wysłać POST z JSON-em.
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Dozwolona jest tylko metoda POST.", {
      ...cors,
      Allow: "POST, OPTIONS",
    });
  }

  // Wszystko poniżej do wywołania Claude jest darmowe: złe żądanie nie kosztuje nic.
  const body = await readBody(request);
  if (body === null) {
    return errorResponse(413, "payload_too_large", "Żądanie jest za duże.", cors);
  }

  const parsed = analyzeRequestSchema.safeParse(parseJson(body));
  if (!parsed.success) {
    const textTooLong = parsed.error.issues.some(
      (issue) => issue.path[0] === "text" && issue.code === "too_big",
    );
    if (textTooLong) {
      const limit = MAX_TEXT_CHARS.toLocaleString("pl-PL");
      return errorResponse(
        413,
        "text_too_long",
        `Dokument jest za długi: najwyżej ${limit} znaków tekstu.`,
        cors,
      );
    }
    return errorResponse(
      400,
      "invalid_request",
      "Nieprawidłowe żądanie: wymagany tekst dokumentu, nazwa pliku i liczba stron.",
      cors,
    );
  }

  if (config.analyze === null) {
    console.error("analyze: brak ANTHROPIC_API_KEY w zmiennych środowiskowych");
    return errorResponse(500, "not_configured", "Serwer nie jest skonfigurowany.", cors);
  }

  // Limit liczymy tylko dla żądań, które naprawdę idą do Claude (i kosztują).
  const decision = config.rateLimit(clientIp(request));
  if (!decision.allowed) {
    return errorResponse(
      429,
      "rate_limited",
      "Za dużo analiz w krótkim czasie. Spróbuj ponownie za kilka minut.",
      { ...cors, "Retry-After": String(decision.retryAfterSeconds) },
    );
  }

  const outcome = await config.analyze(parsed.data);
  if (outcome.ok) {
    return Response.json(outcome.result, { headers: cors });
  }
  // Do logów Vercel trafia tylko kod błędu i status API, bez treści dokumentu.
  console.error(`analyze: ${outcome.code}`, outcome.status ?? "");
  const [status, message] = ANALYZE_ERRORS[outcome.code];
  return errorResponse(status, outcome.code, message, cors);
}
