"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { processEntry } from "../ai/pipeline";
import { dropInsightVectors } from "../ai/semantic";
import { assertOwnContacts, assertOwnProject, fail, ok, type ActionResult } from "../dal";
import { db } from "../db";
import { embedding, entry, entryContact, insight, task } from "../db/schema";
import { getActionUser } from "../session";

const id = z.uuid();
const statusSchema = z.enum(["proposed", "accepted", "applied", "dismissed"]);

async function ownedInsight(workspaceId: string, insightId: string) {
  const [row] = await db
    .select()
    .from(insight)
    .where(and(eq(insight.id, id.parse(insightId)), eq(insight.workspaceId, workspaceId)));
  if (!row) throw new Error("Élément introuvable.");
  return row;
}

export async function setInsightStatus(insightId: string, status: z.input<typeof statusSchema>): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    const row = await ownedInsight(me.workspaceId, insightId);
    const next = statusSchema.parse(status);
    await db
      .update(insight)
      .set({ status: next, appliedAt: next === "applied" ? new Date() : null })
      .where(eq(insight.id, row.id));
    if (next === "dismissed") await dropInsightVectors([row.id]);
    refresh();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

export async function updateInsightContent(insightId: string, content: string): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    const row = await ownedInsight(me.workspaceId, insightId);
    const text = z.string().trim().min(1).max(1000).parse(content);
    await db.update(insight).set({ content: text }).where(eq(insight.id, row.id));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

/** Turns a proposed action (or any insight) into a real task, keeping the link to its source. */
export async function insightToTask(insightId: string): Promise<ActionResult<{ taskId: string }>> {
  try {
    const me = await getActionUser();
    const row = await ownedInsight(me.workspaceId, insightId);
    const [existing] = await db
      .select({ id: task.id })
      .from(task)
      .where(and(eq(task.sourceInsightId, row.id), isNull(task.deletedAt)));
    if (existing) return ok({ taskId: existing.id });

    const meta = (row.meta ?? {}) as { dueDate?: string | null; priority?: string };
    const due = meta.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(meta.dueDate) ? new Date(`${meta.dueDate}T18:00:00`) : null;
    const priority = (["urgent", "high", "medium", "low", "none"] as const).find((p) => p === meta.priority) ?? "none";
    const [created] = await db
      .insert(task)
      .values({
        workspaceId: me.workspaceId,
        projectId: row.projectId,
        title: row.content.slice(0, 200),
        description: row.quote ? `« ${row.quote} »` : null,
        priority,
        dueAt: due,
        sourceEntryId: row.sourceEntryId,
        sourceInsightId: row.id,
        promisedToContactId: row.type === "action" ? null : row.contactId,
      })
      .returning({ id: task.id });
    await db.update(insight).set({ status: "accepted" }).where(eq(insight.id, row.id));
    refresh();
    return ok({ taskId: created.id });
  } catch (error) {
    return fail(error);
  }
}

/** Runs the whole pipeline now (the button on an entry), and waits for it. */
export async function analyzeEntryNow(entryId: string): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    const [row] = await db
      .select({ id: entry.id, isPrivate: entry.isPrivate })
      .from(entry)
      .where(and(eq(entry.id, id.parse(entryId)), eq(entry.workspaceId, me.workspaceId), isNull(entry.deletedAt)));
    if (!row) throw new Error("Entrée introuvable.");
    if (row.isPrivate) throw new Error("Cette entrée est privée : elle n'est jamais envoyée à l'IA.");
    await processEntry(me.workspaceId, row.id);
    refresh();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

const suggestionInput = z.object({
  title: z.string().trim().max(200).optional(),
  type: z.enum(["note", "call", "message", "link", "file", "journal"]).optional(),
  projectId: z.uuid().nullable().optional(),
  contactIds: z.array(z.uuid()).optional(),
});

/** Accepts some or all of the AI's triage suggestion for an entry. */
export async function applySuggestion(entryId: string, input: z.input<typeof suggestionInput>): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    const data = suggestionInput.parse(input);
    const [row] = await db
      .select({ id: entry.id })
      .from(entry)
      .where(and(eq(entry.id, id.parse(entryId)), eq(entry.workspaceId, me.workspaceId), isNull(entry.deletedAt)));
    if (!row) throw new Error("Entrée introuvable.");
    const projectId = data.projectId === undefined ? undefined : await assertOwnProject(me, data.projectId);
    await db
      .update(entry)
      .set({
        title: data.title || undefined,
        type: data.type,
        projectId,
        inboxStatus: projectId ? "processed" : undefined,
      })
      .where(eq(entry.id, row.id));
    if (data.contactIds?.length) {
      const contactIds = await assertOwnContacts(me, data.contactIds);
      await db
        .insert(entryContact)
        .values(contactIds.map((contactId) => ({ entryId: row.id, contactId, role: "mentioned" as const })))
        .onConflictDoNothing();
    }
    if (projectId) {
      await db.update(insight).set({ projectId }).where(and(eq(insight.sourceEntryId, row.id), isNull(insight.projectId)));
    }
    refresh();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

export async function setEntryPrivate(entryId: string, isPrivate: boolean): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    await db
      .update(entry)
      .set({ isPrivate })
      .where(and(eq(entry.id, id.parse(entryId)), eq(entry.workspaceId, me.workspaceId)));
    if (isPrivate) await db.delete(embedding).where(eq(embedding.entryId, entryId));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
