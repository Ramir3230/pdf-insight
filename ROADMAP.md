# ROADMAP — PDF Insight

**Termin: 11.11.2026, 08:29.** Cel na noc: wszystkie MUST na publicznym demo około 01:00.
Kolejność: najpierw to, co może zawieść w ostatniej chwili (deploy na Pages, backend z kluczem),
potem funkcje, na końcu szlif i dokumenty. Zamknięty blok — odhaczyć tutaj i dopisać, co wyszło
po drodze.

- [x] **0. Środowisko** (10.11, ok. 22:15) — brief własnymi słowami, ta roadmapa, zasady dla
      agenta (`CLAUDE.md`), `AI_LOG.md`, publiczne repozytorium z czystą historią i ukrytym e-mailem.
- [x] **1. Szkielet i CI** (10.11, ok. 23:30) — Vite + React + TypeScript `strict`, ESLint +
      Prettier, Vitest; jedna komenda `npm run check` (tsc, eslint, prettier, testy, build);
      `base: '/pdf-insight/'`; workflow Actions: check › build › deploy na Pages. Efekt: pusta
      strona widoczna pod adresem demo.
      Po drodze: kontrole sekretów (pliki, indeks, cała historia, `dist/`), ścieżek `dist/`
      i zależności w README; hook pre-commit; test dymny po deployu; backend-zaślepka z CORS
      na Vercel (`https://pdf-insight-pearl.vercel.app/api/analyze`) wdrażany przez
      `npm run deploy:api`. TypeScript 6 i ESLint 9 zamiast najnowszych — zgodność wtyczek.
      Ustalenia z planu bloków 1–6 (10.11, zaakceptowane przez właściciela), wspólne dla wszystkich
      bloków: bloki 2–6 na gałęzi `feat/analyze`; po każdym bloku recenzent, wyjaśnienie po rosyjsku,
      wpis w `AI_LOG.md`, odhaczenie tutaj i stop na pytania właściciela; przed każdym merge'em do
      `main` — wszystkie teksty interfejsu jedną listą dla właściciela.

- [x] **2. Schemat** (11.11, ok. 00:30) — `src/lib/schema.ts` (Zod, dokładnie według briefu)
      i testy Vitest: poprawny wynik przechodzi; brak pola, zły `type`, zła data, zła waluta,
      `summary` spoza 3–5 zdań — odrzucone.
      Ustalenia: dwa schematy — odpowiedź modelu (`summary` jako lista 3–5 zdań, bo structured
      outputs nie ograniczają długości, a liczenie zdań po kropkach psuje „sp. z o.o.”) i wynik
      końcowy według briefu (`summary` jako tekst sklejony na backendzie; `fileName`, `pages`
      z pdf.js). Testy także: zły język, `keyPoints` spoza 3–7. Importy względne w `src/lib`
      z rozszerzeniem `.js` (backend kompiluje je jako NodeNext).
      Po drodze: Zod 4; `toAnalysisResult` skleja wynik końcowy; `sourceFileSchema` — dane pliku
      jednym schematem; `currency` może być `null` (kwota bez waluty, model nie zgaduje —
      wyłapał recenzent); tekst z samych spacji odrzucany (`trim`); `tsconfig.json` backendu
      kompiluje schemat już teraz. Każdy test odrzucenia sprawdza ścieżkę błędu, a nie samo
      odrzucenie; testy przeszły próbę z celowo popsutym schematem.
- [ ] **3. PDF w przeglądarce** (F-01, F-02) — drag & drop i wybór pliku, tylko PDF do 10 MB;
      pdf.js z workerem podpiętym przez Vite; tekst i liczba stron; PDF bez warstwy tekstowej —
      komunikat, że skanów nie obsługujemy.
      Ustalenia: teksty tylko w `src/lib/messages.ts`; testy walidacji pliku, wyciągania tekstu
      z PDF-fikstury i skanu; `check-dist` sprawdza, że plik workera jest w `dist/` i bundle się
      do niego odwołuje, a `smoke.mjs` pobiera go z Pages; sprawdzenie w Chrome, także 360 px
      (okno nie zwęża się do 360 — iframe o szerokości 360).
- [ ] **4. Backend** (F-03, F-04) — `api/analyze.ts` na Vercel: POST z tekstem, nazwą pliku
      i liczbą stron; CORS tylko dla `https://ramir3230.github.io`; limit rozmiaru tekstu i limit
      żądań na IP; Claude ze structured output; treść PDF oddzielona od instrukcji; jedna ponowna
      próba; błędy po polsku.
      Właściciel: klucz API Anthropic z ustawionym limitem wydatków; `vercel env add
ANTHROPIC_API_KEY` wpisuje sam — agent nie widzi wartości.
      Ustalenia: przed kodem skill `claude-api` (m.in. `messages.parse` + `zodOutputFormat`,
      jawne `effort`, parametr `fallbacks` przy odmowie modelu); odmowa modelu → błąd po polsku.
      Logika w `server/`, `api/analyze.ts` tylko łączy ustawienia. Puste lub złe body → 400 przed
      jakimkolwiek wywołaniem Claude (test), a `smoke.mjs` przechodzi z oczekiwanego 501 na ten
      400 i jego `error.code`. Limit żądań w pamięci funkcji — ograniczenie opisane w README.
      Testy bez sieci z podstawionym klientem: obcy origin 403, limit rozmiaru, limit żądań,
      dokładnie jedna ponowna próba na złą odpowiedź AI. W testach klucz to `"test-key"`.
      Deploy tylko `npm run deploy:api`. Płatny przebieg `scripts/live-check.mjs` na produkcji:
      umowa testowa (typ, strony, kwoty, daty, czas) z oczekiwaniami w `private/` i PDF
      z wstrzykniętym poleceniem (polecenie nie wykonane); do 8 wywołań z doborem `effort`.
      Z bloku 2: test bez sieci z `zodOutputFormat(modelOutputSchema)` — co SDK wysyła do API
      (m.in. długi `pattern` z `z.iso.date()`), a pierwsze płatne wywołanie potwierdza, że API
      to przyjmuje; nazwa pliku i liczba stron z żądania sprawdzane `sourceFileSchema` (400).
      W prompcie: daty bez dnia pomijać, kwota bez waluty → `currency: null`, krótki dokument —
      minimum 3 zdań i 3 punktów bez dopisywania faktów.
- [ ] **5. Interfejs** (F-05, F-06) — stan pusty, ładowanie, błąd z ponowieniem; podsumowanie,
      kluczowe punkty, podmioty, kwoty, daty, słowa kluczowe; podgląd i pobranie JSON; informacja,
      że tekst trafia do API AI; od 360 px, klawiatura, kontrast.
      Ustalenia: odpowiedź backendu walidowana tym samym schematem przed wyświetleniem; lokalnie
      dane daje mock poza repozytorium (produkcyjny backend nie przepuszcza localhost);
      sprawdzenie w Chrome wszystkich stanów na 360 px i desktopie.
- [ ] **6. Demo od początku do końca** (F-07) — `VITE_API_URL` w Actions, merge do `main`, test
      w oknie prywatnym na PDF testowym i na własnym PDF: wynik w mniej niż 30 sekund.
      Ustalenia: przed merge'em lista tekstów interfejsu; `check-dist` sprawdza, że bundle
      zawiera produkcyjny adres Vercel z `VITE_API_URL`, a nie adres podglądu; agent przechodzi
      demo w Chrome z umową testową i PDF z wstrzykniętym poleceniem, mierzy czas. Właściciel:
      okno prywatne, własny PDF, stoper — poniżej 30 sekund.
- [ ] **7. Historia** (F-09, SHOULD) — ostatnie wyniki w `localStorage`, jeśli zostanie czas.
- [ ] **8. Długie dokumenty** (F-08, SHOULD) — do decyzji: model ma okno 1M tokenów, więc
      prostsza droga to limit rozmiaru tekstu opisany w README; podział na fragmenty i łączenie —
      tylko jeśli zostanie czas.
- [ ] **9. README i AI_LOG** — link do demo i zrzut ekranu, architektura i decyzje, uruchomienie
      lokalne, zmienne środowiskowe, znane ograniczenia; w AI_LOG wybrać 3–5 kluczowych promptów.
- [ ] **10. Przegląd z właścicielem** — recenzent po pełnym diffie; właściciel przechodzi każdy
      plik i umie go objaśnić.
- [ ] **11. Oddanie** (właściciel) — formularz kandydata: repozytorium w polu „Link do zadania
      testowego”, demo w polu „Komentarz do zadania”, forma współpracy i oczekiwania finansowe.
