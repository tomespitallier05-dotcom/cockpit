"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";
import { recordAttachment } from "../attachments";
import { auth } from "../auth";
import { fail, ok, type ActionResult } from "../dal";
import { db } from "../db";
import { contact, entry, entryContact } from "../db/schema";
import { downloadDriveFile, googleAccount, recentDriveFiles, upcomingEvents, type DriveFile } from "../google";
import { getActionUser } from "../session";
import { kindFor, newStorageKey, storeFile } from "../storage";

export async function listDriveFiles(search?: string): Promise<ActionResult<DriveFile[]>> {
  try {
    const me = await getActionUser();
    return ok(await recentDriveFiles(me.id, z.string().max(100).optional().parse(search)));
  } catch (error) {
    return fail(error);
  }
}

/** Copies a Drive file into Cockpit's private storage as a new Inbox entry, then analyses it. */
export async function importDriveFile(fileId: string): Promise<ActionResult<{ entryId: string }>> {
  try {
    const me = await getActionUser();
    const id = z.string().min(5).max(200).regex(/^[\w-]+$/).parse(fileId);
    const [existing] = await db
      .select({ id: entry.id })
      .from(entry)
      .where(and(eq(entry.workspaceId, me.workspaceId), isNull(entry.deletedAt), sql`${entry.meta}->>'driveFileId' = ${id}`));
    if (existing) return ok({ entryId: existing.id });

    const file = await downloadDriveFile(me.id, id);
    if (file.data.byteLength > 100 * 1024 * 1024) throw new Error("Fichier trop volumineux (100 Mo maximum).");
    const kind = kindFor(file.mimeType, file.name);
    const [created] = await db
      .insert(entry)
      .values({
        workspaceId: me.workspaceId,
        type: kind === "audio" || kind === "video" ? "call" : kind === "document" ? "note" : "file",
        title: file.name.replace(/\.[a-z0-9]{2,4}$/i, ""),
        occurredAt: file.createdTime,
        source: "drive",
        meta: { driveFileId: id, ai: { status: "pending" } },
        inboxStatus: "inbox",
      })
      .returning({ id: entry.id });
    const key = newStorageKey(me.workspaceId, file.name);
    await storeFile(key, file.data, file.mimeType);
    await recordAttachment(me, { storageKey: key, fileName: file.name, mimeType: file.mimeType, sizeBytes: file.data.byteLength }, created.id);
    refresh();
    return ok({ entryId: created.id });
  } catch (error) {
    return fail(error);
  }
}

/**
 * Turns an upcoming calendar event into a call entry (once), with participants
 * matched to contacts by email, ready for the brief and later the debrief.
 */
export async function prepareCallFromEvent(eventId: string): Promise<ActionResult<{ entryId: string }>> {
  try {
    const me = await getActionUser();
    const id = z.string().min(3).max(300).parse(eventId);
    const [existing] = await db
      .select({ id: entry.id })
      .from(entry)
      .where(and(eq(entry.workspaceId, me.workspaceId), isNull(entry.deletedAt), sql`${entry.meta}->>'calendarEventId' = ${id}`));
    if (existing) return ok({ entryId: existing.id });

    const event = (await upcomingEvents(me.id, 14)).find((item) => item.id === id);
    if (!event) throw new Error("Événement introuvable dans les 14 prochains jours.");
    const emails = event.attendees.map((a) => a.email);
    const people = emails.length
      ? await db
          .select({ id: contact.id })
          .from(contact)
          .where(and(eq(contact.workspaceId, me.workspaceId), isNull(contact.deletedAt), inArray(sql`lower(${contact.email})`, emails)))
      : [];
    const durationMinutes = event.end ? Math.round((event.end.getTime() - event.start.getTime()) / 60000) : undefined;
    const [created] = await db
      .insert(entry)
      .values({
        workspaceId: me.workspaceId,
        type: "call",
        title: event.title,
        occurredAt: event.start,
        source: "calendar",
        meta: { calendarEventId: id, meetLink: event.meetLink, durationMinutes, ai: { status: "pending" } },
        inboxStatus: "inbox",
      })
      .returning({ id: entry.id });
    if (people.length) {
      await db.insert(entryContact).values(people.map((p) => ({ entryId: created.id, contactId: p.id, role: "participant" as const })));
      await db
        .update(contact)
        .set({ nextInteractionAt: event.start })
        .where(inArray(contact.id, people.map((p) => p.id)));
    }
    refresh();
    return ok({ entryId: created.id });
  } catch (error) {
    return fail(error);
  }
}

export async function disconnectGoogle(): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    const linked = await googleAccount(me.id);
    if (linked) await auth.api.unlinkAccount({ body: { accountId: linked.id }, headers: await headers() });
    refresh();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
