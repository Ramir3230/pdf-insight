import { analyzeDocument } from "../server/analyze.js";
import { RATE_LIMIT, RATE_WINDOW_MS, handleAnalyze } from "../server/analyzeHandler.js";
import { createAskModel } from "../server/claude.js";
import { DEFAULT_ALLOWED_ORIGIN } from "../server/cors.js";
import { createRateLimiter } from "../server/rateLimit.js";
import type { AnalyzeRequest } from "../src/lib/schema.js";

// Ustawienia czytamy raz, przy starcie funkcji. Pusta zmienna też oznacza wartość domyślną.
// Klucz API jest tylko w zmiennych środowiskowych Vercel; bez niego handler odpowiada 500.
const apiKey = process.env.ANTHROPIC_API_KEY;
const askModel = apiKey ? createAskModel({ apiKey }) : null;

const config = {
  allowedOrigin: process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN,
  analyze: askModel ? (request: AnalyzeRequest) => analyzeDocument(request, askModel) : null,
  rateLimit: createRateLimiter(RATE_LIMIT, RATE_WINDOW_MS),
};

// Funkcja Vercel w składni Web Handlers: jeden punkt wejścia dla wszystkich metod HTTP.
export default {
  fetch(request: Request): Promise<Response> {
    return handleAnalyze(request, config);
  },
};
