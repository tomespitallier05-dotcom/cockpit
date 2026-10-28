import "server-only";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { del, get, head } from "@vercel/blob";

/**
 * Private file storage. Production uses Vercel Blob with `access: "private"`:
 * files are never public and are streamed back only through /api/fichiers/[id]
 * after a session check. Local development without a Blob token writes to
 * ./.uploads instead.
 */
export type UploadMode = "blob" | "local";

/**
 * Blob credentials come either from a read-write token or, for stores connected
 * through the Vercel dashboard, from the deployment's OIDC identity plus BLOB_STORE_ID.
 */
export function uploadMode(): UploadMode {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID ? "blob" : "local";
}

/** Server-side upload ceiling (local mode). Blob uploads go straight from the browser. */
export const LOCAL_MAX_BYTES = 25 * 1024 * 1024;
export const BLOB_MAX_BYTES = 100 * 1024 * 1024;

const LOCAL_ROOT = path.join(process.cwd(), ".uploads");

export function workspacePrefix(workspaceId: string) {
  return `workspaces/${workspaceId}/`;
}

export function newStorageKey(workspaceId: string, fileName: string) {
  const safe = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80) || "fichier";
  return `${workspacePrefix(workspaceId)}${randomUUID()}-${safe}`;
}

function localPath(key: string) {
  const resolved = path.resolve(LOCAL_ROOT, key);
  if (!resolved.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Chemin de fichier invalide.");
  return resolved;
}

export async function writeLocalFile(key: string, data: Uint8Array) {
  const target = localPath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
}

export async function readStoredFile(key: string): Promise<{ body: ReadableStream; size?: number } | null> {
  if (uploadMode() === "blob") {
    const result = await get(key, { access: "private" });
    if (!result?.stream) return null;
    return { body: result.stream, size: result.blob.size ?? undefined };
  }
  try {
    const target = localPath(key);
    const { size } = await stat(target);
    return { body: Readable.toWeb(createReadStream(target)) as ReadableStream, size };
  } catch {
    return null;
  }
}

export async function storedFileExists(key: string) {
  if (uploadMode() === "blob") {
    try {
      await head(key);
      return true;
    } catch {
      return false;
    }
  }
  return stat(localPath(key)).then(
    () => true,
    () => false,
  );
}

export async function deleteStoredFile(key: string) {
  if (uploadMode() === "blob") {
    await del(key);
    return;
  }
  await rm(localPath(key), { force: true });
}

export function kindFor(mimeType: string, fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType.startsWith("image/")) return "image" as const;
  if (mimeType === "application/pdf" || ext === "pdf") return "pdf" as const;
  if (mimeType.startsWith("audio/")) return "audio" as const;
  if (mimeType.startsWith("video/")) return "video" as const;
  if (/sheet|excel|csv/.test(mimeType) || ["xlsx", "xls", "csv", "numbers"].includes(ext)) return "spreadsheet" as const;
  if (/word|text|document|rtf/.test(mimeType) || ["doc", "docx", "txt", "md", "pages", "rtf"].includes(ext)) return "document" as const;
  return "other" as const;
}
