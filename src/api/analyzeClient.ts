import { z } from "zod";
import {
  MAX_FILE_NAME_CHARS,
  analysisResultSchema,
  analyzeRequestSchema,
  type AnalysisResult,
  type AnalyzeRequest,
} from "../lib/schema";

// Klient HTTP backendu. Nie rzuca wyjątków: każdy problem to kod błędu, który interfejs zamienia
// na komunikat. Odpowiedź sprawdzamy schematem wyniku końcowego z src/lib/schema.ts
// (analysisResultSchema — zbudowany na modelOutputSchema, którym backend sprawdza odpowiedź
// modelu). Dopiero poprawny wynik trafia na ekran i do pobranego pliku JSON.

export type AnalyzeErrorCode =
  // przed wysłaniem
  | "not_configured"
  | "text_too_long"
  // sieć
  | "network"
  | "timeout"
  // odpowiedź backendu
  | "rate_limited"
  | "refused"
  | "invalid_response"
  | "unavailable"
  | "misconfigured"
  | "rejected"
  | "bad_result"
  | "server";

export type AnalyzeResponse =
  { ok: true; result: AnalysisResult } | { ok: false; code: AnalyzeErrorCode };

// Dłużej nie ma sensu czekać: funkcja Vercel ma limit 60 s.
const TIMEOUT_MS = 65_000;

// Kod błędu z backendu (server/analyzeHandler.ts) → kod dla interfejsu. Kilka kodów backendu
// dostaje ten sam komunikat; nieznany kod (np. internal_error) to ogólny błąd serwera.
const BACKEND_CODES = new Map<string, AnalyzeErrorCode>([
  ["rate_limited", "rate_limited"],
  ["refused", "refused"],
  ["invalid_response", "invalid_response"],
  ["unavailable", "unavailable"],
  ["timeout", "timeout"],
  ["misconfigured", "misconfigured"],
  ["not_configured", "misconfigured"],
  ["text_too_long", "text_too_long"],
  ["payload_too_large", "text_too_long"],
  ["invalid_request", "rejected"],
]);

const backendErrorSchema = z.object({ error: z.object({ code: z.string() }) });

export async function requestAnalysis(
  request: AnalyzeRequest,
  apiUrl: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<AnalyzeResponse> {
  if (!apiUrl) {
    return { ok: false, code: "not_configured" };
  }
  // Backend przyjmuje nazwę pliku do 255 znaków; dłuższą (rzadkość) skracamy, zamiast odrzucać.
  const prepared = { ...request, fileName: request.fileName.slice(0, MAX_FILE_NAME_CHARS) };
  // Ten sam schemat sprawdza backend: nie wysyłamy żądania, które i tak zostałoby odrzucone.
  const check = analyzeRequestSchema.safeParse(prepared);
  if (!check.success) {
    const textTooLong = check.error.issues.some(
      (issue) => issue.path[0] === "text" && issue.code === "too_big",
    );
    return { ok: false, code: textTooLong ? "text_too_long" : "rejected" };
  }

  let response: Response;
  try {
    response = await fetchImpl(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prepared),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return { ok: false, code: timedOut ? "timeout" : "network" };
  }

  // Treść, która nie jest JSON-em (np. strona błędu pośrednika), to po prostu null.
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) {
    const parsed = analysisResultSchema.safeParse(body);
    return parsed.success ? { ok: true, result: parsed.data } : { ok: false, code: "bad_result" };
  }
  const backendError = backendErrorSchema.safeParse(body);
  const code = backendError.success ? BACKEND_CODES.get(backendError.data.error.code) : undefined;
  return { ok: false, code: code ?? "server" };
}
