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
