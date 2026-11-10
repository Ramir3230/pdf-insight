# AI_LOG — praca z AI

Narzędzia, kluczowe prompty, miejsca, w których AI się pomyliło, i to, jak je poprawiłem.
Prowadzony na bieżąco. Z agentem pracuję po rosyjsku, dlatego prompty podaję w oryginale
z tłumaczeniem na polski.

## Narzędzia

- **Claude Code** — kod, dokumenty, testy, CI. Praca blokami: plan, moja akceptacja, wykonanie,
  recenzja, wyjaśnienie, co powstało. Plan bloków powstał na modelu Claude Fable 5.2, od bloku 1
  pracuję na Claude Opus 5.5 (przełączyłem komendą `/model`).
- **Agent recenzent `code-reviewer`** — przegląd kodu na koniec bloków; sam niczego nie poprawia.
- **Claude API** (`claude-opus-5-5`) — w samej aplikacji: podsumowanie i dane JSON.

## Kluczowe prompty

Wybór 3–5 — na koniec pracy.

## Gdzie AI się pomyliło i jak to poprawiłem

Uzupełniane na bieżąco. Każdy błąd agenta ma też wpis w `.claude/gotchas.md` z regułą albo
kontrolą w kodzie, która go pilnuje.

- **Fałszywy alarm w kontroli sekretów** (blok 1). Wzorzec `\s*` uznał pusty
  `ANTHROPIC_API_KEY=` w `.env.example` za wypełniony, bo `\s` obejmuje znak nowej linii.
  Poprawka: `[ \t]` zamiast `\s`; każda kontrola jest sprawdzana na próbce, która musi ją oblać,
  i na takiej, która musi przejść.
- **Test dymny nie odróżniał adresu podglądu od produkcyjnego** (blok 1). Agent założył, że
  chroniony adres Vercel odpowie 401 na zapytanie CORS (OPTIONS), a Vercel odpowiada 204. Wyszło
  na próbce, która musiała oblać. Poprawka: logowanie sprawdzamy zapytaniem POST.
- **`vercel link` zmienił projekt bez pytania** (blok 1). Podłączył repozytorium GitHub wbrew
  planowi, pobrał token do `.env.local` i dopisał do `.gitignore` regułę, która unieważniała
  wyjątek dla `.env.example`. Agent to wyłapał przy obowiązkowym `git diff .gitignore`, odłączył
  integrację, cofnął `.gitignore`, usunął plik z tokenem. Teraz to sprawdza skrypt
  `deploy:api`.
- **Kontrole obiecywały więcej, niż sprawdzały** (blok 1, znalazł recenzent). Kontrola
  sekretów „całej historii” pomijała zmiany z commitów merge, wiadomości commitów, tagi, pliki
  w UTF-16 i indeks git; test dymny przyjmował starą wersję strony z CDN. Poprawione, każdy
  przypadek sprawdzony próbką z podrzuconym fałszywym kluczem albo starą wersją.
- **Schemat zmuszał model do zgadywania waluty** (blok 2, znalazł recenzent). W planie agenta
  `currency` była obowiązkowa, więc przy kwocie bez waluty model musiałby ją zgadnąć albo
  pominąć kwotę — wbrew zasadzie briefu „model nie zgaduje”. Poprawka: `currency` może być
  `null`.
- **Komentarze znów obiecywały więcej niż kod** (blok 2, znalazł recenzent; powtórka z bloku 1).
  Komentarz mówił o ponownej próbie i wywołaniu z backendu, których jeszcze nie ma, a test
  nazwany „zgodność z modelem” sprawdzał tylko konwersję do JSON Schema. Poprawka: komentarze
  opisują obecny kod, nazwa testu — dokładnie to, co sprawdza; prawdziwą zgodność z SDK
  sprawdzi test w bloku 4 (zapisane w `ROADMAP.md`).
- **Opcja biblioteki z pamięci** (blok 3). W planie agent wpisał `isEvalSupported: false` dla
  pdf.js jako zabezpieczenie; w pdf.js 6 tej opcji już nie ma. Złapał to `tsc`; agent sprawdził
  w kodzie biblioteki, że groźnej ścieżki (`eval`, `new Function`) już tam nie ma. Reguła: opcje
  bibliotek sprawdzać w typach w `node_modules`, nie z pamięci.
- **Niewidoczne znaki w plikach** (blok 3, pierwszy znalazł recenzent). Narzędzie zapisu agenta
  zamieniało zapis kodu twardej spacji (U+00A0) na sam znak — niewidoczny w edytorze. Trafiło
  to do testu, konfiguracji ESLint, README i nawet do wpisu w grabiach o tym błędzie. Poprawka:
  kontrola `check-invisible.mjs` w `npm run check` dla wszystkich plików tekstowych i reguła
  ESLint dla napisów i komentarzy; kontrola od razu złapała kolejny przypadek.
- **Komentarz „nie rzuca wyjątków” był nieprawdziwy** (blok 3, znalazł recenzent; trzecia
  powtórka tego samego typu błędu). Gdy pliku nie dało się przeczytać, interfejs zostawał na
  zawsze w stanie „Odczytuję…”. Poprawka i test, który na starym kodzie czerwienieje.

## Dziennik

### 10.11, ok. 22:00 — środowisko

Brief przeczytał Claude Code w sesji, w której prowadzę poszukiwanie pracy. Poprosiłem, żeby nie
budował aplikacji tam, tylko przygotował osobny projekt:

> «Хорошо. Но это же не тут надо делать ? Мы можем отсюда создать среду. Создать ветку и через нее
> создать среду. Роадмап. и тд. Я скину файлы. И потом я продолжу работу непосредсвтенно оттуда.»
>
> „Dobrze, ale przecież to nie tutaj trzeba robić? Stąd możemy przygotować środowisko: gałąź,
> roadmapę i tak dalej. Wrzucę pliki, a potem będę pracował już stamtąd.”

Agent wyciągnął z briefu wymagania i zadał cztery pytania z rekomendacjami. Moje decyzje:

- backend — Vercel Functions (znam Vercel i mam tam konto);
- AI — Claude API; agent polecał darmowe Gemini ze względu na „darmowe limity” z briefu;
- dokumenty repozytorium po polsku;
- publiczne repozytorium od pierwszego commita, żeby deploy na Pages sprawdzić od razu, a nie
  przed samym terminem.

Efekt: `BRIEF.md` (brief własnymi słowami), `ROADMAP.md`, `CLAUDE.md` (zasady dla agenta), ten
plik, repozytorium z ukrytym e-mailem GitHub w commitach.

### 10.11, ok. 22:20 — plan bloków 1–6

Nowa sesja w folderze projektu. Poprosiłem o plan i dołożyłem listę kontroli, które mają łapać
dyskwalifikację i standardy briefu kodem, a nie uwagą:

> «Покажи план блоков 1–6: что делаешь ты, что я. […] Добавь в план проверки, которые ловят
> дисквалификацию и стандарты брифа кодом, а не вниманием: […] поиск ключа (sk-ant-) в файлах,
> во всей истории git и в dist/ […] Тесты бэкенда без сети […] Один платный прогон на настоящем
> API […] Смоук после деплоя […] Файл граблей .claude/gotchas.md: ошибка агента → правило или
> проверка. […] Фронтенд ходит на основной адрес Vercel, не на превью (у превью Vercel вход по
> логину). […] перед мержем в main покажи мне все строки интерфейса одним списком.»
>
> „Pokaż plan bloków 1–6: co robisz ty, a co ja. […] Dodaj do planu kontrole, które wyłapują
> dyskwalifikację i standardy briefu kodem, a nie uwagą: […] szukanie klucza (sk-ant-) w plikach,
> w całej historii git i w dist/ […] testy backendu bez sieci […] jeden płatny przebieg na
> prawdziwym API […] test dymny po deployu […] plik grabi .claude/gotchas.md: błąd agenta →
> reguła albo kontrola. […] Frontend łączy się z głównym adresem Vercel, a nie z podglądem
> (podgląd Vercel wymaga logowania). […] przed merge'em do main pokaż mi wszystkie teksty
> interfejsu jedną listą.”

Agent rozłożył kontrole na bloki i zaproponował zmiany względem roadmapy: projekt Vercel już
w bloku 1 (deploy backendu to największe ryzyko nocy), `summary` od modelu jako lista zdań
sklejana na backendzie (structured outputs nie ograniczają długości), deploy backendu komendą
`vercel deploy --prod` bez integracji z GitHubem. Zaakceptowałem: «Хорошо поехали блок 1.» —
„Dobrze, jedziemy z blokiem 1.”

### 10.11, ok. 22:30 — blok 1: szkielet, CI, kontrole

Co powstało:

- szkielet Vite + React + TypeScript `strict`, `base: '/pdf-insight/'`, strona „w budowie”;
- ESLint z błędami dla `console`, `any`, `dangerouslySetInnerHTML` i dostępności (`jsx-a11y`),
  komentarze `eslint-disable` wyłączone; Prettier; Vitest;
- `npm run check` i trzy skrypty: `check-dist` (ścieżki pod `/pdf-insight/`), `check-secrets`
  (klucz w plikach, w całej historii git, w `dist/`), `check-readme-deps` (każda zależność
  opisana w README);
- backend-zaślepka na Vercel z prawdziwym CORS: przepuszcza tylko domenę demo;
- CI: `npm audit`, `npm run check`, deploy na Pages z `main`, test dymny `smoke.mjs`;
- `.claude/gotchas.md` — grabie agenta.

Każdą kontrolę agent uruchomił na próbce, która musi ją oblać: podrzucony fałszywy klucz w pliku,
w `dist/` i w commicie na tymczasowym klonie; zakazane konstrukcje w próbnych plikach dla
ESLint; chroniony adres Vercel dla testu dymnego. Dwie z tych próbek wykryły błędy w samych
kontrolach (opis w „Gdzie AI się pomyliło”).

Wersje: najnowsze TypeScript 7 i ESLint 10 nie współpracują jeszcze z `typescript-eslint`
i wtyczkami React, dlatego TypeScript 6.0 i ESLint 9 — powód zapisany w README.

Recenzent (`code-reviewer`) nie znalazł blokerów, ale wskazał 10 problemów, głównie w samych
kontrolach. Najważniejszy: fałszywy klucz w przyszłym teście backendu oblałby CI na zawsze,
bo historii nie da się wyczyścić bez force-pusha do `main`. Agent dodał hook pre-commit, który
zatrzymuje commit z kluczem, i regułę w `CLAUDE.md`. Poza tym: historia sprawdzana razem
z merge'ami, wiadomościami i tagami; test dymny czeka na wersję z właśnie zbudowanego commita
(`<meta name="build">`), ma limity czasu i sprawdza kod odpowiedzi; CI nie nadpisze nowszego
deployu starszym; backend wdraża `npm run deploy:api`, który odmawia przy niezatwierdzonych
zmianach. Kontrola workera pdf.js w `dist/` przeszła do bloku 3, gdzie pojawia się pdf.js.

### 11.11, ok. 00:00 — blok 2: schemat wyniku

> «Окей блок 2. Пиши план»
>
> „Dobrze, blok 2. Napisz plan.”

Przed planem agent sprawdził w rejestrze npm, z jaką wersją Zoda współpracuje pomocnik
`zodOutputFormat` z SDK Anthropic (Zod 3.25+ albo 4), a w dokumentacji Claude API — których
ograniczeń structured outputs nie egzekwują (długości list i tekstów). Plan z tabelą reguł pól
zaakceptowałem: «Поехали» — „Jedziemy.”

Co powstało:

- `src/lib/schema.ts` — dwa schematy Zod: odpowiedź modelu (podsumowanie jako lista 3–5 zdań, bez
  `fileName` i `pages`) i wynik końcowy według briefu; funkcja `toAnalysisResult`, która je
  łączy; `sourceFileSchema` dla danych pliku;
- `src/lib/schema.test.ts` — 45 testów: poprawne odpowiedzi, granice 3–5 zdań i 3–7 punktów,
  odrzucenie brakującego pola, złego typu, dat, walut, języka, pustego tekstu; kolejność kluczy
  w pobieranym JSON.

Każdy test odrzucenia sprawdza, które pole zostało odrzucone, a nie tylko sam fakt odrzucenia —
inaczej test „brak pola” mógłby przejść przez przypadkowy błąd w innym miejscu próbki. Testy
agent sprawdził na celowo popsutym schemacie: po usunięciu reguły czerwienieje dokładnie ten
test, który jej pilnuje.

Recenzent nie znalazł blokerów. Najważniejsze uwagi: obowiązkowa waluta zmuszała model do
zgadywania, a komentarze i nazwa jednego testu obiecywały więcej, niż sprawdza kod (opis
w „Gdzie AI się pomyliło”). Poza tym: tekst z samych spacji przechodził, dane pliku były opisane
dwa razy, test kolejności kluczy nie dowodził tego, co miał dowieść. Wszystko poprawione.
Recenzent zauważył też, że `npx vitest run` z Git Bash daje fałszywą czerwień — wpis
w `.claude/gotchas.md`.

### 11.11, ok. 00:30 — decyzja o pracy w nocy

> «Блок три давай план»
>
> „Blok trzeci, daj plan.”

Agent pokazał plan i uczciwie policzył czas: przy tym tempie wszystkie MUST na demo dopiero
około 04:00–05:00. Zapytałem:

> «та не до утра я не буду сидеть это уже того прям не стоит. или стоит ?»
>
> „Nie, do rana nie będę siedział, to już naprawdę nie ma sensu. Czy jednak ma?”

Agent zaproponował: ja robię teraz tylko to, czego nie może zrobić on (klucz API z limitem
wydatków wpisany do Vercel), a bloki 3–5 robi sam w nocy, z recenzentem po każdym bloku; merge
do `main` rano, ze mną. Zapytałem, co będzie, gdy zapełni mu się okno kontekstu:

> «А каким образом ты сделаешь ? у тебя в моменте контекстное окно схопнится и что ты будешь
> делать ?»
>
> „Jak to zrobisz? W pewnym momencie zapełni ci się okno kontekstu — i co wtedy?”

Odpowiedź: stan pracy trzymany w plikach, nie w pamięci — cele nocy i plan bloku zapisane
w `ROADMAP.md`, każdy krok to commit, decyzje i raporty po rosyjsku od razu w pliku poza gitem;
po każdej kompresji kontekstu agent czyta je od nowa. Przed startem sprawdził, czy ma wszystko:
uprawnienia, `git push`, `gh`, Vercel, przeglądarkę z lokalnym serwerem, ustawienia uśpienia
komputera. Zgoda z granicą:

> «Все хорошо начинай. Не чуди чтоб на компе моем ничего не случилось. Все в рамках этого
> проекта этой задачи. Окей ?»
>
> „Wszystko dobrze, zaczynaj. Nie kombinuj, żeby na moim komputerze nic się nie stało. Wszystko
> w ramach tego projektu i tego zadania. Okej?”

### 11.11, ok. 00:50 — blok 3: PDF w przeglądarce

Co powstało:

- `src/lib/pdfFile.ts` — sprawdzenie pliku: jeden, niepusty, do 10 MB, nagłówek `%PDF-` (PDF
  poznajemy po treści, nie po nazwie);
- `src/lib/pdfText.ts` — tekst i liczba stron przez pdf.js; skan (mniej niż 50 liter na
  stronę), hasło i uszkodzony plik jako kody błędów;
- `src/lib/readPdf.ts` — oba kroki razem, bez wyjątków; `src/lib/pdfWorker.ts` — worker pdf.js;
- `src/components/PdfDrop.tsx` i stany w `App.tsx`: przeciągnij-upuść, przycisk, „odczytuję”,
  wynik odczytu, błąd z możliwością ponownego wyboru;
- testy na małych plikach PDF budowanych w kodzie (`makeTestPdf.ts`), bez binarnych fikstur;
- `check-dist` i test dymny sprawdzają worker pdf.js; nowa kontrola niewidocznych znaków.

Sprawdzenie w przeglądarce (dev i build produkcyjny): umowa testowa — 12 stron, ok. 0,3–0,7 s;
skan, plik > 10 MB, nie-PDF, pusty plik, dwa pliki naraz, upuszczenie obok strefy, ostatni
wybrany plik wygrywa, fokus z klawiatury; szerokość 360 px w ramce `iframe`. Prawdziwego
przeciągania z Eksploratora agent nie sprawdzi — zostaje dla mnie.

Każdą nową kontrolę i test agent uruchomił na próbce, która musi oblać. Jedna z nich pokazała,
po co sprawdzać typ odpowiedzi: serwer podglądu na brakujący plik workera oddał stronę HTML
z kodem 200.

Recenzent: jeden bloker (interfejs zawieszał się, gdy pliku nie dało się przeczytać) i dziesięć
mniejszych uwag — skan z pieczątką tekstową przechodził jako tekst, testy, które nie dowodziły
swojej nazwy, kontrast ramki, opis przycisku dla czytnika ekranu, ponawianie w teście dymnym.
Wszystko poprawione, poprawki sprawdzone mutacjami kodu.
