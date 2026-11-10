import { GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// pdf.js czyta plik w osobnym wątku (Web Worker), żeby strona nie zamarzała przy dużym PDF.
// `?url` każe Vite skopiować plik workera do dist/assets i zwrócić jego adres z prefiksem
// /pdf-insight/ — ten sam adres działa lokalnie i na GitHub Pages.
// Importowany tylko w main.tsx: testy w Node działają bez workera.
GlobalWorkerOptions.workerSrc = workerUrl;
