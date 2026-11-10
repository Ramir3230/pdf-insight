// @ts-check
// Sprawdza zbudowany frontend pod kątem pułapek GitHub Pages: każdy lokalny adres w index.html
// zaczyna się od /pdf-insight/ i wskazuje na plik, który naprawdę jest w dist/.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fail, pass } from "./lib/report.mjs";

const BASE = "/pdf-insight/";
const DIST = "dist";
const indexPath = join(DIST, "index.html");

function checkIndexHtml() {
  if (!existsSync(indexPath)) {
    fail(`brak ${indexPath} (najpierw npm run build)`);
    return;
  }
  const html = readFileSync(indexPath, "utf8");
  const urls = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((match) => match[1] ?? "");
  const local = urls.filter((url) => !/^(https?:|data:|mailto:|#)/.test(url));

  if (!/<script[^>]+type="module"[^>]+src="/.test(html)) {
    fail(`${indexPath}: brak skryptu aplikacji`);
  }

  let problems = 0;
  for (const url of local) {
    if (!url.startsWith(BASE)) {
      fail(`${indexPath}: adres ${url} nie zaczyna się od ${BASE}`);
      problems++;
    } else if (!existsSync(join(DIST, url.slice(BASE.length)))) {
      fail(`${indexPath}: adres ${url} wskazuje na plik, którego nie ma w ${DIST}/`);
      problems++;
    }
  }
  if (problems === 0) {
    pass(`${indexPath}: ${local.length} lokalnych adresów pod ${BASE}, wszystkie pliki na miejscu`);
  }
}

checkIndexHtml();
