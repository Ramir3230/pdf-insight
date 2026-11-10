# PDF Insight

Aplikacja webowa: wczytuje plik PDF, tworzy krótkie podsumowanie i zamienia treść w uporządkowane
dane JSON. Zadanie rekrutacyjne na stanowisko Vibe Coder — w budowie.

Demo: https://ramir3230.github.io/pdf-insight/

## Architektura

- `src/` — frontend (React + Vite, TypeScript `strict`), hosting na GitHub Pages.
  - `src/components/` — komponenty interfejsu.
  - `src/lib/` — logika bez interfejsu; `src/lib/messages.ts` — wszystkie teksty interfejsu;
    `src/lib/schema.ts` — schemat wyniku (Zod), wspólny dla frontendu i backendu.
  - Odczyt PDF w przeglądarce — plik nie trafia na serwer, dalej idzie tylko tekst:
    `pdfFile.ts` sprawdza plik (jeden, niepusty, do 10 MB, nagłówek `%PDF-` w treści — nie
    nazwa ani typ MIME), `pdfText.ts` wyciąga tekst i liczbę stron przez pdf.js (wersja 6 nie
    ma już `eval` ani `new Function`, przez które w starszych wersjach spreparowany PDF mógł
    wykonać kod), `readPdf.ts` łączy oba kroki i zamienia problemy na kody
    błędów, `pdfWorker.ts` podpina worker pdf.js z `dist/assets`. Testy używają małych plików
    PDF budowanych w kodzie (`src/lib/testing/makeTestPdf.ts`), bez binarnych fikstur.
- `api/analyze.ts` — funkcja Vercel, jedyny punkt wejścia backendu. Tylko odczyt ustawień.
- `server/` — logika backendu (CORS, obsługa żądania), testowana bez sieci. Poza `api/`, bo
  Vercel zamienia każdy plik w `api/` w osobną funkcję.
- `scripts/` — kontrole uruchamiane w `npm run check` i w CI (opis niżej).

Frontend i backend deployują się osobno:

- frontend buduje GitHub Actions i publikuje na Pages;
- backend wysyła na Vercel `npm run deploy:api` (`scripts/deploy-api.mjs`), bez integracji
  z GitHubem. Skrypt odmawia przy niezatwierdzonych zmianach (produkcja odpowiada commitowi),
  po deployu sprawdza, że `vercel` niczego nie zmienił w repozytorium, i uruchamia test dymny
  API. Adres produkcyjny: `https://pdf-insight-pearl.vercel.app/api/analyze` (zmienna
  repozytorium `VITE_API_URL`). Adresy podglądu Vercel wymagają logowania, dlatego frontend
  zawsze używa adresu produkcyjnego.
- `vercel.json` wyłącza budowanie frontendu na Vercel; `.vercelignore` to lista dozwolonych
  plików (tylko backend). Statycznie Vercel serwuje tylko `vercel-static/robots.txt`, który
  zabrania indeksowania.

## Uruchomienie lokalne

Wymagany Node.js 24.

```sh
npm ci
git config core.hooksPath .githooks   # hook pre-commit: blokuje commit z kluczem API
npm run dev      # serwer deweloperski Vite
npm run check    # kontrole z CI (CI dodatkowo uruchamia npm audit)
```

Zmienne środowiskowe — w `.env.example` (bez wartości).

## Kontrole

`npm run check` uruchamia po kolei: `tsc` (frontend i backend osobno), ESLint, Prettier, testy
Vitest, build, a potem skrypty z `scripts/`:

- `check-dist.mjs` — każdy lokalny adres w `dist/index.html` zaczyna się od `/pdf-insight/`
  i wskazuje na istniejący plik; strona ma znacznik wersji `<meta name="build">`; worker pdf.js
  jest w `dist/assets`, a skrypt aplikacji odwołuje się do niego pełnym adresem.
- `check-secrets.mjs` — brak klucza API Anthropic w plikach na dysku, w indeksie git, w całej
  historii git (zmiany, także z commitów merge, wiadomości commitów, opisy tagów) i w `dist/`;
  pliki w UTF-16 też są sprawdzane. `src/` i `dist/` nie odwołują się do zmiennej z kluczem;
  `.env.example` bez wartości klucza. Znalezionej wartości nie drukuje.
- `check-readme-deps.mjs` — każda zależność z `package.json` jest opisana niżej.

ESLint traktuje jako błąd `console` (wyjątek: `console.error` w backendzie), `any`
i `dangerouslySetInnerHTML`; komentarze `eslint-disable` są wyłączone.

Klucz w historii git to dyskwalifikacja, której nie da się cofnąć bez przepisywania historii,
dlatego są trzy warstwy: hook `.githooks/pre-commit` (`check-secrets.mjs --staged`) zatrzymuje
commit z kluczem; GitHub secret scanning z push protection jest włączony w repozytorium; CI
sprawdza całą historię po każdym pushu.

CI (`.github/workflows/ci.yml`) na każdy push: `npm audit --audit-level=high`, `npm run check`;
na `main` dodatkowo deploy na GitHub Pages i test dymny `scripts/smoke.mjs`: demo odpowiada 200
i podaje wersję z właśnie zbudowanego commita, worker pdf.js odpowiada 200 z typem JavaScript
(sam status nie wystarcza: serwer może na brakujący plik oddać stronę HTML z kodem 200),
backend działa bez logowania, CORS przepuszcza domenę demo i odrzuca obcą.

## Zależności

Każda zależność ma powód. Bez zależności „na zapas”.

| Pakiet                             | Po co                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `react`, `react-dom`               | Interfejs (wymóg: React 18+)                                                 |
| `zod`                              | Schemat wyniku: walidacja na backendzie i froncie, structured outputs Claude |
| `pdfjs-dist`                       | pdf.js (Mozilla): tekst i liczba stron z PDF w przeglądarce, bez serwera     |
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

- Skany i PDF bez warstwy tekstowej nie są obsługiwane (brak OCR) — użytkownik dostaje
  komunikat. PDF, w którym tylko część stron ma tekst, jest analizowany na podstawie tej części.
- PDF chroniony hasłem — komunikat z prośbą o zapisanie pliku bez hasła.
- Aplikacja nie dołącza map znaków (cMaps) ani standardowych czcionek pdf.js — są potrzebne do
  rysowania stron i rzadkich kodowań (głównie chińskich, japońskich, koreańskich), a my tylko
  wyciągamy tekst. Tekst w takich kodowaniach może się nie odczytać.

- ESLint 9 nie jest już wspierany przez autorów, ale `eslint-plugin-react`
  i `eslint-plugin-jsx-a11y` działają tylko z nim. `npm audit` pokazuje 7 podatności
  o poziomie moderate w narzędziach lintera (`minimatch`); nie trafiają do aplikacji, a CI blokuje
  od poziomu high.
