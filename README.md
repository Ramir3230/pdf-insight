# PDF Insight

Aplikacja webowa: wczytuje plik PDF, tworzy krótkie podsumowanie i zamienia treść w uporządkowane
dane JSON. Zadanie rekrutacyjne na stanowisko Vibe Coder — w budowie.

Demo: https://ramir3230.github.io/pdf-insight/

## Architektura

- `src/` — frontend (React + Vite, TypeScript `strict`), hosting na GitHub Pages.
  - `src/components/` — komponenty interfejsu.
  - `src/lib/` — logika bez interfejsu; `src/lib/messages.ts` — wszystkie teksty interfejsu.
- `api/analyze.ts` — funkcja Vercel, jedyny punkt wejścia backendu. Tylko odczyt ustawień.
- `server/` — logika backendu (CORS, obsługa żądania), testowana bez sieci. Poza `api/`, bo
  Vercel zamienia każdy plik w `api/` w osobną funkcję.
- `scripts/` — kontrole uruchamiane w `npm run check` i w CI (opis niżej).

Frontend i backend deployują się osobno:

- frontend buduje GitHub Actions i publikuje na Pages;
- backend wysyła na Vercel komenda `vercel deploy --prod`, bez integracji z GitHubem. Adres
  produkcyjny: `https://pdf-insight-pearl.vercel.app/api/analyze` (zmienna repozytorium
  `VITE_API_URL`). Adresy podglądu Vercel wymagają logowania, dlatego frontend zawsze używa
  adresu produkcyjnego.
- `vercel.json` wyłącza budowanie frontendu na Vercel; `.vercelignore` to lista dozwolonych
  plików (tylko backend). Statycznie Vercel serwuje tylko `vercel-static/robots.txt`, który
  zabrania indeksowania.

## Uruchomienie lokalne

Wymagany Node.js 24.

```sh
npm ci
npm run dev      # serwer deweloperski Vite
npm run check    # wszystkie kontrole, te same co w CI
```

Zmienne środowiskowe — w `.env.example` (bez wartości).

## Kontrole

`npm run check` uruchamia po kolei: `tsc` (frontend i backend osobno), ESLint, Prettier, testy
Vitest, build, a potem skrypty z `scripts/`:

- `check-dist.mjs` — każdy lokalny adres w `dist/index.html` zaczyna się od `/pdf-insight/`
  i wskazuje na istniejący plik.
- `check-secrets.mjs` — brak klucza API Anthropic w plikach repozytorium, w całej historii git
  i w `dist/`; `src/` i `dist/` nie odwołują się do zmiennej z kluczem; `.env.example` bez
  wartości klucza. Znalezionej wartości nie drukuje.
- `check-readme-deps.mjs` — każda zależność z `package.json` jest opisana niżej.

ESLint traktuje jako błąd `console` (wyjątek: `console.error` w backendzie), `any`
i `dangerouslySetInnerHTML`; komentarze `eslint-disable` są wyłączone.

CI (`.github/workflows/ci.yml`) na każdy push: `npm audit --audit-level=high`, `npm run check`;
na `main` dodatkowo deploy na GitHub Pages i test dymny `scripts/smoke.mjs` (demo odpowiada 200,
backend działa bez logowania, CORS przepuszcza domenę demo i odrzuca obcą).

## Zależności

Każda zależność ma powód. Bez zależności „na zapas”.

| Pakiet                             | Po co                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `react`, `react-dom`               | Interfejs (wymóg: React 18+)                                                 |
| `vite`                             | Serwer deweloperski i build frontendu                                        |
| `@vitejs/plugin-react`             | Obsługa React i JSX w Vite                                                   |
| `typescript`                       | TypeScript `strict`. Wersja 6.0: `typescript-eslint` nie obsługuje jeszcze 7 |
| `@types/react`, `@types/react-dom` | Typy Reacta                                                                  |
| `@types/node`                      | Typy Node dla backendu i skryptów                                            |
| `eslint`, `@eslint/js`             | Linter i reguły bazowe. Wersja 9: wtyczki React nie obsługują jeszcze 10     |
| `typescript-eslint`                | ESLint dla TypeScriptu, m.in. zakaz `any`                                    |
| `eslint-plugin-react`              | Reguły JSX, m.in. zakaz `dangerouslySetInnerHTML` (`react/no-danger`)        |
| `eslint-plugin-react-hooks`        | Poprawne użycie hooków                                                       |
| `eslint-plugin-jsx-a11y`           | Dostępność: obsługa klawiaturą, etykiety, teksty alternatywne                |
| `prettier`                         | Jednolite formatowanie                                                       |
| `vitest`                           | Testy jednostkowe                                                            |

## Znane ograniczenia

- ESLint 9 nie jest już wspierany przez autorów, ale `eslint-plugin-react`
  i `eslint-plugin-jsx-a11y` działają tylko z nim. `npm audit` pokazuje 7 podatności
  o poziomie moderate w narzędziach lintera (`minimatch`); nie trafiają do aplikacji, a CI blokuje
  od poziomu high.
