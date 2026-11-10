import { toAnalysisResult, type AnalysisResult, type AnalyzeRequest } from "../src/lib/schema.js";
import type { AskModel, ModelReply } from "./claude.js";

// Analiza dokumentu z zasadą briefu: zła odpowiedź AI → jedna ponowna próba, potem błąd.
// Tak samo przy przejściowym błędzie API (sieć, 429, 5xx) — po krótkiej przerwie. Bez ponowienia:
// odmowa modelu (API już spróbowało modelu zapasowego), przekroczony czas (ten sam tekst znów by
// się nie zmieścił) i błędy nieprzejściowe (np. zły klucz, wyczerpany limit wydatków).

export type AnalyzeErrorCode =
  "refused" | "invalid_response" | "timeout" | "unavailable" | "misconfigured";

export type AnalyzeOutcome =
  { ok: true; result: AnalysisResult } | { ok: false; code: AnalyzeErrorCode; status?: number };

// Przerwa przed ponowieniem po błędzie przejściowym API: przeciążony serwer (529) albo limit
// (429) potrzebują chwili.
export const RETRY_DELAY_MS = 1000;

function shouldRetry(reply: ModelReply): boolean {
  return reply.kind === "invalid" || (reply.kind === "unavailable" && reply.retryable);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function analyzeDocument(
  request: AnalyzeRequest,
  askModel: AskModel,
  retryDelayMs = RETRY_DELAY_MS,
): Promise<AnalyzeOutcome> {
  let reply = await askModel(request.text);
  if (shouldRetry(reply)) {
    if (reply.kind === "unavailable") {
      await sleep(retryDelayMs);
    }
    reply = await askModel(request.text);
  }

  switch (reply.kind) {
    case "ok":
      return {
        ok: true,
        result: toAnalysisResult(reply.output, {
          fileName: request.fileName,
          pages: request.pages,
        }),
      };
    case "refused":
      return { ok: false, code: "refused" };
    case "invalid":
      return { ok: false, code: "invalid_response" };
    case "timeout":
      return { ok: false, code: "timeout" };
    case "unavailable":
      return {
        ok: false,
        code: reply.retryable ? "unavailable" : "misconfigured",
        status: reply.status,
      };
  }
}
