// @ts-check
// Deploy backendu na Vercel (produkcja) i test dymny API.
// - Odmawia przy niezatwierdzonych zmianach: `vercel deploy` wysyła pliki z dysku, a produkcja
//   ma odpowiadać commitowi w git.
// - Po deployu sprawdza, że komenda vercel niczego nie zmieniła w repozytorium (bywało, że
//   dopisywała reguły do .gitignore — patrz .claude/gotchas.md).
// Użycie: npm run deploy:api
import { execFileSync, spawnSync } from "node:child_process";
import { fail, pass } from "./lib/report.mjs";

function gitStatus() {
  return execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
}

function deploy() {
  if (gitStatus() !== "") {
    fail("niezatwierdzone zmiany w repozytorium — najpierw commit, potem deploy");
    return;
  }
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();

  // shell: true, bo na Windows `vercel` to skrypt .cmd/.ps1, a nie plik wykonywalny.
  const vercel = spawnSync("vercel deploy --prod --yes", { shell: true, stdio: "inherit" });
  if (vercel.status !== 0) {
    fail("vercel deploy zakończył się błędem");
    return;
  }

  const changed = gitStatus();
  if (changed !== "") {
    fail(`vercel zmienił pliki w repozytorium, sprawdź przed commitem:\n${changed}`);
    return;
  }
  pass(`backend z commita ${commit} wdrożony na produkcję`);

  const smoke = spawnSync(process.execPath, ["scripts/smoke.mjs", "--api-only"], {
    stdio: "inherit",
  });
  if (smoke.status !== 0) {
    fail("test dymny API po deployu nie przeszedł");
  }
}

deploy();
