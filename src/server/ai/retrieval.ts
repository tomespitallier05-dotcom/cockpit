import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { entry, project } from "../db/schema";
import { semanticSearch } from "./semantic";

export type Source = {
  n: number;
  entryId: string;
  title: string;
  date: string;
  projectName: string | null;
  excerpt: string;
};

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Hybrid retrieval for the assistant: French full-text and vector search, fused
 * by reciprocal rank. Private entries are excluded from both.
 */
export async function retrieve(workspaceId: string, query: string, limit = 8) {
  const terms = normalize(query)
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2)
    .slice(0, 8);
  const tsQuery = terms.map((term) => `${term}:*`).join(" | ");

  const [keyword, semantic] = await Promise.all([
    terms.length
      ? db
          .select({ id: entry.id })
          .from(entry)
          .where(
            and(
              eq(entry.workspaceId, workspaceId),
              isNull(entry.deletedAt),
              eq(entry.isPrivate, false),
              sql`${entry.search} @@ to_tsquery('french', ${tsQuery})`,
            ),
          )
          .orderBy(desc(sql`ts_rank(${entry.search}, to_tsquery('french', ${tsQuery}))`))
          .limit(limit)
      : Promise.resolve([] as { id: string }[]),
    semanticSearch(workspaceId, query, limit).catch(() => []),
  ]);

  const scores = new Map<string, number>();
  keyword.forEach((row, rank) => scores.set(row.id, (scores.get(row.id) ?? 0) + 1 / (60 + rank)));
  semantic.forEach((hit, rank) => scores.set(hit.entryId, (scores.get(hit.entryId) ?? 0) + 1 / (60 + rank)));
  const ids = [...scores.keys()].sort((a, b) => scores.get(b)! - scores.get(a)!).slice(0, limit);
  if (ids.length === 0) return [];

  const rows = await db
    .select({
      id: entry.id,
      title: entry.title,
      plainText: entry.plainText,
      occurredAt: entry.occurredAt,
      projectName: project.name,
    })
    .from(entry)
    .leftJoin(project, eq(project.id, entry.projectId))
    .where(and(eq(entry.workspaceId, workspaceId), inArray(entry.id, ids)));
  const byId = new Map(rows.map((row) => [row.id, row]));

  return ids
    .map((id) => {
      const row = byId.get(id);
      if (!row) return null;
      const chunk = semantic.find((hit) => hit.entryId === id)?.content.split("\n").slice(1).join("\n");
      return {
        entryId: id,
        title: row.title || row.plainText.split("\n").find((line) => line.trim())?.slice(0, 80) || "Sans titre",
        date: row.occurredAt.toISOString().slice(0, 10),
        projectName: row.projectName,
        excerpt: (chunk || row.plainText).slice(0, 1500),
      };
    })
    .filter((item): item is Omit<Source, "n"> => Boolean(item));
}

/** Keeps citation numbers stable across a whole answer (retrieval + tool calls). */
export class SourceRegistry {
  private items: Source[] = [];

  add(found: Omit<Source, "n">[]) {
    return found.map((item) => {
      const existing = this.items.find((source) => source.entryId === item.entryId);
      if (existing) return existing;
      const source = { ...item, n: this.items.length + 1 };
      this.items.push(source);
      return source;
    });
  }

  format(sources: Source[]) {
    if (sources.length === 0) return "Aucune source trouvée.";
    return sources
      .map(
        (source) =>
          `[${source.n}] ${source.title} — ${source.date}${source.projectName ? ` — projet ${source.projectName}` : ""}\n${source.excerpt}`,
      )
      .join("\n\n");
  }

  /** Only the sources the answer actually cites, in citation order. */
  cited(text: string) {
    const numbers = new Set([...text.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1])));
    return this.items.filter((source) => numbers.has(source.n));
  }
}
