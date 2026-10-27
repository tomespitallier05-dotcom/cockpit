"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { recordAttachment } from "../attachments";
import { fail, ok, type ActionResult } from "../dal";
import { db } from "../db";
import { attachment } from "../db/schema";
import { getActionUser } from "../session";
import { BLOB_MAX_BYTES, deleteStoredFile, storedFileExists, workspacePrefix } from "../storage";

const uploadedInput = z.object({
  pathname: z.string().min(1).max(400),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(200),
  sizeBytes: z.number().int().min(0).max(BLOB_MAX_BYTES),
  entryId: z.uuid().nullable().optional(),
});

/**
 * Called by the browser after a direct upload to Vercel Blob. The file must sit
 * under the caller's workspace prefix and actually exist before it is recorded.
 */
export async function registerUpload(
  input: z.input<typeof uploadedInput>,
): Promise<ActionResult<{ attachmentId: string; entryId: string }>> {
  try {
    const me = await getActionUser();
    const data = uploadedInput.parse(input);
    if (!data.pathname.startsWith(workspacePrefix(me.workspaceId))) throw new Error("Fichier refusé.");
    if (!(await storedFileExists(data.pathname))) throw new Error("Le fichier n'a pas été reçu.");
    const result = await recordAttachment(
      me,
      { storageKey: data.pathname, fileName: data.fileName, mimeType: data.mimeType, sizeBytes: data.sizeBytes },
      data.entryId,
    );
    refresh();
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteAttachment(id: string): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    const [row] = await db
      .delete(attachment)
      .where(and(eq(attachment.id, z.uuid().parse(id)), eq(attachment.workspaceId, me.workspaceId)))
      .returning({ storageKey: attachment.storageKey });
    if (row) await deleteStoredFile(row.storageKey);
    refresh();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
