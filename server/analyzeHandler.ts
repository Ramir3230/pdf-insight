import { corsHeaders, isAllowedOrigin } from "./cors.js";

export interface AnalyzeConfig {
  allowedOrigin: string;
}

export type ErrorCode = "forbidden_origin" | "method_not_allowed" | "not_implemented";

function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  headers: Record<string, string>,
): Response {
  return Response.json({ error: { code, message } }, { status, headers });
}

export function handleAnalyze(request: Request, config: AnalyzeConfig): Response {
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

  // Zaślepka bloku 1: analizę przez Claude API dodaje blok 4.
  return errorResponse(501, "not_implemented", "Analiza nie jest jeszcze dostępna.", cors);
}
