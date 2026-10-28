import Link from "next/link";
import { Fragment, type ReactNode } from "react";

export type Citation = { n: number; entryId: string; title: string };

/**
 * A deliberately small Markdown subset for AI answers (paragraphs, lists,
 * headings, bold, inline code) rendered as React elements: no HTML is ever
 * injected. `[n]` becomes a link to the cited entry.
 */
export function Markdown({ text, citations = [] }: { text: string; citations?: Citation[] }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(
        <p key={`p${blocks.length}`} className="leading-relaxed">
          {inline(paragraph.join(" "), citations)}
        </p>,
      );
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((item, i) => <li key={i}>{inline(item, citations)}</li>);
      blocks.push(
        list.ordered ? (
          <ol key={`l${blocks.length}`} className="list-decimal space-y-1 pl-5">
            {items}
          </ol>
        ) : (
          <ul key={`l${blocks.length}`} className="list-disc space-y-1 pl-5 marker:text-subtle">
            {items}
          </ul>
        ),
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push(
        <p key={`h${blocks.length}`} className="pt-1 font-medium text-foreground">
          {inline(heading[1], citations)}
        </p>,
      );
    } else if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return <div className="space-y-2.5">{blocks}</div>;
}

function inline(text: string, citations: Citation[]): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\d+\](?:\[\d+\])*)/g);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-medium text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    const refs = [...part.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
    if (refs.length && part.replace(/\[\d+\]/g, "") === "") {
      return (
        <Fragment key={i}>
          {refs.map((n) => {
            const source = citations.find((c) => c.n === n);
            return source ? (
              <Link
                key={n}
                href={`/entrees/${source.entryId}`}
                title={source.title}
                className="mx-px inline-flex h-4 min-w-4 -translate-y-1 items-center justify-center rounded bg-primary/15 px-1 align-baseline text-[10px] font-medium text-primary hover:bg-primary/25"
              >
                {n}
              </Link>
            ) : (
              <sup key={n} className="text-subtle">
                [{n}]
              </sup>
            );
          })}
        </Fragment>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
