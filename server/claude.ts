import Anthropic, { APIConnectionTimeoutError, APIError } from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { modelOutputSchema, type ModelOutput } from "../src/lib/schema.js";
import { SYSTEM_PROMPT, documentMessage } from "./prompt.js";

// Jedno wywołanie Claude API. Każdy wynik — także nieoczekiwany wyjątek — to jeden z rodzajów
// ModelReply; decyzję o ponownej próbie podejmuje analyze.ts.

export const MODEL = "claude-opus-5-5";
// Poziom „namysłu” modelu: wyższy to lepsza jakość, ale dłużej i drożej. „low” sprawdzony na
// umowie testowej (wyniki w ROADMAP.md); innych poziomów nie mierzyliśmy.
export const EFFORT = "low";
const MAX_TOKENS = 16_000;
// Limit jednej próby. Po przekroczeniu nie ponawiamy (ten sam tekst znów by się nie zmieścił),
// więc dwie próby (zła odpowiedź + ponowienie) mieszczą się w limicie funkcji Vercel (60 s).
export const TIMEOUT_MS = 25_000;
// Beta: serwerowy fallback przy odmowie modelu (API powtarza żądanie na innym modelu)
// i structured outputs w przestrzeni beta (ten sam nagłówek dodaje SDK w messages.parse).
const BETAS = ["server-side-fallback-2026-07-01", "structured-outputs-2025-12-15"];
// Schemat JSON dla API i parser odpowiedzi — oba z tego samego schematu Zod.
const OUTPUT_FORMAT = betaZodOutputFormat(modelOutputSchema);

export type ModelReply =
  | { kind: "ok"; output: ModelOutput }
  // Odpowiedź niezgodna ze schematem albo ucięta (np. limit tokenów).
  | { kind: "invalid" }
  // Model odmówił (po próbie modelu zapasowego).
  | { kind: "refused" }
  // Próba przekroczyła TIMEOUT_MS.
  | { kind: "timeout" }
  // API niedostępne. retryable: błąd przejściowy (sieć, 429, 5xx). Nieprzejściowy to np. zły
  // klucz (401), złe żądanie (400) albo wyczerpany limit wydatków — ponowienie nic nie da.
  | { kind: "unavailable"; retryable: boolean; status: number | undefined };

export type AskModel = (text: string) => Promise<ModelReply>;

type ClaudeOptions = {
  apiKey: string;
  // Tylko w testach: podstawiony fetch zamiast sieci i krótszy limit czasu.
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
};

// Zamiana odpowiedzi API na ModelReply. Nie używamy messages.parse: przy błędzie parsowania
// rzuca wyjątek i gubi odpowiedź, więc nie da się odróżnić odmowy w trakcie pisania (część
// tekstu + stop_reason "refusal") ani odczytać wyniku modelu zapasowego, który w content stoi
// po tekście modelu, który odmówił.
function toReply(message: Anthropic.Beta.BetaMessage): ModelReply {
  if (message.stop_reason === "refusal") {
    return { kind: "refused" };
  }
  // Ostatni blok tekstu to odpowiedź modelu, który skończył pracę (po ewentualnym fallbacku).
  const answer = message.content.findLast((block) => block.type === "text");
  if (!answer || message.stop_reason !== "end_turn") {
    return { kind: "invalid" };
  }
  try {
    // JSON.parse i sprawdzenie schematem Zod; rzuca przy złym JSON albo niezgodności.
    return { kind: "ok", output: OUTPUT_FORMAT.parse(answer.text) };
  } catch {
    return { kind: "invalid" };
  }
}

function errorToReply(error: unknown): ModelReply {
  if (error instanceof APIConnectionTimeoutError) {
    return { kind: "timeout" };
  }
  if (error instanceof Anthropic.EnforcedSpendLimitReachedError) {
    return { kind: "unavailable", retryable: false, status: error.status };
  }
  if (error instanceof APIError) {
    const status = error.status;
    const retryable = status === undefined || status === 429 || status >= 500;
    return { kind: "unavailable", retryable, status };
  }
  // Coś spoza SDK (np. zerwane połączenie w trakcie czytania odpowiedzi): traktujemy jak błąd
  // przejściowy. Do logów tylko nazwa błędu, bez treści.
  console.error("claude: nieoczekiwany błąd", error instanceof Error ? error.name : typeof error);
  return { kind: "unavailable", retryable: true, status: undefined };
}

export function createAskModel({ apiKey, fetch, timeoutMs = TIMEOUT_MS }: ClaudeOptions): AskModel {
  // maxRetries: 0 — ponowną próbę robi analyze.ts, dokładnie jedną (wymóg briefu); SDK
  // ponawiałby niezależnie od nas i przekroczyłby limit czasu funkcji.
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: timeoutMs, fetch });

  return async (text) => {
    try {
      const message = await client.beta.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        betas: BETAS,
        fallbacks: "default",
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: documentMessage(text) }],
        output_config: { effort: EFFORT, format: OUTPUT_FORMAT },
      });
      return toReply(message);
    } catch (error) {
      return errorToReply(error);
    }
  };
}
