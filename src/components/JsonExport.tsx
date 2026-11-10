import { jsonFileName } from "../lib/format";
import { messages } from "../lib/messages";
import type { AnalysisResult } from "../lib/schema";

// Pobranie i podgląd wyniku jako JSON. Plik to dokładnie wynik sprawdzony schematem Zod
// (klucze w kolejności z briefu), sformatowany wcięciami.
export function JsonExport({ result }: { result: AnalysisResult }) {
  const json = JSON.stringify(result, null, 2);

  function download() {
    // Plik powstaje w przeglądarce (Blob) — bez kolejnego zapytania do serwera.
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = jsonFileName(result.document.fileName);
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="json">
      <button type="button" className="button" onClick={download}>
        {messages.result.download}
      </button>
      <details className="json__details">
        <summary>{messages.result.preview}</summary>
        <pre className="json__preview">{json}</pre>
      </details>
    </div>
  );
}
