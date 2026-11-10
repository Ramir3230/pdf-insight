import { toAnalysisResult, type AnalysisResult, type AnalyzeRequest } from "../src/lib/schema.js";
import type { AskModel, ModelReply } from "./claude.js";

// Analiza dokumentu z zasadą briefu: zła odpowiedź AI → jedna ponowna próba, potem błąd.
// Tak samo przy przejściowym błędzie API. Odmowy modelu nie ponawiamy: API już spróbowało
// modelu zapasowego (fallback), a druga próba z tym samym tekstem skończyłaby się tak samo.

export type AnalyzeErrorCode = "refused" | "invalid_response" | "unavailable";

export type AnalyzeOutcome =
  { ok: true; result: AnalysisResult } | { ok: false; code: AnalyzeErrorCode; status?: number };

function shouldRetry(reply: ModelReply): boolean {
  return reply.kind === "invalid" || (reply.kind === "unavailable" && reply.retryable);
}

export async function analyzeDocument(
  request: AnalyzeRequest,
  askModel: AskModel,
): Promise<AnalyzeOutcome> {
  let reply = await askModel(request.text);
  if (shouldRetry(reply)) {
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
    case "unavailable":
      return { ok: false, code: "unavailable", status: reply.status };
  }
}
