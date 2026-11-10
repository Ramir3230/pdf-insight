import { useRef, useState } from "react";
import { requestAnalysis, type AnalyzeErrorCode } from "../api/analyzeClient";
import { messages } from "../lib/messages";
import { readPdf, type ReadErrorCode } from "../lib/readPdf";
import type { AnalysisResult, AnalyzeRequest } from "../lib/schema";
import { PdfDrop } from "./PdfDrop";
import { ResultView } from "./ResultView";

// Kolejne kroki: plik → odczyt tekstu w przeglądarce → analiza na backendzie → wynik.
type AppState =
  | { step: "idle" }
  | { step: "reading" }
  | { step: "readError"; code: ReadErrorCode }
  | { step: "analyzing"; source: AnalyzeRequest }
  | { step: "analyzeError"; source: AnalyzeRequest; code: AnalyzeErrorCode }
  | { step: "done"; result: AnalysisResult; seconds: number };

// Błędy, po których ponowienie z tym samym tekstem ma sens. Przy pozostałych (za długi tekst,
// odmowa modelu, brak konfiguracji) trzeba wybrać inny plik.
const RETRYABLE = new Set<AnalyzeErrorCode>([
  "network",
  "timeout",
  "rate_limited",
  "invalid_response",
  "unavailable",
  "bad_result",
  "server",
]);

export function App() {
  const [state, setState] = useState<AppState>({ step: "idle" });
  // Numer ostatniego uruchomienia. Wynik starszego (np. gdy w trakcie wybrano nowy plik albo
  // kliknięto „Spróbuj ponownie”) jest odrzucany — na ekranie zawsze jest ostatni.
  const latestRun = useRef(0);

  async function analyze(source: AnalyzeRequest, runId: number, startedAt: number) {
    setState({ step: "analyzing", source });
    const response = await requestAnalysis(source, import.meta.env.VITE_API_URL);
    if (runId !== latestRun.current) {
      return;
    }
    if (response.ok) {
      const seconds = Math.round((performance.now() - startedAt) / 100) / 10;
      setState({ step: "done", result: response.result, seconds });
    } else {
      setState({ step: "analyzeError", source, code: response.code });
    }
  }

  async function handleFiles(files: File[]) {
    const runId = ++latestRun.current;
    const startedAt = performance.now();
    setState({ step: "reading" });
    const read = await readPdf(files);
    if (runId !== latestRun.current) {
      return;
    }
    if (!read.ok) {
      setState({ step: "readError", code: read.code });
      return;
    }
    await analyze(
      { fileName: read.fileName, pages: read.pages, text: read.text },
      runId,
      startedAt,
    );
  }

  function retry(source: AnalyzeRequest) {
    void analyze(source, ++latestRun.current, performance.now());
  }

  return (
    <main className="page">
      <h1>{messages.appName}</h1>
      <p className="lead">{messages.tagline}</p>
      {state.step === "idle" && <p className="intro">{messages.intro}</p>}

      <PdfDrop
        onFiles={(files) => void handleFiles(files)}
        buttonLabel={state.step === "idle" ? messages.upload.choose : messages.upload.chooseAnother}
      />
      <p className="privacy">{messages.privacyNote}</p>

      {/* Region aria-live istnieje cały czas, żeby czytnik ekranu ogłosił zmianę jego treści. */}
      <div className="status" aria-live="polite">
        {state.step === "reading" && <p className="status__busy">{messages.upload.reading}</p>}
        {state.step === "analyzing" && (
          <>
            <p>
              {messages.readSummary(
                state.source.fileName,
                state.source.pages,
                state.source.text.length,
              )}
            </p>
            <p className="status__busy">{messages.analyze.analyzing}</p>
          </>
        )}
      </div>

      {state.step === "readError" && (
        <p className="error" role="alert">
          {messages.readErrors[state.code]}
        </p>
      )}
      {state.step === "analyzeError" && (
        <div className="error" role="alert">
          <p>{messages.analyzeErrors[state.code]}</p>
          {RETRYABLE.has(state.code) && (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => retry(state.source)}
            >
              {messages.analyze.retry}
            </button>
          )}
        </div>
      )}

      {state.step === "done" && <ResultView result={state.result} seconds={state.seconds} />}
    </main>
  );
}
