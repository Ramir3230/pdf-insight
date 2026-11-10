import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
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
  const [isDragging, setIsDragging] = useState(false);

  // Plik upuszczony obok strefy przeglądarka otworzyłaby w miejscu aplikacji — blokujemy to.
  useEffect(() => {
    const preventOpening = (event: globalThis.DragEvent) => event.preventDefault();
    window.addEventListener("dragover", preventOpening);
    window.addEventListener("drop", preventOpening);
    return () => {
      window.removeEventListener("dragover", preventOpening);
      window.removeEventListener("drop", preventOpening);
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
      <button type="button" className="button" onClick={() => inputRef.current?.click()}>
        {buttonLabel}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        hidden
        onChange={handleChange}
      />
      <p className="dropzone__limits">{messages.upload.limits}</p>
    </div>
  );
}
