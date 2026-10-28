import "server-only";
import { timingSafeEqual } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { textToDoc } from "@/lib/entry-catalog";
import { scheduleProcessing } from "./ai/pipeline";
import { recordAttachment } from "./attachments";
import { db } from "./db";
import { contact, entry, entryContact, user, workspace } from "./db/schema";
import type { CurrentUser } from "./session";
import { newStorageKey, storeFile } from "./storage";

/**
 * Captures that arrive without a browser session (Discord bot, inbound email,
 * share target): they belong to the single owner and land in the Inbox.
 */
export async function ownerContext(): Promise<CurrentUser | null> {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      twoFactorEnabled: user.twoFactorEnabled,
      workspaceId: workspace.id,
      timezone: workspace.timezone,
    })
    .from(workspace)
    .innerJoin(user, eq(user.id, workspace.ownerId))
    .orderBy(asc(workspace.createdAt))
    .limit(1);
  return row ? { ...row, image: row.image ?? null, twoFactorEnabled: Boolean(row.twoFactorEnabled) } : null;
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function alreadyCaptured(workspaceId: string, key: string, value: string) {
  const [row] = await db
    .select({ id: entry.id })
    .from(entry)
    .where(and(eq(entry.workspaceId, workspaceId), isNull(entry.deletedAt), sql`${entry.meta}->>${key} = ${value}`));
  return row?.id ?? null;
}

export async function captureEntry(
  me: CurrentUser,
  input: {
    type: "note" | "message" | "link" | "file";
    title: string | null;
    body: string;
    source: "email" | "discord" | "share";
    occurredAt?: Date;
    meta?: Record<string, unknown>;
    contactEmail?: string | null;
    files?: { name: string; mimeType: string; data: Uint8Array }[];
  },
) {
  const body = input.body.slice(0, 100_000);
  const [created] = await db
    .insert(entry)
    .values({
      workspaceId: me.workspaceId,
      type: input.type,
      title: input.title?.slice(0, 200) || null,
      content: body ? textToDoc(body) : null,
      plainText: body,
      occurredAt: input.occurredAt ?? new Date(),
      source: input.source,
      meta: { ...input.meta, ai: { status: "pending" } },
      inboxStatus: "inbox",
    })
    .returning({ id: entry.id });

  if (input.contactEmail) {
    const [person] = await db
      .select({ id: contact.id })
      .from(contact)
      .where(and(eq(contact.workspaceId, me.workspaceId), isNull(contact.deletedAt), sql`lower(${contact.email}) = ${input.contactEmail.toLowerCase()}`));
    if (person) {
      await db.insert(entryContact).values({ entryId: created.id, contactId: person.id, role: "author" });
      await db.update(contact).set({ lastInteractionAt: input.occurredAt ?? new Date() }).where(eq(contact.id, person.id));
    }
  }

  for (const file of input.files ?? []) {
    const key = newStorageKey(me.workspaceId, file.name);
    await storeFile(key, file.data, file.mimeType);
    await recordAttachment(me, { storageKey: key, fileName: file.name, mimeType: file.mimeType, sizeBytes: file.data.byteLength }, created.id);
  }
  if (body.trim().length >= 20) scheduleProcessing(me.workspaceId, created.id);
  return created.id;
}
