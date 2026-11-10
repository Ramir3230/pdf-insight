import { handleAnalyze } from "../server/analyzeHandler.js";
import { DEFAULT_ALLOWED_ORIGIN } from "../server/cors.js";

// Ustawienia czytamy raz, przy starcie funkcji. Pusta zmienna też oznacza wartość domyślną.
const config = {
  allowedOrigin: process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN,
};

// Funkcja Vercel w składni Web Handlers: jeden punkt wejścia dla wszystkich metod HTTP.
export default {
  fetch(request: Request): Response {
    return handleAnalyze(request, config);
  },
};
