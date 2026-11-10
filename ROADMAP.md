# ROADMAP — PDF Insight

**Termin: 11.11.2026, 08:29.** Cel na noc: wszystkie MUST na publicznym demo około 01:00.
Kolejność: najpierw to, co może zawieść w ostatniej chwili (deploy na Pages, backend z kluczem),
potem funkcje, na końcu szlif i dokumenty. Zamknięty blok — odhaczyć tutaj i dopisać, co wyszło
po drodze.

- [x] **0. Środowisko** (10.11, ok. 22:15) — brief własnymi słowami, ta roadmapa, zasady dla
      agenta (`CLAUDE.md`), `AI_LOG.md`, publiczne repozytorium z czystą historią i ukrytym e-mailem.
- [ ] **1. Szkielet i CI** — Vite + React + TypeScript `strict`, ESLint + Prettier, Vitest; jedna
      komenda `npm run check` (tsc, eslint, prettier, testy, build); `base: '/pdf-insight/'`;
      workflow Actions: check › build › deploy na Pages. Efekt: pusta strona widoczna pod adresem
      demo.
- [ ] **2. Schemat** — `src/lib/schema.ts` (Zod, dokładnie według briefu) i testy Vitest:
      poprawny wynik przechodzi; brak pola, zły `type`, zła data, zła waluta, `summary` spoza 3–5
      zdań — odrzucone.
- [ ] **3. PDF w przeglądarce** (F-01, F-02) — drag & drop i wybór pliku, tylko PDF do 10 MB;
      pdf.js z workerem podpiętym przez Vite; tekst i liczba stron; PDF bez warstwy tekstowej —
      komunikat, że skanów nie obsługujemy.
- [ ] **4. Backend** (F-03, F-04) — `api/analyze.ts` na Vercel: POST z tekstem, nazwą pliku
      i liczbą stron; CORS tylko dla `https://ramir3230.github.io`; limit rozmiaru tekstu i limit
      żądań na IP; Claude ze structured output; treść PDF oddzielona od instrukcji; jedna ponowna
      próba; błędy po polsku.
      Właściciel: klucz API Anthropic z ustawionym limitem wydatków; `vercel env add
ANTHROPIC_API_KEY` wpisuje sam — agent nie widzi wartości.
- [ ] **5. Interfejs** (F-05, F-06) — stan pusty, ładowanie, błąd z ponowieniem; podsumowanie,
      kluczowe punkty, podmioty, kwoty, daty, słowa kluczowe; podgląd i pobranie JSON; informacja,
      że tekst trafia do API AI; od 360 px, klawiatura, kontrast.
- [ ] **6. Demo od początku do końca** (F-07) — `VITE_API_URL` w Actions, merge do `main`, test
      w oknie prywatnym na PDF testowym i na własnym PDF: wynik w mniej niż 30 sekund.
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
