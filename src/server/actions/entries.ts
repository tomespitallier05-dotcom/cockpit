"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { CAPTURE_TYPES, MESSAGE_CHANNELS, textToDoc, type MessageChannel } from "@/lib/entry-catalog";
import { assertOwnContacts, assertOwnProject, fail, ok, type ActionResult } from "../dal";
import { db } from "../db";
import { entry, entryContact } from "../db/schema";
import { getActionUser } from "../session";

const entryId = z.uuid();

const metaSchema = z
  .object({
    durationMinutes: z.number().int().min(0).max(24 * 60).optional(),
    channel: z.enum(Object.keys(MESSAGE_CHANNELS) as [MessageChannel, ...MessageChannel[]]).optional(),
    url: z.union([z.url(), z.literal("")]).optional(),
  })
  .partial();

const createInput = z.object({
  type: z.enum(CAPTURE_TYPES).default("note"),
  title: z.string().trim().max(200).default(""),
  body: z.string().max(100_000).default(""),
  projectId: z.uuid().nullable().optional(),
  occurredAt: z.coerce.date().optional(),
  meta: metaSchema.default({}),
});

function message(error: unknown) {
  return error instanceof z.ZodError ? new Error(error.issues[0]?.message ?? "Données invalides.") : error;
}

/**
 * Quick capture and "new entry" both land here. Without a project the entry
 * waits in the inbox; with one it is already filed.
 */
export async function createEntry(input: z.input<typeof createInput>): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await getActionUser();
    const data = createInput.parse(input);
    const projectId = await assertOwnProject(me, data.projectId);
    const title = data.title || null;
    const [created] = await db
      .insert(entry)
      .values({
        workspaceId: me.workspaceId,
        projectId,
        type: data.type,
        title,
        content: data.body ? textToDoc(data.body) : null,
        plainText: data.body,
        occurredAt: data.occurredAt ?? new Date(),
        meta: data.meta,
        inboxStatus: projectId ? "processed" : "inbox",
      })
      .returning({ id: entry.id });
    refresh();
    return ok({ id: created.id });
  } catch (error) {
    return fail(message(error));
  }
}

const updateInput = z.object({
  type: z.enum(CAPTURE_TYPES).optional(),
  title: z.string().trim().max(200).optional(),
  content: z.record(z.string(), z.unknown()).nullable().optional(),
  plainText: z.string().max(200_000).optional(),
  projectId: z.uuid().nullable().optional(),
  occurredAt: z.coerce.date().optional(),
  meta: metaSchema.optional(),
  pinned: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  inboxStatus: z.enum(["inbox", "processed"]).optional(),
});

/** Autosave target for the editor: only the provided fields change. */
export async function updateEntry(id: string, input: z.input<typeof updateInput>): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    const data = updateInput.parse(input);
    const projectId = data.projectId === undefined ? undefined : await assertOwnProject(me, data.projectId);
    await db
      .update(entry)
      .set({
        ...data,
        title: data.title === undefined ? undefined : data.title || null,
        projectId,
      })
      .where(and(eq(entry.id, entryId.parse(id)), eq(entry.workspaceId, me.workspaceId), isNull(entry.deletedAt)));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(message(error));
  }
}

/** Inbox triage: optionally file into a project, then mark as processed. */
export async function triageEntry(id: string, projectId?: string | null): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    const owned = projectId === undefined ? undefined : await assertOwnProject(me, projectId);
    await db
      .update(entry)
      .set({ inboxStatus: "processed", projectId: owned })
      .where(and(eq(entry.id, entryId.parse(id)), eq(entry.workspaceId, me.workspaceId)));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(message(error));
  }
}

export async function deleteEntry(id: string): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    await db
      .update(entry)
      .set({ deletedAt: new Date() })
      .where(and(eq(entry.id, entryId.parse(id)), eq(entry.workspaceId, me.workspaceId)));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(message(error));
  }
}

export async function restoreEntry(id: string): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    await db
      .update(entry)
      .set({ deletedAt: null })
      .where(and(eq(entry.id, entryId.parse(id)), eq(entry.workspaceId, me.workspaceId)));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(message(error));
  }
}

/** Replaces the people linked to an entry (participants of a call, author of a message…). */
export async function setEntryContacts(
  id: string,
  contactIds: string[],
  role: "author" | "participant" | "mentioned" = "participant",
): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    const [owned] = await db
      .select({ id: entry.id })
      .from(entry)
      .where(and(eq(entry.id, entryId.parse(id)), eq(entry.workspaceId, me.workspaceId)));
    if (!owned) throw new Error("Entrée introuvable.");
    const ids = await assertOwnContacts(me, z.array(z.uuid()).parse(contactIds));
    await db.transaction(async (tx) => {
      await tx.delete(entryContact).where(eq(entryContact.entryId, id));
      if (ids.length) await tx.insert(entryContact).values(ids.map((contactId) => ({ entryId: id, contactId, role })));
    });
    refresh();
    return ok(null);
  } catch (error) {
    return fail(message(error));
  }
}
