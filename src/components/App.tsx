import { useRef, useState } from "react";
import { messages } from "../lib/messages";
import { readPdf, type ReadErrorCode } from "../lib/readPdf";
import { PdfDrop } from "./PdfDrop";

type ReadState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "ready"; fileName: string; text: string; pages: number }
  | { status: "error"; code: ReadErrorCode };

export function App() {
  const [state, setState] = useState<ReadState>({ status: "idle" });
  // Numer ostatniego wyboru pliku. Gdy ktoś wybierze nowy plik, zanim skończy się czytanie
  // poprzedniego, wynik starego jest odrzucany — na ekranie zawsze jest ostatni plik.
  const latestRead = useRef(0);

  async function handleFiles(files: File[]) {
    const readId = ++latestRead.current;
    setState({ status: "reading" });
    const result = await readPdf(files);
    if (readId !== latestRead.current) {
      return;
    }
    setState(
      result.ok
        ? { status: "ready", fileName: result.fileName, text: result.text, pages: result.pages }
        : { status: "error", code: result.code },
    );
  }

  return (
    <main className="page">
      <h1>{messages.appName}</h1>
      <p className="lead">{messages.tagline}</p>

      <PdfDrop
        onFiles={(files) => void handleFiles(files)}
        buttonLabel={
          state.status === "ready" ? messages.upload.chooseAnother : messages.upload.choose
        }
      />

      {/* Region aria-live istnieje cały czas, żeby czytnik ekranu ogłosił zmianę jego treści. */}
      <div className="status" aria-live="polite">
        {state.status === "reading" && <p>{messages.upload.reading}</p>}
        {state.status === "ready" && (
          <p>{messages.readSummary(state.fileName, state.pages, state.text.length)}</p>
        )}
      </div>
      {state.status === "error" && (
        <p className="error" role="alert">
          {messages.readErrors[state.code]}
        </p>
      )}
    </main>
  );
}
