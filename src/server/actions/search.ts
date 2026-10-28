"use server";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { semanticSearch, type SemanticHit } from "../ai/semantic";
import { db } from "../db";
import { contact, entry, project, task } from "../db/schema";
import { getActionUser } from "../session";

export type SearchResults = {
  entries: {
    id: string;
    type: string;
    title: string | null;
    snippet: string;
    projectName: string | null;
    occurredAt: Date;
    /** Found by meaning rather than by its words. */
    semantic?: boolean;
  }[];
  tasks: { id: string; title: string; status: string; projectName: string | null }[];
  contacts: { id: string; name: string; role: string | null }[];
  projects: { id: string; name: string; slug: string; icon: string; color: string }[];
};

const EMPTY: SearchResults = { entries: [], tasks: [], contacts: [], projects: [] };

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Excerpt around the first matching word, so results show why they matched. */
function snippet(text: string, terms: string[]) {
  const flat = text.replace(/\s+/g, " ").trim();
  const haystack = normalize(flat);
  const hit = terms.map((term) => haystack.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, hit - 40);
  const excerpt = flat.slice(start, start + 140);
  return `${start > 0 ? "…" : ""}${excerpt}${start + 140 < flat.length ? "…" : ""}`;
}

/**
 * Instant search across entries, tasks, contacts and projects. Entries and tasks use
 * the French full-text index (stemmed, accent-insensitive, prefix on each word);
 * the small tables use a plain accent-insensitive substring match.
 */
export async function searchEverything(query: string): Promise<SearchResults> {
  const me = await getActionUser();
  const normalized = normalize(query).slice(0, 120);
  const terms = normalized.split(/[^a-z0-9]+/).filter((term) => term.length > 0).slice(0, 8);
  if (terms.length === 0 || normalized.trim().length < 2) return EMPTY;

  const tsQuery = terms.map((term) => `${term}:*`).join(" & ");
  const matches = (column: typeof entry.search | typeof task.search) =>
    sql`${column} @@ to_tsquery('french', ${tsQuery})`;
  const rank = (column: typeof entry.search | typeof task.search) =>
    sql`ts_rank(${column}, to_tsquery('french', ${tsQuery}))`;
  const like = `%${terms.join(" ")}%`;

  const [entries, tasks, contacts, projects, semantic] = await Promise.all([
    db
      .select({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        plainText: entry.plainText,
        projectName: project.name,
        occurredAt: entry.occurredAt,
      })
      .from(entry)
      .leftJoin(project, eq(entry.projectId, project.id))
      .where(and(eq(entry.workspaceId, me.workspaceId), isNull(entry.deletedAt), matches(entry.search)))
      .orderBy(desc(rank(entry.search)), desc(entry.occurredAt))
      .limit(6),
    db
      .select({ id: task.id, title: task.title, status: task.status, projectName: project.name })
      .from(task)
      .leftJoin(project, eq(task.projectId, project.id))
      .where(and(eq(task.workspaceId, me.workspaceId), isNull(task.deletedAt), matches(task.search)))
      .orderBy(desc(rank(task.search)))
      .limit(5),
    db
      .select({ id: contact.id, name: contact.name, role: contact.role })
      .from(contact)
      .where(
        and(
          eq(contact.workspaceId, me.workspaceId),
          isNull(contact.deletedAt),
          sql`public.cockpit_unaccent(${contact.name} || ' ' || coalesce(${contact.role}, '') || ' ' || coalesce(${contact.company}, '')) like ${like}`,
        ),
      )
      .limit(5),
    db
      .select({ id: project.id, name: project.name, slug: project.slug, icon: project.icon, color: project.color })
      .from(project)
      .where(
        and(
          eq(project.workspaceId, me.workspaceId),
          isNull(project.deletedAt),
          sql`public.cockpit_unaccent(${project.name} || ' ' || coalesce(${project.description}, '')) like ${like}`,
        ),
      )
      .limit(5),
    normalized.trim().length >= 4
      ? semanticSearch(me.workspaceId, query, 6).catch((error) => {
          console.error("semanticSearch", error);
          return [] as SemanticHit[];
        })
      : Promise.resolve([] as SemanticHit[]),
  ]);

  return {
    entries: await mergeHybrid(
      me.workspaceId,
      entries.map(({ plainText, ...rest }) => ({ ...rest, snippet: snippet(plainText, terms) })),
      semantic,
    ),
    tasks,
    contacts,
    projects,
  };
}

type EntryResult = SearchResults["entries"][number];

/**
 * Reciprocal rank fusion of the keyword and meaning rankings: an entry found by
 * both rises to the top, and one found only by meaning still shows up.
 */
async function mergeHybrid(workspaceId: string, keyword: EntryResult[], semantic: SemanticHit[]) {
  if (semantic.length === 0) return keyword;
  const scores = new Map<string, number>();
  keyword.forEach((item, rank) => scores.set(item.id, (scores.get(item.id) ?? 0) + 1 / (60 + rank)));
  semantic.forEach((hit, rank) => scores.set(hit.entryId, (scores.get(hit.entryId) ?? 0) + 1 / (60 + rank)));

  const known = new Map(keyword.map((item) => [item.id, item]));
  const missing = semantic.filter((hit) => !known.has(hit.entryId)).map((hit) => hit.entryId);
  if (missing.length) {
    const rows = await db
      .select({ id: entry.id, type: entry.type, title: entry.title, projectName: project.name, occurredAt: entry.occurredAt })
      .from(entry)
      .leftJoin(project, eq(entry.projectId, project.id))
      .where(and(eq(entry.workspaceId, workspaceId), isNull(entry.deletedAt), inArray(entry.id, missing)));
    for (const row of rows) {
      const hit = semantic.find((item) => item.entryId === row.id)!;
      const body = hit.content.split("\n").slice(1).join(" ").replace(/\s+/g, " ").trim();
      known.set(row.id, { ...row, snippet: body.length > 140 ? `${body.slice(0, 140)}…` : body, semantic: true });
    }
  }
  return [...known.values()]
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
    .slice(0, 8);
}
