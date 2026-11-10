# AI_LOG — praca z AI

Narzędzia, kluczowe prompty, miejsca, w których AI się pomyliło, i to, jak je poprawiłem.
Prowadzony na bieżąco. Z agentem pracuję po rosyjsku, dlatego prompty podaję w oryginale
z tłumaczeniem na polski.

## Narzędzia

- **Claude Code** (model Claude Opus 5.5) — kod, dokumenty, testy, CI. Praca blokami: plan,
  moja akceptacja, wykonanie, recenzja, wyjaśnienie, co powstało.
- **Agent recenzent `code-reviewer`** — przegląd kodu na koniec bloków; sam niczego nie poprawia.
- **Claude API** (`claude-opus-5-5`) — w samej aplikacji: podsumowanie i dane JSON.

## Kluczowe prompty

Wybór 3–5 — na koniec pracy.

## Gdzie AI się pomyliło i jak to poprawiłem

Uzupełniane na bieżąco.

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
