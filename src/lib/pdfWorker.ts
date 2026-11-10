import { GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// pdf.js czyta plik w osobnym wątku (Web Worker), żeby strona nie zamarzała przy dużym PDF.
// `?url` każe Vite podać adres pliku workera: w buildzie Vite kopiuje go do dist/assets
// (adres /pdf-insight/assets/pdf.worker.min-HASH.mjs), w trybie dev serwuje go
// z node_modules. Mechanizm ten sam, adresy różne.
// Importowany tylko w main.tsx: testy w Node działają bez workera.
GlobalWorkerOptions.workerSrc = workerUrl;
