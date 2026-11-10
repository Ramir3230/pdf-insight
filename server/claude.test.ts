import { describe, expect, it } from "vitest";
import type { ModelOutput } from "../src/lib/schema.js";
import { EFFORT, MODEL, createAskModel } from "./claude.js";
import { SYSTEM_PROMPT } from "./prompt.js";

// Prawdziwe SDK Anthropic z podstawionym fetch: bez sieci i bez kosztów sprawdzamy, co SDK
// wysyła do API, i jak nasz kod rozumie odpowiedzi. Klucz to zwykły tekst testowy.

const output: ModelOutput = {
  document: { language: "pl", type: "umowa", title: "Umowa serwisowa", date: "2026-09-01" },
  summary: ["Umowa dotyczy serwisu.", "Strony to Alfa i Beta.", "Wynagrodzenie to 12 500 PLN."],
  keyPoints: ["Serwis", "12 500 PLN", "12 miesięcy"],
  entities: { organizations: ["Alfa sp. z o.o."], people: [] },
  amounts: [{ value: 12500, currency: "PLN", context: "wynagrodzenie" }],
  dates: [{ date: "2026-10-01", context: "termin płatności" }],
  keywords: ["serwis"],
};

// Odpowiedź Messages API z jednym blokiem tekstu (albo bez treści).
function apiMessage(text: string | null, stopReason = "end_turn") {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: MODEL,
    content: text === null ? [] : [{ type: "text", text }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 100 },
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type Captured = { url: string; headers: Headers; body: Record<string, unknown> };

// fetch, który zapisuje żądanie i zwraca podaną odpowiedź (albo rzuca, jak zerwana sieć).
function fakeFetch(answer: Response | Error) {
  const calls: Captured[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    if (answer instanceof Error) {
      throw answer;
    }
    return answer;
  };
  return { fetch, calls };
}

async function ask(answer: Response | Error, text = "Umowa nr 14") {
  const fake = fakeFetch(answer);
  const reply = await createAskModel({ apiKey: "test-key", fetch: fake.fetch })(text);
  return { reply, calls: fake.calls };
}

// Wszystkie węzły schematu JSON (obiekty), żeby sprawdzić reguły w całym drzewie.
function nodes(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap(nodes);
  }
  if (value !== null && typeof value === "object") {
    const node = value as Record<string, unknown>;
    return [node, ...Object.values(node).flatMap(nodes)];
  }
  return [];
}

describe("createAskModel: żądanie do API", () => {
  it("wysyła model, effort, fallback przy odmowie, prompt systemowy i dokument w bloku danych", async () => {
    const { calls } = await ask(json(apiMessage(JSON.stringify(output))), "Treść umowy");
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toContain("/v1/messages");
    // SDK 1.x wysyła klucz w nagłówku Authorization.
    expect(call?.headers.get("authorization")).toContain("test-key");
    expect(call?.headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(call?.body).toMatchObject({
      model: MODEL,
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      output_config: { effort: EFFORT, format: { type: "json_schema" } },
      messages: [{ role: "user", content: expect.stringContaining("<dokument>\nTreść umowy\n") }],
    });
  });

  it("schemat dla API: każdy obiekt zamknięty, bez ograniczeń, których API nie egzekwuje", async () => {
    const { calls } = await ask(json(apiMessage(JSON.stringify(output))));
    const format = (calls[0]?.body.output_config as { format: { schema: unknown } }).format;
    const all = nodes(format.schema);

    for (const node of all.filter((candidate) => candidate.type === "object")) {
      expect(node.additionalProperties).toBe(false);
      expect(node.required).toEqual(Object.keys(node.properties as object));
    }
    // Długości, liczby elementów i wzorce SDK przenosi do opisu, a sprawdza je samo (Zod)
    // po otrzymaniu odpowiedzi.
    for (const key of ["minItems", "maxItems", "minLength", "pattern"]) {
      expect(all.filter((node) => key in node)).toEqual([]);
    }
    expect(all.some((node) => node.format === "date")).toBe(true);
  });
});

describe("createAskModel: odpowiedzi", () => {
  it("poprawny JSON zgodny ze schematem → ok", async () => {
    const { reply } = await ask(json(apiMessage(JSON.stringify(output))));
    expect(reply).toEqual({ kind: "ok", output });
  });

  it("JSON niezgodny ze schematem (2 zdania podsumowania) → invalid", async () => {
    const tooShort = { ...output, summary: ["Jedno.", "Dwa."] };
    const { reply } = await ask(json(apiMessage(JSON.stringify(tooShort))));
    expect(reply).toEqual({ kind: "invalid" });
  });

  it("ucięty JSON (limit tokenów) → invalid", async () => {
    const cut = JSON.stringify(output).slice(0, 50);
    const { reply } = await ask(json(apiMessage(cut, "max_tokens")));
    expect(reply).toEqual({ kind: "invalid" });
  });

  it("odmowa modelu → refused", async () => {
    const { reply } = await ask(json(apiMessage(null, "refusal")));
    expect(reply).toEqual({ kind: "refused" });
  });

  it.each([
    [529, true],
    [500, true],
    [429, true],
    [400, false],
    [401, false],
  ])("błąd API %i → unavailable, ponowienie: %s", async (status, retryable) => {
    const error = { type: "error", error: { type: "api_error", message: "test" } };
    const { reply, calls } = await ask(json(error, status));
    expect(reply).toEqual({ kind: "unavailable", retryable, status });
    // maxRetries: 0 — SDK nie ponawia samo, ponowną próbę robi analyze.ts.
    expect(calls).toHaveLength(1);
  });

  it("zerwane połączenie → unavailable z ponowieniem, bez statusu", async () => {
    const { reply } = await ask(new TypeError("fetch failed"));
    expect(reply).toEqual({ kind: "unavailable", retryable: true, status: undefined });
  });
});
