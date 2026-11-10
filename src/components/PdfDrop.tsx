import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { messages } from "../lib/messages";

type PdfDropProps = {
  // Wywoływane z listą plików z upuszczenia albo z okna wyboru; sprawdza je rodzic.
  onFiles: (files: File[]) => void;
  buttonLabel: string;
};

// Strefa wgrywania: przeciągnij i upuść albo przycisk otwierający okno wyboru pliku.
// Przycisk to prawdziwy <button> — działa z klawiatury i na telefonie, gdzie przeciągania nie ma.
export function PdfDrop({ onFiles, buttonLabel }: PdfDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const limitsId = useId();
  const [isDragging, setIsDragging] = useState(false);

  // Plik upuszczony obok strefy przeglądarka otworzyłaby w miejscu aplikacji — blokujemy to
  // i pokazujemy kursor „nie można upuścić”. Strefa obsługuje zdarzenie wcześniej (React słucha
  // na #root, a window jest ostatnie), więc jej upuszczenia mają już defaultPrevented.
  useEffect(() => {
    const blockOutsideZone = (event: globalThis.DragEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "none";
      }
    };
    window.addEventListener("dragover", blockOutsideZone);
    window.addEventListener("drop", blockOutsideZone);
    return () => {
      window.removeEventListener("dragover", blockOutsideZone);
      window.removeEventListener("drop", blockOutsideZone);
    };
  }, []);

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    onFiles(Array.from(event.dataTransfer.files));
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Czyścimy wybór, żeby ponowny wybór tego samego pliku też wywołał onChange.
    event.target.value = "";
    if (files.length > 0) {
      onFiles(files);
    }
  }

  return (
    <div
      className={isDragging ? "dropzone dropzone--active" : "dropzone"}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <p className="dropzone__hint">{messages.upload.dropHint}</p>
      <p className="dropzone__hint">{messages.upload.or}</p>
      {/* aria-describedby: czytnik ekranu poda przy przycisku ograniczenia (PDF, 10 MB) —
          także na telefonie, gdzie podpowiedź o przeciąganiu jest ukryta. */}
      <button
        type="button"
        className="button"
        aria-describedby={limitsId}
        onClick={() => inputRef.current?.click()}
      >
        {buttonLabel}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        hidden
        onChange={handleChange}
      />
      <p id={limitsId} className="dropzone__limits">
        {messages.upload.limits}
      </p>
    </div>
  );
}
