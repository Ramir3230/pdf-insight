# ROADMAP — PDF Insight

**Termin: 11.11.2026, 08:29.** Cel na noc: wszystkie MUST na publicznym demo około 01:00.
Kolejność: najpierw to, co może zawieść w ostatniej chwili (deploy na Pages, backend z kluczem),
potem funkcje, na końcu szlif i dokumenty. Zamknięty blok — odhaczyć tutaj i dopisać, co wyszło
po drodze.

## Noc 11.11 — praca autonomiczna (decyzja właściciela, 00:51)

Bloki 3–5 agent robi bez zatrzymań na pytania; recenzent po każdym bloku zostaje. Wyjaśnienia
po rosyjsku i decyzje z rozwidleń — w `private/noc-raporty.md` (poza gitem), zapisywane od razu.
Po każdym skompresowaniu kontekstu: przeczytać tę sekcję, `.claude/gotchas.md`, `git log`,
`git status` i raport, potem następny niezamknięty krok.

**Cel na 06:00:** gałąź `feat/analyze` gotowa do merge'a.

1. Backend na produkcji: `live-check` na umowie testowej — poprawny typ, strony, kwoty, daty,
   czas poniżej 30 s; polecenie wstrzyknięte w PDF nie zostało wykonane.
2. Frontend lokalnie sprawdzony w Chrome na 360 px i desktopie: stan pusty, ładowanie, błąd
   z ponowieniem, wynik, podgląd i pobranie JSON.
3. `npm run check` zielony, gałąź wypchnięta, CI na gałęzi zielone.
4. Raport po rosyjsku dla każdego bloku.

**Priorytety przy konflikcie:** 1) bezpieczeństwo — klucz nigdy w kodzie, wyjściu komend ani
historii; 2) działające MUST przed szlifem, SHOULD (bloki 7, 8) nie w nocy; 3) kontroli nie
skracamy — skracamy szlif; 4) prosty kod przed krótkim.

**Punkty kontrolne:** blok 3 ok. 02:00, blok 4 ok. 03:30, blok 5 ok. 05:00, szkice README
i AI_LOG ok. 05:45. Blok dłuższy o ponad 30 minut → najprostsza działająca droga i zapis
w raporcie.

**Granice:** `main` bez zmian (merge rano z właścicielem); najwyżej 8 płatnych wywołań API;
rozwidlenie → rozsądny domyślny wybór i zapis w raporcie; stop tylko przed czymś
nieodwracalnym (pieniądze, sekrety, produkcja). Praca wyłącznie w tym repozytorium i katalogu
tymczasowym sesji: bez zmian w systemie, bez instalacji globalnych.

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
- [x] **3. PDF w przeglądarce** (F-01, F-02; 11.11, ok. 01:25) — drag & drop i wybór pliku, tylko PDF do 10 MB;
      pdf.js z workerem podpiętym przez Vite; tekst i liczba stron; PDF bez warstwy tekstowej —
      komunikat, że skanów nie obsługujemy.
      Ustalenia: teksty tylko w `src/lib/messages.ts`; testy walidacji pliku, wyciągania tekstu
      z PDF-fikstury i skanu; `check-dist` sprawdza, że plik workera jest w `dist/` i bundle się
      do niego odwołuje, a `smoke.mjs` pobiera go z Pages; sprawdzenie w Chrome, także 360 px
      (okno nie zwęża się do 360 — iframe o szerokości 360).
      Plan z 11.11 (zaakceptowany): `src/lib/pdfFile.ts` — kolejno: jeden plik, niepusty,
      do 10 MB (przed czytaniem), sygnatura `%PDF-` w pierwszych 1024 bajtach (PDF poznajemy po
      treści, nie po nazwie i MIME). `src/lib/pdfText.ts` — `pdfjs-dist`,
      `isEvalSupported: false`, tekst stronami (`hasEOL` → nowa linia, strony oddzielone pustą
      linią); błędy: skan
      (brak liter i cyfr `\p{L}\p{N}`), hasło, uszkodzony plik. `src/lib/pdfWorker.ts` — worker
      przez `?url`, import w `main.tsx`. Fikstury PDF generowane w kodzie testu (bez binarnych
      plików). `src/components/PdfDrop.tsx`: strefa upuszczania + prawdziwy `<button>` z ukrytym
      `<input type="file">`; `preventDefault` na `window` dla upuszczenia obok strefy; stany:
      pusty, czytanie (`aria-live`), gotowe („Odczytano …: N stron, M znaków”), błąd
      (`role="alert"`); liczy się ostatnio wybrany plik; liczba mnoga przez `Intl.PluralRules`.
      Bez cMaps i czcionek standardowych pdf.js (potrzebne do rysowania) — ograniczenie w README.
      pdf.js importowany statycznie; jeśli build ostrzeże o chunku > 500 kB — leniwy `import()`.
      Po drodze: `isEvalSupported` wypadł — pdf.js 6 nie ma tej opcji ani `eval`/`new Function`
      w kodzie; wbrew planowi pdf.js zostaje statyczny, próg ostrzeżenia 800 kB z uzasadnieniem
      w `vite.config.ts` (mały zysk, dodatkowy stan i loader); testy w Node na
      `pdfjs-dist/legacy`. Z recenzji: `readPdf` nie rzuca przy nieczytelnym pliku (UI wisiał
      w „Odczytuję…”); skan = średnio < 50 liter na stronę (skan z pieczątką tekstową);
      błędy pdf.js przez `instanceof`; dostępność (kontrast ramki, `aria-describedby`, ramka
      przycisku w trybie wysokiego kontrastu, kursor „nie można upuścić” obok strefy); test
      dymny ponawia pobranie workera. Nowa kontrola `check-invisible.mjs` (grabie 8). Próbki,
      które musiały oblać: `check-dist` bez workera i bez odwołania; `smoke` na obecnych Pages
      i na kopii bez pliku workera (serwer oddał HTML z kodem 200 — stąd sprawdzanie typu);
      mutacje kodu — każdy test czerwienieje na swoim błędzie.
- [x] **4. Backend** (F-03, F-04; 11.11, ok. 01:55) — `api/analyze.ts` na Vercel: POST z tekstem, nazwą pliku
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
      Plan z 11.11 (noc, z planu zaakceptowanego 10.11): `server/claude.ts` — wywołanie SDK
      (`client.beta.messages.parse`, `betaZodOutputFormat(modelOutputSchema)`, beta
      `server-side-fallback-2026-07-01` + `fallbacks: "default"`, jawne `effort`, `maxRetries: 0`,
      limit czasu); zwraca odpowiedź albo „zła odpowiedź” (parse rzuca `AnthropicError`, który nie
      jest `APIError`) / „odmowa” (`stop_reason: "refusal"`). `server/prompt.ts` — prompt
      systemowy po polsku i blok `<dokument>` z tekstem (znaczniki w treści neutralizowane);
      nazwa pliku nie trafia do modelu (dane użytkownika = możliwa wstrzyknięta instrukcja).
      `server/analyze.ts` — dokładnie jedna ponowna próba przy złej odpowiedzi lub błędzie
      przejściowym API, bez ponowienia przy odmowie; składa wynik `toAnalysisResult`.
      `server/rateLimit.ts` — limit w pamięci na IP (`x-real-ip`/`x-forwarded-for`), liczony
      tylko dla żądań, które idą do Claude. `src/lib/schema.ts` — `analyzeRequestSchema`
      (tekst do `MAX_TEXT_CHARS` = 200 000 znaków, wspólny z frontem). Handler: origin → OPTIONS
      → metoda → rozmiar body (413) → JSON i schemat (400; za długi tekst 413) → limit (429) →
      analiza (200 / 422 odmowa / 502 zła odpowiedź / 503 API niedostępne / 500 brak klucza).
      Testy SDK bez sieci: podstawiony `fetch` w kliencie Anthropic — sprawdza body żądania
      i parsowanie prawdziwym SDK. `scripts/live-check.mjs` (płatny, poza `check`): umowa
      testowa + tekst z wstrzykniętym poleceniem, oczekiwania w `private/`.
      Po drodze: `messages.parse` zastąpione `messages.create` z tym samym `betaZodOutputFormat`
      (recenzent: `parse` przy błędzie parsowania gubi odpowiedź — odmowa w trakcie pisania
      wyglądała jak zła odpowiedź, a wynik modelu zapasowego przepadał); bez ponowienia po
      przekroczeniu czasu (25 s na próbę) i przy błędach nieprzejściowych (zły klucz, limit
      wydatków → 500 `misconfigured`); każdy nieprzewidziany wyjątek → JSON 500 z CORS; prompt
      doprecyzowany (język dokumentu, rodzaje dokumentów, kropki, wprost o brakach, artefakty
      PDF); adres IP tylko z `x-forwarded-for` (dokumentacja Vercel); `fileName` do 255 znaków.
      Płatne przebiegi, effort `low`, 6 z 8 wywołań: umowa testowa 16,0 s i 16,3 s; faktura
      z wstrzykniętym poleceniem 6,1 s i 6,0 s; umowa po angielsku 6,9 s; tekst 186 505 znaków
      (umowa powtórzona 9 razy) 18,2 s. Wszystkie kontrole zielone, polecenia z treści
      dokumentów niewykonane. Innych poziomów effort nie mierzyliśmy. Pierwszy test dymny po
      deployu oblał (najpewniej stara wersja pod adresem tuż po deployu) — teraz ponawia.
- [x] **5. Interfejs** (F-05, F-06; 11.11, ok. 02:10) — stan pusty, ładowanie, błąd z ponowieniem; podsumowanie,
      kluczowe punkty, podmioty, kwoty, daty, słowa kluczowe; podgląd i pobranie JSON; informacja,
      że tekst trafia do API AI; od 360 px, klawiatura, kontrast.
      Ustalenia: odpowiedź backendu walidowana tym samym schematem przed wyświetleniem; lokalnie
      dane daje mock poza repozytorium (produkcyjny backend nie przepuszcza localhost);
      sprawdzenie w Chrome wszystkich stanów na 360 px i desktopie.
      Po drodze: `src/api/analyzeClient.ts` (każdy problem to kod błędu; wynik sprawdzany
      `analysisResultSchema`), `src/lib/format.ts` (kwoty, daty, języki po polsku przez `Intl`),
      `ResultView.tsx`, `JsonExport.tsx` (plik powstaje w przeglądarce); czas od wgrania do wyniku
      widoczny przy wyniku; fokus na nagłówku wyniku. Sprawdzone w przeglądarce na mocku
      (`private/mock-api.mjs`, dane z płatnego przebiegu): wszystkie stany i kody błędów,
      ponowienie, nowszy plik wypiera starszy przebieg, odpowiedź 200 niezgodna ze schematem nie
      trafia na ekran, puste sekcje, 360 px w ramce; treść pobranego JSON przechwycona (pliku nie
      zapisywaliśmy). Z recenzji: ponowienie tylko przy błędach przejściowych i fokus na
      przycisku; `lang` tylko na tekstach dokumentu; zwolnienie adresu pliku po 10 s (Safari);
      testy w strefie czasowej na zachód od UTC (test daty łapie przesunięcie o dzień); jawne
      mapowanie kodów backendu; długa nazwa pliku skracana przed wysłaniem. Bez testów
      automatycznych komponentów (nie ma jsdom) — maszyna stanów sprawdzona ręcznie w przeglądarce.
      Przygotowane do bloku 6: `check-dist` sprawdza adres backendu w bundle (w CI obowiązkowy,
      nie adres deploymentu).
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
