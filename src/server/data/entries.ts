import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { EntryMeta } from "@/lib/entry-catalog";
import { requireUser } from "../dal";
import { db } from "../db";
import { attachment, contact, entry, entryContact, project } from "../db/schema";

const entryListColumns = {
  id: entry.id,
  type: entry.type,
  title: entry.title,
  plainText: entry.plainText,
  occurredAt: entry.occurredAt,
  inboxStatus: entry.inboxStatus,
  pinned: entry.pinned,
  source: entry.source,
  projectId: entry.projectId,
  projectName: project.name,
  projectSlug: project.slug,
  projectColor: project.color,
  projectIcon: project.icon,
  meta: entry.meta,
};

export type EntryListItem = Awaited<ReturnType<typeof listEntries>>[number];

/** Timeline of entries, newest event first. */
export async function listEntries(options: { projectId?: string; limit?: number } = {}) {
  const me = await requireUser();
  return db
    .select(entryListColumns)
    .from(entry)
    .leftJoin(project, eq(entry.projectId, project.id))
    .where(
      and(
        eq(entry.workspaceId, me.workspaceId),
        isNull(entry.deletedAt),
        options.projectId ? eq(entry.projectId, options.projectId) : undefined,
      ),
    )
    .orderBy(desc(entry.pinned), desc(entry.occurredAt))
    .limit(options.limit ?? 200);
}

/** Raw captures waiting to be triaged, oldest first so nothing rots at the bottom. */
export async function listInbox() {
  const me = await requireUser();
  return db
    .select(entryListColumns)
    .from(entry)
    .leftJoin(project, eq(entry.projectId, project.id))
    .where(and(eq(entry.workspaceId, me.workspaceId), eq(entry.inboxStatus, "inbox"), isNull(entry.deletedAt)))
    .orderBy(asc(entry.createdAt));
}

export type EntryDetail = NonNullable<Awaited<ReturnType<typeof getEntryDetail>>>;

export async function getEntryDetail(id: string) {
  const me = await requireUser();
  const [row] = await db
    .select({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      content: entry.content,
      occurredAt: entry.occurredAt,
      meta: entry.meta,
      inboxStatus: entry.inboxStatus,
      pinned: entry.pinned,
      isPrivate: entry.isPrivate,
      source: entry.source,
      projectId: entry.projectId,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })
    .from(entry)
    .where(and(eq(entry.id, id), eq(entry.workspaceId, me.workspaceId), isNull(entry.deletedAt)))
    .limit(1);
  if (!row) return null;

  const [contacts, files] = await Promise.all([
    db
      .select({ id: contact.id, name: contact.name, role: entryContact.role })
      .from(entryContact)
      .innerJoin(contact, eq(entryContact.contactId, contact.id))
      .where(and(eq(entryContact.entryId, id), isNull(contact.deletedAt)))
      .orderBy(asc(contact.name)),
    listAttachmentsFor([id]),
  ]);

  return { ...row, meta: (row.meta ?? {}) as EntryMeta, contacts, files };
}

export type AttachmentItem = Awaited<ReturnType<typeof listAttachmentsFor>>[number];

export async function listAttachmentsFor(entryIds: string[]) {
  if (entryIds.length === 0) return [];
  const me = await requireUser();
  return db
    .select({
      id: attachment.id,
      entryId: attachment.entryId,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      kind: attachment.kind,
      createdAt: attachment.createdAt,
    })
    .from(attachment)
    .where(and(eq(attachment.workspaceId, me.workspaceId), inArray(attachment.entryId, entryIds)))
    .orderBy(desc(attachment.createdAt));
}

/** Every file attached to a project's entries. */
export async function listProjectFiles(projectId: string) {
  const me = await requireUser();
  return db
    .select({
      id: attachment.id,
      entryId: attachment.entryId,
      entryTitle: entry.title,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      kind: attachment.kind,
      createdAt: attachment.createdAt,
    })
    .from(attachment)
    .innerJoin(entry, eq(attachment.entryId, entry.id))
    .where(and(eq(attachment.workspaceId, me.workspaceId), eq(entry.projectId, projectId), isNull(entry.deletedAt)))
    .orderBy(desc(attachment.createdAt));
}
