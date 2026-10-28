import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { after } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { textToDoc } from "@/lib/entry-catalog";
import { db } from "../db";
import { attachment, contact, entry, entryContact, insight, project } from "../db/schema";
import { readStoredFile } from "../storage";
import { analyzeEntry, readImage } from "./analysis";
import { claudeAvailable, gatewayAvailable } from "./config";
import { transcribeAudio } from "./gateway";
import { dropInsightVectors, indexEntry } from "./semantic";

/**
 * The processing pipeline behind every capture:
 *   1. extraction — audio/video → transcript, image → text, PDF → text;
 *   2. understanding — insights, proposed tasks, triage suggestions (Claude);
 *   3. indexing — chunks + vectors for semantic search.
 * Results are proposals: nothing is applied until the user accepts it.
 * Private entries never leave the server: only local text extraction runs.
 */
export type AiState = {
  status: "pending" | "processing" | "done" | "failed" | "skipped";
  processedAt?: string;
  error?: string;
  /** The text changed since the last analysis. */
  stale?: boolean;
  suggestion?: {
    title?: string;
    summary?: string;
    type?: string;
    projectId?: string | null;
    contactIds?: string[];
  };
};

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;

/** Runs the pipeline after the response is sent. */
export function scheduleProcessing(workspaceId: string, entryId: string) {
  after(() => processEntry(workspaceId, entryId).catch((error) => console.error("processEntry", entryId, error)));
}

async function readAll(storageKey: string) {
  const file = await readStoredFile(storageKey);
  if (!file) throw new Error("Fichier introuvable dans le stockage.");
  const data = new Uint8Array(await new Response(file.body).arrayBuffer());
  if (data.byteLength > MAX_FILE_BYTES) throw new Error("Fichier trop volumineux pour l'analyse.");
  return data;
}

function formatTimestamp(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}

async function setAiState(entryId: string, meta: Record<string, unknown>, state: AiState) {
  await db
    .update(entry)
    .set({ meta: { ...meta, ai: state } })
    .where(eq(entry.id, entryId));
}

type AttachmentRow = typeof attachment.$inferSelect;

async function extractAttachment(workspaceId: string, row: AttachmentRow, allowAi: boolean) {
  const data = await readAll(row.storageKey);
  const textLike = /^text\//.test(row.mimeType) || /\.(txt|md|csv)$/i.test(row.fileName);
  if (textLike) return { text: new TextDecoder().decode(data).slice(0, MAX_TEXT_CHARS) };
  if (row.kind === "pdf") {
    const pdf = await getDocumentProxy(data);
    const { text } = await extractText(pdf, { mergePages: true });
    return { text: (Array.isArray(text) ? text.join("\n") : text).slice(0, MAX_TEXT_CHARS) };
  }
  if (!allowAi) return { text: null };
  if ((row.kind === "audio" || row.kind === "video") && gatewayAvailable()) {
    const transcript = await transcribeAudio(workspaceId, data);
    const lines = transcript.segments.length > 1
      ? transcript.segments.map((segment) => `[${formatTimestamp(segment.start)}] ${segment.text.trim()}`).join("\n")
      : transcript.text;
    return { text: lines.slice(0, MAX_TEXT_CHARS), durationSec: transcript.durationSec };
  }
  if (row.kind === "image" && claudeAvailable()) {
    const reading = await readImage(workspaceId, data, row.mimeType);
    if (!reading) return { text: null };
    return {
      text: [reading.description, reading.transcript].filter(Boolean).join("\n\n"),
      screenshot: reading,
    };
  }
  return { text: null };
}

export async function processEntry(workspaceId: string, entryId: string, options: { force?: boolean } = {}) {
  const [row] = await db
    .select()
    .from(entry)
    .where(and(eq(entry.id, entryId), eq(entry.workspaceId, workspaceId), isNull(entry.deletedAt)));
  if (!row) return;
  const meta = { ...(row.meta ?? {}) } as Record<string, unknown>;
  const allowAi = !row.isPrivate;
  await setAiState(entryId, meta, { ...(meta.ai as AiState | undefined), status: "processing" });

  try {
    // 1. Extraction
    const files = await db
      .select()
      .from(attachment)
      .where(eq(attachment.entryId, entryId))
      .orderBy(asc(attachment.createdAt));
    let screenshotChannel: string | null = null;
    for (const file of files) {
      if (file.processingStatus === "done" && !options.force) continue;
      await db.update(attachment).set({ processingStatus: "processing" }).where(eq(attachment.id, file.id));
      try {
        const result = await extractAttachment(workspaceId, file, allowAi);
        file.extractedText = result.text;
        if ("screenshot" in result && result.screenshot?.kind === "conversation") {
          screenshotChannel = result.screenshot.channel;
        }
        if ("durationSec" in result && result.durationSec && row.type === "call" && !meta.durationMinutes) {
          meta.durationMinutes = Math.max(1, Math.round(result.durationSec / 60));
        }
        await db
          .update(attachment)
          .set({ extractedText: result.text, processingStatus: "done" })
          .where(eq(attachment.id, file.id));
      } catch (error) {
        console.error("attachment extraction", file.id, error);
        await db.update(attachment).set({ processingStatus: "failed" }).where(eq(attachment.id, file.id));
      }
    }

    // An entry captured as a bare file takes its transcript as body, so it is searchable and editable.
    const extracted = files.map((file) => file.extractedText).filter((text): text is string => Boolean(text));
    let body = row.plainText;
    if (!body.trim() && extracted.length > 0) {
      body = extracted.join("\n\n");
      await db.update(entry).set({ plainText: body, content: textToDoc(body) }).where(eq(entry.id, entryId));
    }
    if (screenshotChannel && row.type === "message" && !meta.channel) meta.channel = screenshotChannel;

    const fullText = [body, ...extracted.filter((text) => text !== body)].join("\n\n").trim();
    if (!allowAi || fullText.length < 20) {
      await setAiState(entryId, meta, { status: allowAi ? "done" : "skipped", processedAt: new Date().toISOString() });
      return;
    }

    // 2. Understanding
    let suggestion: AiState["suggestion"];
    if (claudeAvailable()) {
      const [projects, contacts, linked] = await Promise.all([
        db
          .select({ id: project.id, name: project.name, detail: project.description })
          .from(project)
          .where(and(eq(project.workspaceId, workspaceId), isNull(project.deletedAt), inArray(project.status, ["active", "paused"]))),
        db
          .select({ id: contact.id, name: contact.name, detail: contact.relationship })
          .from(contact)
          .where(and(eq(contact.workspaceId, workspaceId), isNull(contact.deletedAt))),
        db.select({ contactId: entryContact.contactId }).from(entryContact).where(eq(entryContact.entryId, entryId)),
      ]);
      const analysis = await analyzeEntry({
        workspaceId,
        type: row.type,
        title: row.title,
        occurredAt: row.occurredAt,
        text: fullText.slice(0, 150_000),
        projects,
        contacts,
      });
      const projectIds = new Set(projects.map((p) => p.id));
      const contactIds = new Set(contacts.map((c) => c.id));
      suggestion = {
        title: analysis.title,
        summary: analysis.summary,
        type: analysis.suggestedType,
        projectId: analysis.suggestedProjectId && projectIds.has(analysis.suggestedProjectId) ? analysis.suggestedProjectId : null,
        contactIds: analysis.mentionedContactIds.filter((id) => contactIds.has(id)),
      };

      const linkedIds = new Set(linked.map((l) => l.contactId));
      const resolveSpeaker = (speaker: string | null) => {
        if (!speaker) return null;
        const name = speaker.toLowerCase();
        const matches = contacts.filter(
          (c) => c.name.toLowerCase() === name || c.name.toLowerCase().split(" ")[0] === name.split(" ")[0],
        );
        return (matches.find((c) => linkedIds.has(c.id)) ?? matches[0])?.id ?? null;
      };

      // Re-analysis replaces pending proposals; decisions already taken stay.
      const existing = await db
        .select({ id: insight.id, type: insight.type, content: insight.content, status: insight.status })
        .from(insight)
        .where(eq(insight.sourceEntryId, entryId));
      const stale = existing.filter((i) => i.status === "proposed").map((i) => i.id);
      if (stale.length) {
        await db.delete(insight).where(inArray(insight.id, stale));
        await dropInsightVectors(stale);
      }
      const seen = new Set(existing.filter((i) => i.status !== "proposed").map((i) => `${i.type}:${normalize(i.content)}`));
      const fresh = analysis.insights.filter((item) => {
        const key = `${item.type}:${normalize(item.content)}`;
        if (seen.has(key) || item.confidence < 0.35) return false;
        seen.add(key);
        return true;
      });
      if (fresh.length) {
        await db.insert(insight).values(
          fresh.map((item) => ({
            workspaceId,
            projectId: row.projectId ?? suggestion?.projectId ?? null,
            sourceEntryId: entryId,
            contactId: resolveSpeaker(item.speaker),
            type: item.type,
            content: item.content.slice(0, 1000),
            quote: item.quote?.slice(0, 1000) ?? null,
            confidence: item.confidence,
            meta: item.type === "action" ? { dueDate: item.dueDate, priority: item.priority } : {},
          })),
        );
      }
    }

    // 3. Indexing
    const heading = `${row.title || suggestion?.title || "Entrée"} — ${row.occurredAt.toISOString().slice(0, 10)}`;
    await indexEntry(workspaceId, entryId, fullText, heading);

    await setAiState(entryId, meta, { status: "done", processedAt: new Date().toISOString(), suggestion });
  } catch (error) {
    console.error("processEntry", entryId, error);
    await setAiState(entryId, meta, {
      ...(meta.ai as AiState | undefined),
      status: "failed",
      error: error instanceof Error ? error.message.slice(0, 300) : "Analyse impossible.",
    });
  }
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Entries whose text changed since their last analysis, oldest first (for the daily job). */
export async function staleEntries(workspaceId: string, limit = 20) {
  const rows = await db
    .select({ id: entry.id, meta: entry.meta })
    .from(entry)
    .where(and(eq(entry.workspaceId, workspaceId), isNull(entry.deletedAt), eq(entry.isPrivate, false)))
    .orderBy(asc(entry.updatedAt));
  return rows
    .filter((r) => {
      const ai = (r.meta as { ai?: AiState }).ai;
      return !ai || ai.stale || ai.status === "pending" || ai.status === "failed";
    })
    .slice(0, limit)
    .map((r) => r.id);
}
