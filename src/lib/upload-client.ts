"use client";

import { uploadPresigned } from "@vercel/blob/client";
import { registerUpload } from "@/server/actions/files";

/** Provided by the server: how this deployment stores files, and the caller's key prefix. */
export type UploadConfig = { mode: "blob" | "local"; prefix: string };

function safeName(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-80) || "fichier"
  );
}

/**
 * Uploads one file. Without `entryId` it becomes a new "file" entry in the inbox.
 * Production: straight from the browser to private Blob storage, then recorded
 * by a Server Action. Local: multipart POST to /api/fichiers.
 */
export async function uploadFile(
  file: File,
  config: UploadConfig,
  options: { entryId?: string | null; onProgress?: (percentage: number) => void } = {},
): Promise<{ attachmentId: string; entryId: string }> {
  if (config.mode === "local") {
    const form = new FormData();
    form.append("file", file);
    if (options.entryId) form.append("entryId", options.entryId);
    const response = await fetch("/api/fichiers", { method: "POST", body: form });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Envoi impossible.");
    options.onProgress?.(100);
    return body;
  }

  const blob = await uploadPresigned(`${config.prefix}${crypto.randomUUID()}-${safeName(file.name)}`, file, {
    access: "private",
    handleUploadUrl: "/api/fichiers/token",
    contentType: file.type || undefined,
    multipart: file.size > 8 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => options.onProgress?.(percentage),
  });
  const result = await registerUpload({
    pathname: blob.pathname,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    entryId: options.entryId ?? null,
  });
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

