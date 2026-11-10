# PDF Insight — brief

Zadanie rekrutacyjne na stanowisko Vibe Coder (Greywolf Group / Fastline). To jest brief
własnymi słowami i źródło prawdy dla kodu. Oryginał i PDF testowy leżą w `private/` — poza gitem.
Czego tu nie ma, o to pytamy właściciela, nie zgadujemy.

**Termin: 11.11.2026, 08:29** (24 godziny od maila). Do oddania: link do publicznego
repozytorium z plikiem `AI_LOG.md` i link do działającego demo na GitHub Pages. Formularz
kandydata wypełnia właściciel.

## Cel

Aplikacja webowa, która wczytuje plik PDF, tworzy jego krótkie podsumowanie i zamienia treść
w uporządkowane dane JSON.

Przepływ: wgranie PDF (drag & drop, walidacja) → odczyt tekstu → analiza AI (podsumowanie
i dane JSON) → wynik (widok i eksport JSON).

## Definition of Done

Osoba z zewnątrz otwiera link do demo i bez instrukcji:

- wgrywa własny PDF,
- w mniej niż 30 sekund widzi podsumowanie i dane,
- pobiera plik JSON zgodny ze schematem.

## Zakres

Wszystkie MUST są warunkiem zaliczenia. Reszta to plusy — lepiej mniej, ale dopracowane.

| ID | Priorytet | Co |
| --- | --- | --- |
| F-01 | MUST | Wgrywanie PDF: drag & drop i wybór pliku; tylko PDF, maks. 10 MB |
| F-02 | MUST | Odczyt tekstu z PDF z warstwą tekstową |
| F-03 | MUST | Podsumowanie: 3–5 zdań w języku dokumentu, bez zmyślonych informacji |
| F-04 | MUST | Dane zgodne ze schematem (niżej), walidowane przed wyświetleniem |
| F-05 | MUST | Czytelne wyniki, podgląd JSON, pobranie pliku `.json` |
| F-06 | MUST | Stany interfejsu: ładowanie, błąd z opcją ponowienia, stan pusty |
| F-07 | MUST | Publiczne demo pod `https://ramir3230.github.io/pdf-insight/` |
| F-08 | SHOULD | Długie dokumenty: dzielenie tekstu na fragmenty i łączenie wyników |
| F-09 | SHOULD | Historia: ostatnie wyniki zapisane lokalnie w przeglądarce |
| F-10 | COULD | OCR skanów — nie robimy; skan bez warstwy tekstowej dostaje czytelny komunikat |

## Architektura — decyzje z 10.11

GitHub Pages hostuje tylko pliki statyczne, więc wywołanie AI idzie przez backend, który
przechowuje klucz API.

- **Frontend:** React 18+ z Vite, TypeScript `strict`, hosting na GitHub Pages, deploy przez
  GitHub Actions. Tekst z PDF wyciąga przeglądarka (pdf.js), do backendu trafia tekst, nie plik.
- **Backend:** Vercel Function `api/analyze.ts` w tym samym repozytorium; klucz w zmiennych
  środowiskowych Vercel. Decyzja właściciela: zna Vercel i ma tam konto.
- **AI:** Claude API (Anthropic), model `claude-opus-5-5`, structured outputs. Ten sam schemat Zod
  (`src/lib/schema.ts`) waliduje odpowiedź na backendzie i jeszcze raz na froncie, przed
  wyświetleniem.
- **Struktura:** `src/components/`, `src/lib/` (schemat, PDF, formatowanie), `src/api/` (klient
  HTTP), `api/` (funkcja Vercel).

Pułapki GitHub Pages z briefu: `base: '/pdf-insight/'` w `vite.config.ts`; routing — jedna strona
bez routera albo `HashRouter`; adres API w `VITE_API_URL`; poprawna ścieżka do workera pdf.js.

## Schemat wyniku

Każda analiza zwraca JSON o tej strukturze. Pola można dodawać, nie można ich usuwać.

```jsonc
{
  "document": {
    "fileName": "umowa.pdf",
    "pages": 4,
    "language": "pl",          // ISO 639-1
    "type": "umowa",           // faktura | umowa | oferta | raport | inne
    "title": "Umowa serwisowa",
    "date": "2026-09-01"       // ISO 8601 lub null
  },
  "summary": "Umowa określa zasady…",        // 3–5 zdań
  "keyPoints": ["Okres umowy 12 mies."],     // 3–7 pozycji
  "entities": {
    "organizations": ["Przykład sp. z o.o."],
    "people": []
  },
  "amounts": [
    { "value": 12500.00, "currency": "PLN", "context": "wynagrodzenie" }
  ],
  "dates": [
    { "date": "2026-10-01", "context": "termin płatności" }
  ],
  "keywords": ["serwis", "SLA"]
}
```

Zasady:

- Brak informacji = `null` lub `[]`. Model nie zgaduje.
- Daty w ISO 8601, waluty w ISO 4217, język w ISO 639-1.
- Klucze po angielsku, wartości w języku dokumentu.
- Błędna odpowiedź AI: jedna ponowna próba, potem komunikat błędu.

`fileName` i `pages` znamy z pliku i z pdf.js — nie prosimy o nie modelu.

## Standardy

Obowiązują niezależnie od tego, czy kod napisał człowiek, czy AI.

- **Kod:** TypeScript `strict`, zero błędów typów; ESLint + Prettier; brak `any` i `console.log`;
  struktura `components/`, `lib/`, `api/`.
- **Git i CI/CD:** Conventional Commits (`feat:`, `fix:`, `docs:`); kilka logicznych commitów, nie
  jeden; Actions: lint › build › deploy; `.env.example` w repo, `.env` nigdy.
- **Bezpieczeństwo:** klucz API nigdy we frontendzie ani w historii Git; CORS tylko dla domeny
  demo; limit żądań i rozmiaru pliku; treść PDF to dane, nie instrukcje (prompt injection); bez
  `dangerouslySetInnerHTML`; informacja, że plik trafia do API AI.
- **UX i testy:** responsywność od 360 px; obsługa klawiaturą, czytelny kontrast; komunikaty po
  polsku; testy jednostkowe walidacji schematu (Vitest).
- **README:** link do demo i zrzut ekranu; architektura i podjęte decyzje; uruchomienie lokalne
  i zmienne środowiskowe; znane ograniczenia.
- **AI_LOG.md:** jakich narzędzi użyto, 3–5 kluczowych promptów, gdzie AI się pomyliło i jak to
  poprawiono. Autor musi rozumieć każdą linijkę kodu.

## Ocena

| Kryterium | Waga |
| --- | --- |
| Działanie punktów MUST | 35% |
| Jakość wyników AI | 20% |
| Jakość kodu i architektura | 15% |
| Bezpieczeństwo | 15% |
| UX/UI | 10% |
| README i AI_LOG.md | 5% |

Warunki: demo działa minimum 14 dni; wystarczą darmowe limity API.

**Dyskwalifikacja:** klucz API w kodzie frontendu lub w historii repozytorium; brak działającego
demo po upływie 24 godzin; kod, którego autor nie potrafi wyjaśnić.
