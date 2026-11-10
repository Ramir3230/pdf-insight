// Zmienne środowiskowe frontendu wstawiane przez Vite przy buildzie (w GitHub Actions: zmienna
// repozytorium). Opisane tutaj, żeby TypeScript znał ich typ.
interface ImportMetaEnv {
  // Adres backendu, np. https://pdf-insight-pearl.vercel.app/api/analyze
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
