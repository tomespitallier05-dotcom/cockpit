import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { attachment, entry } from "./db/schema";
import type { CurrentUser } from "./session";
import { kindFor } from "./storage";

/**
 * Records a stored file. Without an entry, the file becomes its own "file" entry
 * in the inbox, like any other capture.
 */
export async function recordAttachment(
  me: CurrentUser,
  file: { storageKey: string; fileName: string; mimeType: string; sizeBytes: number },
  entryId?: string | null,
) {
  let targetEntryId = entryId ?? null;
  if (targetEntryId) {
    const [owned] = await db
      .select({ id: entry.id })
      .from(entry)
      .where(and(eq(entry.id, targetEntryId), eq(entry.workspaceId, me.workspaceId), isNull(entry.deletedAt)));
    if (!owned) throw new Error("Entrée introuvable.");
  } else {
    const [created] = await db
      .insert(entry)
      .values({ workspaceId: me.workspaceId, type: "file", title: file.fileName, inboxStatus: "inbox", source: "upload" })
      .returning({ id: entry.id });
    targetEntryId = created.id;
  }

  const [row] = await db
    .insert(attachment)
    .values({
      workspaceId: me.workspaceId,
      entryId: targetEntryId,
      storageKey: file.storageKey,
      fileName: file.fileName.slice(0, 255),
      mimeType: file.mimeType || "application/octet-stream",
      sizeBytes: file.sizeBytes,
      kind: kindFor(file.mimeType, file.fileName),
      processingStatus: "done",
    })
    .returning({ id: attachment.id });

  return { attachmentId: row.id, entryId: targetEntryId };
}
