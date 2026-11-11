# Grabie — błędy agenta i to, co ich pilnuje

Każdy błąd agenta w tym projekcie zamienia się w regułę albo, lepiej, w kontrolę w kodzie, żeby
się nie powtórzył. Ten sam wpis trafia do `AI_LOG.md` („Gdzie AI się pomyliło”).

Format: **co poszło nie tak** → **reguła lub kontrola** (gdzie mieszka).

## Wpisy

1. **Regex w `check-secrets.mjs` dał fałszywy alarm** (blok 1): `^\s*KLUCZ\s*=\s*\S` uznał pusty
   `ANTHROPIC_API_KEY=` za wypełniony, bo `\s` obejmuje znak nowej linii i wzorzec „przeskoczył”
   na następną zmienną. → W wzorcach liniowych spacje to `[ \t]`, nie `\s`. Każda nowa kontrola
   jest sprawdzana na próbce, która musi ją oblać, i na próbce, która musi przejść.
2. **Test dymny zakładał, że chroniony adres Vercel odpowie 401 na preflight** (blok 1): Vercel
   Deployment Protection odpowiada na `OPTIONS` kodem 204, więc „401 = adres podglądu” nie
   działało — wyszło dopiero na próbce, która musiała oblać (unikalny adres deploymentu). →
   `smoke.mjs` sprawdza logowanie POST-em. Ta sama zasada co w punkcie 1: każdą kontrolę
   uruchomić także na przypadku, który musi ją oblać.
3. **`vercel link` zmienił projekt bez pytania** (blok 1): podłączył repozytorium GitHub
   (wbrew planowi), pobrał token OIDC do `.env.local` i dopisał do `.gitignore` regułę `.env*`,
   która unieważniała wyjątek `!.env.example`. → Po każdej komendzie `vercel` sprawdzić
   `git diff .gitignore` i `git status`, a po `vercel link` także integrację Git (jeśli się
   pojawiła — `vercel git disconnect`). Ustawienia projektu Vercel trzymać w `vercel.json`,
   a nie w panelu: link zapisał w projekcie katalog `dist` z wykrytego Vite i pierwszy deploy
   padł. Od teraz backend wdraża `npm run deploy:api`, który sam sprawdza `git status` po
   komendzie `vercel`.
4. **Kontrole obiecywały więcej, niż sprawdzały** (blok 1, wyłapał recenzent): `check-secrets`
   miał przeszukiwać „całą historię”, a `git log -p` pomija zmiany z commitów merge, wiadomości
   commitów i opisy tagów; pliki w UTF-16 (domyślny `>` w PowerShell 5.1) i wersje w indeksie
   przechodziły. `smoke.mjs` „czekał na nową wersję na CDN”, ale przyjmował dowolną odpowiedź 200. → Komentarz lub README opisuje tylko to, co jest sprawdzone próbką, która musi oblać;
   dla każdej obietnicy kontroli jest osobna próbka (merge, wiadomość, tag, UTF-16, indeks,
   stara wersja na CDN).
5. **Ryzyko: fałszywy klucz w teście** (blok 1, recenzent): mock `sk-ant-test…` w commicie
   oblewa CI na zawsze, a usunięcie z historii wymaga force-pusha do `main`. → Reguła
   w `CLAUDE.md` (żadnych literałów `sk-ant-`) i hook `.githooks/pre-commit`, który zatrzymuje
   taki commit, zanim powstanie.
6. **Komentarze i nazwa testu znów obiecywały więcej niż kod** (blok 2, recenzent; powtórka
   punktu 4): „błąd oznacza ponowną próbę” i „wywołuje go backend”, choć backendu z ponowieniem
   jeszcze nie ma; test „zgodność z modelem” sprawdzał tylko `z.toJSONSchema`, a nie to, co SDK
   wysyła do API. → Komentarz opisuje kod w obecnym stanie, plany kolejnych bloków idą do
   `ROADMAP.md`. Nazwa testu mówi dokładnie to, co test sprawdza.
7. **Testy uruchomione z Git Bash dają fałszywą czerwień** (blok 2, recenzent): `npx vitest run`
   pada przed pierwszym testem (`Cannot read properties of undefined (reading 'config')`),
   a w PowerShell wszystko jest zielone. Sprawdzone na obu powłokach. → Komendy npm uruchamiać
   w PowerShell; recenzent dostaje tę regułę w poleceniu.
8. **Narzędzie zapisu wstawia niewidoczne znaki zamiast kodu** (blok 3): `\u00a0` napisane
   w Write/Edit trafiło do plików (test, `eslint.config.js`, README) jako dosłowna twarda
   spacja — wyłapał recenzent w teście, potem ESLint i kontrola w dwóch kolejnych plikach.
   `\x20` zostaje bez zmian, psuje się tylko `\uXXXX`. → `scripts/check-invisible.mjs`
   w `npm run check` (wszystkie pliki tekstowe) i ESLint `no-irregular-whitespace` także
   w napisach i komentarzach. Takie znaki w kodzie budować liczbami albo przez PowerShell
   (`[char]92 + 'u00a0'`) i sprawdzać bajty.
9. **Plan zawierał opcję biblioteki z pamięci** (blok 3): `isEvalSupported: false` dla pdf.js —
   w wersji 6 tej opcji już nie ma; złapał to `tsc`. → Opcje i nazwy z bibliotek sprawdzać
   w typach w `node_modules` (albo w skillu) przed wpisaniem do planu, nie z pamięci.
10. **Komentarz „nie rzuca wyjątków” był nieprawdziwy** (blok 3, recenzent; trzecia powtórka
    punktów 4 i 6): `readPdf` czytał nagłówek pliku poza `try`, a błąd czytania zostawiał
    interfejs na zawsze w „Odczytuję…”. → Każda obietnica w komentarzu ma test, który ją łamie
    na złym kodzie (tu: `readFailed` przy nieczytelnym pliku — sprawdzony na starym kodzie).
    Przed oddaniem bloku: przejść komentarze nowych plików i zapytać „który test to dowodzi?”.
11. **Commit mimo czerwonego Prettiera** (blok 3): komendy połączone `;` zrobiły commit, choć
    `prettier --check` zgłosił błąd — potrzebny był drugi commit. → Commit tylko za
    `if ($?) { … }` albo po zielonym `npm run check`.
12. **Założenie o SDK zamiast sprawdzenia** (blok 4, recenzent; powtórka punktu 9): agent
    przyjął, że `messages.parse` przy odmowie zwraca `parsed_output: null`, a przy niezgodnym
    JSON rzuca — więc odmowa w trakcie pisania i udany fallback kończyły się „złą odpowiedzią”.
    Ten sam błąd w teście: fałszywa odpowiedź „limit wydatków” miała zgadnięty kształt i SDK jej
    nie rozpoznało. → Zachowanie SDK czytać w `node_modules/@anthropic-ai/sdk` (kod, nie tylko
    typy) i każdy kształt odpowiedzi w testach brać stamtąd; testy na prawdziwym SDK
    z podstawionym `fetch` dla każdej gałęzi.
13. **Zgubiony powód błędu kontroli** (blok 4): `npm run deploy:api 2>$null` — `report.mjs`
    pisze `BŁĄD` na stderr, więc przyczyna oblanego testu dymnego zniknęła i dało się ją tylko
    odgadnąć. → Kontroli z `scripts/` nie uruchamiać z `2>$null`; filtrować wyjście
    `Select-String` bez odrzucania stderr.
14. **Komentarz znów obiecywał pełną ochronę** (blok 4, recenzent; czwarta powtórka punktów 4, 6
    i 10): „tekst nie wyjdzie z bloku `<dokument>`”, choć wzorzec łapał tylko dokładny znacznik.
    → Komentarz i README mówią, co kod robi („utrudnia”), a nie jaki ma być efekt; przy
    zabezpieczeniach wprost pisać, czego nie łapią.
15. **Test, który przechodzi w złym środowisku** (blok 5, recenzent; powtórka punktu 6): test
    „data bez przesunięcia o dzień” był zielony także bez `timeZone: "UTC"`, bo strefy agenta
    (UTC+2) i CI (UTC) błędu nie pokazują. → Vitest działa w strefie `America/Los_Angeles`
    (`vite.config.ts`); test sprawdzony mutacją.
16. **Sprawdzenie w przeglądarce na nieistniejącym trybie mocka** (blok 5): agent przełączył mock
    na tryb o złej nazwie, mock po cichu oddał zwykły wynik i jeden przypadek wyglądał na błąd
    aplikacji (drugi raz — „sprawdzony” przypadek, którego w mocku nie było). Oba razy wyszło
    przy analizie wyniku. → Przed sprawdzeniem stanu potwierdzić warunek wstępny (mock odpowiada
    oczekiwanym kodem), a wynik, który nie pasuje, wyjaśnić, zanim pójdzie do raportu.
