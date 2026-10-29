/**
 * How a stored file may be served from /api/fichiers/[id].
 *
 * The MIME type is whatever the uploader (or the sender of a forwarded email) claimed. Served
 * inline from the app's own origin, an SVG or an HTML page disguised as « photo.pdf » would run
 * its scripts with the owner's session. So only formats a browser renders without executing
 * code are shown inline, under their exact type; everything else is downloaded as opaque bytes.
 */
const INLINE_IMAGES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);
const INLINE_MEDIA = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export type ServedFile = {
  contentType: string;
  disposition: "inline" | "attachment";
  /** Add a `sandbox` CSP: everything inline except PDFs, whose viewer cannot be sandboxed. */
  sandbox: boolean;
};

export function servedFile(mimeType: string, forceDownload = false): ServedFile {
  const type = mimeType.split(";")[0].trim().toLowerCase();
  const inlineable = INLINE_IMAGES.has(type) || INLINE_MEDIA.has(type) || type === "application/pdf";
  if (!inlineable) {
    return { contentType: "application/octet-stream", disposition: "attachment", sandbox: true };
  }
  return { contentType: type, disposition: forceDownload ? "attachment" : "inline", sandbox: type !== "application/pdf" };
}
