import "server-only";
import { and, cosineDistance, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { embedding, entry, insight } from "../db/schema";
import { EMBEDDING_MODEL, gatewayAvailable } from "./config";
import { embedTexts } from "./gateway";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

/** Splits on paragraph boundaries where possible, with a small overlap. */
export function chunkText(text: string) {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= CHUNK_SIZE) return clean ? [clean] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + CHUNK_SIZE);
    if (end < clean.length) {
      const breakAt = Math.max(clean.lastIndexOf("\n\n", end), clean.lastIndexOf(". ", end));
      if (breakAt > start + CHUNK_SIZE / 2) end = breakAt + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks.filter(Boolean);
}

async function replaceVectors(
  workspaceId: string,
  sourceType: "entry" | "insight",
  sourceId: string,
  entryId: string,
  chunks: string[],
) {
  const vectors = await embedTexts(workspaceId, chunks);
  await db.transaction(async (tx) => {
    await tx.delete(embedding).where(and(eq(embedding.sourceType, sourceType), eq(embedding.sourceId, sourceId)));
    if (chunks.length === 0) return;
    await tx.insert(embedding).values(
      chunks.map((content, chunkIndex) => ({
        workspaceId,
        sourceType,
        sourceId,
        entryId,
        chunkIndex,
        content,
        model: EMBEDDING_MODEL,
        vector: vectors[chunkIndex],
      })),
    );
  });
}

/** (Re)indexes an entry's text plus its accepted insights. Private entries are never sent out. */
export async function indexEntry(workspaceId: string, entryId: string, fullText: string, heading: string) {
  if (!gatewayAvailable()) return false;
  const chunks = chunkText(fullText).map((chunk) => `${heading}\n${chunk}`);
  await replaceVectors(workspaceId, "entry", entryId, entryId, chunks);

  const insights = await db
    .select({ id: insight.id, type: insight.type, content: insight.content })
    .from(insight)
    .where(and(eq(insight.sourceEntryId, entryId), inArray(insight.status, ["proposed", "accepted", "applied"])));
  for (const row of insights) {
    await replaceVectors(workspaceId, "insight", row.id, entryId, [`${heading}\n${row.content}`]);
  }
  return true;
}

export async function dropInsightVectors(insightIds: string[]) {
  if (insightIds.length === 0) return;
  await db.delete(embedding).where(and(eq(embedding.sourceType, "insight"), inArray(embedding.sourceId, insightIds)));
}

export type SemanticHit = { entryId: string; content: string; score: number; sourceType: "entry" | "insight" };

/** Nearest chunks to the query, best chunk per entry. */
export async function semanticSearch(workspaceId: string, query: string, limit = 8): Promise<SemanticHit[]> {
  if (!gatewayAvailable() || query.trim().length < 3) return [];
  const [vector] = await embedTexts(workspaceId, [query], "query");
  const distance = cosineDistance(embedding.vector, vector);
  const rows = await db
    .select({
      entryId: embedding.entryId,
      content: embedding.content,
      sourceType: embedding.sourceType,
      score: sql<number>`1 - (${distance})`,
    })
    .from(embedding)
    .innerJoin(entry, eq(entry.id, embedding.entryId))
    .where(and(eq(embedding.workspaceId, workspaceId), isNull(entry.deletedAt), eq(entry.isPrivate, false)))
    .orderBy(distance)
    .limit(limit * 4);

  const best = new Map<string, SemanticHit>();
  for (const row of rows) {
    const score = Number(row.score);
    if (score < 0.2) continue;
    const current = best.get(row.entryId);
    if (!current || current.score < score) best.set(row.entryId, { ...row, score });
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Pairs of semantically close insights of one type (e.g. repeated mistakes). */
export async function similarInsightGroups(workspaceId: string, type: string, threshold = 0.82) {
  const rows = await db
    .select({ id: embedding.sourceId, vector: embedding.vector })
    .from(embedding)
    .innerJoin(insight, eq(insight.id, embedding.sourceId))
    .where(and(eq(embedding.workspaceId, workspaceId), eq(embedding.sourceType, "insight"), eq(insight.type, type as never)));
  // Greedy single-link clustering: fine for the few hundred insights of one person.
  const groups: string[][] = [];
  const assigned = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    if (assigned.has(rows[i].id)) continue;
    const group = [rows[i].id];
    for (let j = i + 1; j < rows.length; j++) {
      if (assigned.has(rows[j].id)) continue;
      if (cosine(rows[i].vector, rows[j].vector) >= threshold) {
        group.push(rows[j].id);
        assigned.add(rows[j].id);
      }
    }
    if (group.length > 1) {
      assigned.add(rows[i].id);
      groups.push(group);
    }
  }
  return groups;
}

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
