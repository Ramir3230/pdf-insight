import { z } from "zod";
import {
  MAX_TEXT_CHARS,
  analysisResultSchema,
  type AnalysisResult,
  type AnalyzeRequest,
} from "../lib/schema";

// Klient HTTP backendu. Nie rzuca wyjątków: każdy problem to kod błędu, który interfejs zamienia
// na komunikat. Odpowiedź backendu sprawdza ten sam schemat Zod co backend — dopiero poprawny
// wynik trafia na ekran i do pobranego pliku JSON.

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
  | "bad_result"
  | "server";

export type AnalyzeResponse =
  { ok: true; result: AnalysisResult } | { ok: false; code: AnalyzeErrorCode };

// Dłużej nie ma sensu czekać: funkcja Vercel ma limit 60 s.
const TIMEOUT_MS = 65_000;

// Kody błędów backendu, które interfejs opisuje osobnym komunikatem. Inne (np. 400 przy
// niezgodnych wersjach frontu i backendu) to ogólny błąd serwera.
const KNOWN_BACKEND_CODES = [
  "rate_limited",
  "refused",
  "invalid_response",
  "unavailable",
  "misconfigured",
  "timeout",
  "text_too_long",
] as const;

const backendErrorSchema = z.object({
  error: z.object({ code: z.enum(KNOWN_BACKEND_CODES) }),
});

export async function requestAnalysis(
  request: AnalyzeRequest,
  apiUrl: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<AnalyzeResponse> {
  if (!apiUrl) {
    return { ok: false, code: "not_configured" };
  }
  // Ten sam limit sprawdza backend; tu oszczędzamy wysyłki, która i tak zostałaby odrzucona.
  if (request.text.trim().length > MAX_TEXT_CHARS) {
    return { ok: false, code: "text_too_long" };
  }

  let response: Response;
  try {
    response = await fetchImpl(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
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
  return { ok: false, code: backendError.success ? backendError.data.error.code : "server" };
}
