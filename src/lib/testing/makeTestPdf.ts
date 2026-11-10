// Tylko dla testów: buduje mały, poprawny plik PDF bez zewnętrznych bibliotek i bez binarnych
// fikstur w repozytorium. Każda strona to lista linii tekstu (czcionka Helvetica) albo null —
// strona z samym czarnym prostokątem, bez warstwy tekstowej, jak skan.
// Tekst tylko ASCII: wtedy długość napisu to liczba bajtów, a od niej zależą adresy w tabeli xref.

export type TestPage = readonly string[] | null;

// W PDF nawiasy i backslash w tekście (...) trzeba poprzedzić backslashem.
function escapePdfText(text: string): string {
  return text.replace(/[\\()]/g, (char) => `\\${char}`);
}

function contentStream(page: TestPage): string {
  if (page === null) {
    return "0 0 0 rg 72 72 200 200 re f";
  }
  // BT…ET — blok tekstu; TL — odstęp między liniami; T* — przejście do nowej linii.
  const lines = page.map((line) => `(${escapePdfText(line)}) Tj`).join(" T* ");
  return `BT /F1 12 Tf 14 TL 72 720 Td ${lines} ET`;
}

// Obiekty: 1 — katalog, 2 — lista stron, 3 — czcionka, potem para (strona, treść) na stronę.
function pageObjectId(index: number): number {
  return 4 + index * 2;
}

export function makeTestPdf(pages: readonly TestPage[]): Uint8Array<ArrayBuffer> {
  const objects: string[] = [];
  const kids = pages.map((_, index) => `${pageObjectId(index)} 0 R`).join(" ");

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((page, index) => {
    const pageId = pageObjectId(index);
    const stream = contentStream(page);
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets.push(pdf.length);
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  // Tabela xref: położenie każdego obiektu w bajtach; wpisy mają dokładnie 20 bajtów.
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}
