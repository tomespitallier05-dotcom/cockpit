import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { insight } from "../db/schema";
import type { Analysis } from "./analysis";
import { dropInsightVectors } from "./semantic";

export type Suggestion = {
  title?: string;
  summary?: string;
  type?: string;
  projectId?: string | null;
  contactIds?: string[];
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Stores an analysis of one entry as proposals, whoever produced it (the
 * in-app pipeline or Claude through the connector). Pending proposals from a
 * previous analysis are replaced; insights the owner already decided on stay,
 * and are never duplicated.
 */
export async function applyAnalysis(options: {
  workspaceId: string;
  entryId: string;
  entryProjectId: string | null;
  analysis: Analysis;
  projects: { id: string }[];
  contacts: { id: string; name: string }[];
  linkedContactIds: string[];
  via: "pipeline" | "claude";
}) {
  const { analysis } = options;
  const projectIds = new Set(options.projects.map((p) => p.id));
  const contactIds = new Set(options.contacts.map((c) => c.id));
  const suggestion: Suggestion = {
    title: analysis.title,
    summary: analysis.summary,
    type: analysis.suggestedType,
    projectId: analysis.suggestedProjectId && projectIds.has(analysis.suggestedProjectId) ? analysis.suggestedProjectId : null,
    contactIds: analysis.mentionedContactIds.filter((id) => contactIds.has(id)),
  };

  const linked = new Set(options.linkedContactIds);
  const resolveSpeaker = (speaker: string | null) => {
    if (!speaker) return null;
    const name = speaker.toLowerCase();
    const matches = options.contacts.filter(
      (c) => c.name.toLowerCase() === name || c.name.toLowerCase().split(" ")[0] === name.split(" ")[0],
    );
    return (matches.find((c) => linked.has(c.id)) ?? matches[0])?.id ?? null;
  };

  const existing = await db
    .select({ id: insight.id, type: insight.type, content: insight.content, status: insight.status })
    .from(insight)
    .where(eq(insight.sourceEntryId, options.entryId));
  const stale = existing.filter((i) => i.status === "proposed").map((i) => i.id);
  if (stale.length) {
    await db.delete(insight).where(inArray(insight.id, stale));
    await dropInsightVectors(stale);
  }
  const seen = new Set(existing.filter((i) => i.status !== "proposed").map((i) => `${i.type}:${normalize(i.content)}`));
  const fresh = analysis.insights.filter((item) => {
    const key = `${item.type}:${normalize(item.content)}`;
    if (seen.has(key) || item.confidence < 0.35 || !item.content.trim()) return false;
    seen.add(key);
    return true;
  });
  if (fresh.length) {
    await db.insert(insight).values(
      fresh.map((item) => ({
        workspaceId: options.workspaceId,
        projectId: options.entryProjectId ?? suggestion.projectId ?? null,
        sourceEntryId: options.entryId,
        contactId: resolveSpeaker(item.speaker),
        type: item.type,
        content: item.content.slice(0, 1000),
        quote: item.quote?.slice(0, 1000) ?? null,
        confidence: item.confidence,
        meta: {
          ...(item.type === "action" ? { dueDate: item.dueDate, priority: item.priority } : {}),
          via: options.via,
        },
      })),
    );
  }
  return { suggestion, inserted: fresh.length };
}
