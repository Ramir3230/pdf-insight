import Anthropic, { APIError, AnthropicError } from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { modelOutputSchema, type ModelOutput } from "../src/lib/schema.js";
import { SYSTEM_PROMPT, documentMessage } from "./prompt.js";

// Jedno wywołanie Claude API. Wynik zawsze jako jeden z czterech rodzajów odpowiedzi — decyzję
// o ponownej próbie podejmuje analyze.ts.

export const MODEL = "claude-opus-5-5";
// Poziom „namysłu” modelu: wyższy to lepsza jakość, ale dłużej i drożej. Dobrany na umowie
// testowej (wynik w ROADMAP.md i AI_LOG.md).
export const EFFORT = "low";
const MAX_TOKENS = 16_000;
// Limit jednej próby. Dwie próby muszą zmieścić się w limicie funkcji Vercel (60 s).
export const TIMEOUT_MS = 25_000;
// Serwerowy fallback przy odmowie modelu: API powtarza to samo żądanie na innym modelu.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export type ModelReply =
  | { kind: "ok"; output: ModelOutput }
  // Odpowiedź niezgodna ze schematem albo ucięta (limit tokenów).
  | { kind: "invalid" }
  // Model odmówił (także po fallbacku).
  | { kind: "refused" }
  // API niedostępne. retryable: błąd przejściowy (sieć, limit czasu, 429, 5xx), a nie np. zły
  // klucz (401) czy złe żądanie (400).
  | { kind: "unavailable"; retryable: boolean; status: number | undefined };

export type AskModel = (text: string) => Promise<ModelReply>;

type ClaudeOptions = {
  apiKey: string;
  // Tylko w testach: podstawiony fetch zamiast sieci.
  fetch?: typeof globalThis.fetch;
};

export function createAskModel({ apiKey, fetch }: ClaudeOptions): AskModel {
  // maxRetries: 0 — ponowną próbę robi analyze.ts, dokładnie jedną (wymóg briefu); SDK
  // ponawiałby niezależnie od nas i przekroczyłby limit czasu funkcji.
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: TIMEOUT_MS, fetch });

  return async (text) => {
    try {
      const message = await client.beta.messages.parse({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: documentMessage(text) }],
        output_config: { effort: EFFORT, format: betaZodOutputFormat(modelOutputSchema) },
      });
      if (message.stop_reason === "refusal") {
        return { kind: "refused" };
      }
      // null, gdy odpowiedź nie ma tekstu (np. ucięta przed pierwszym znakiem).
      return message.parsed_output === null
        ? { kind: "invalid" }
        : { kind: "ok", output: message.parsed_output };
    } catch (error) {
      if (error instanceof APIError) {
        const status = error.status;
        const retryable = status === undefined || status === 429 || status >= 500;
        return { kind: "unavailable", retryable, status };
      }
      // Pozostałe błędy SDK to nieudane parsowanie odpowiedzi: zły JSON albo niezgodność ze
      // schematem Zod (np. 2 zdania podsumowania zamiast 3–5).
      if (error instanceof AnthropicError) {
        return { kind: "invalid" };
      }
      throw error;
    }
  };
}
