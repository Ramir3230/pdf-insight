import { useEffect, useRef, type ReactNode } from "react";
import { formatAmount, formatDate, languageName } from "../lib/format";
import { messages } from "../lib/messages";
import type { AnalysisResult } from "../lib/schema";
import { JsonExport } from "./JsonExport";

type ResultViewProps = {
  result: AnalysisResult;
  // Czas od wgrania pliku do wyniku, w sekundach.
  seconds: number;
};

// Sekcja wyniku z nagłówkiem; pusta lista → „Brak w dokumencie” zamiast pustego miejsca.
function Section({
  title,
  isEmpty,
  children,
}: {
  title: string;
  isEmpty: boolean;
  children: ReactNode;
}) {
  return (
    <section className="result__section">
      <h3>{title}</h3>
      {isEmpty ? <p className="result__none">{messages.result.none}</p> : children}
    </section>
  );
}

export function ResultView({ result, seconds }: ResultViewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const doc = result.document;

  // Po pojawieniu się wyniku fokus przechodzi na jego nagłówek: czytnik ekranu go ogłosi,
  // a klawiatura zaczyna od wyniku, a nie od góry strony.
  useEffect(() => {
    headingRef.current?.focus();
  }, [result]);

  return (
    <article className="result">
      <h2 ref={headingRef} tabIndex={-1} className="result__title" lang={doc.language}>
        {doc.title ?? messages.result.untitled}
      </h2>
      <dl className="result__meta">
        <div>
          <dt>{messages.result.type}</dt>
          <dd>{messages.documentTypes[doc.type]}</dd>
        </div>
        <div>
          <dt>{messages.result.date}</dt>
          <dd>{doc.date ? formatDate(doc.date) : messages.result.none}</dd>
        </div>
        <div>
          <dt>{messages.result.language}</dt>
          <dd>{languageName(doc.language)}</dd>
        </div>
        <div>
          <dt>{messages.result.file}</dt>
          <dd className="result__file">
            {doc.fileName}, {messages.pagesLabel(doc.pages)}
          </dd>
        </div>
      </dl>
      <p className="result__elapsed">{messages.result.elapsed(seconds)}</p>

      {/* Treść jest w języku dokumentu: lang pozwala czytnikowi ekranu ją dobrze wymówić. */}
      <div lang={doc.language}>
        <Section title={messages.result.summary} isEmpty={false}>
          <p>{result.summary}</p>
        </Section>

        <Section title={messages.result.keyPoints} isEmpty={result.keyPoints.length === 0}>
          <ul>
            {result.keyPoints.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
        </Section>

        <Section title={messages.result.amounts} isEmpty={result.amounts.length === 0}>
          <ul className="result__pairs">
            {result.amounts.map((amount, index) => (
              <li key={index}>
                <span className="result__value">{formatAmount(amount.value, amount.currency)}</span>
                <span>{amount.context}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={messages.result.dates} isEmpty={result.dates.length === 0}>
          <ul className="result__pairs">
            {result.dates.map((entry, index) => (
              <li key={index}>
                <span className="result__value">
                  <time dateTime={entry.date}>{formatDate(entry.date)}</time>
                </span>
                <span>{entry.context}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title={messages.result.organizations}
          isEmpty={result.entities.organizations.length === 0}
        >
          <ul>
            {result.entities.organizations.map((name, index) => (
              <li key={index}>{name}</li>
            ))}
          </ul>
        </Section>

        <Section title={messages.result.people} isEmpty={result.entities.people.length === 0}>
          <ul>
            {result.entities.people.map((name, index) => (
              <li key={index}>{name}</li>
            ))}
          </ul>
        </Section>

        <Section title={messages.result.keywords} isEmpty={result.keywords.length === 0}>
          <ul className="result__tags">
            {result.keywords.map((keyword, index) => (
              <li key={index}>{keyword}</li>
            ))}
          </ul>
        </Section>
      </div>

      <JsonExport result={result} />
    </article>
  );
}
