import { NextResponse } from "next/server";
import { captureEntry } from "@/server/inbound";
import { getRequestUser } from "@/server/session";

export const maxDuration = 60;

/**
 * Web Share Target (Android and desktop PWA): "Share → Cockpit" from any app posts
 * here. Text, links and files become one Inbox entry, then the entry opens.
 * iPhone has no share target: the iOS Shortcut posts to the same place.
 */
export async function POST(request: Request) {
  const me = await getRequestUser(request);
  if (!me) return NextResponse.redirect(new URL("/login?next=/inbox", request.url), 303);
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const text = String(form.get("text") ?? "").trim();
  const url = String(form.get("url") ?? "").trim() || text.match(/https?:\/\/\S+/)?.[0] || "";
  const files = form
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0 && value.size <= 25 * 1024 * 1024)
    .slice(0, 5);

  const id = await captureEntry(me, {
    type: url && !files.length ? "link" : files.length ? "file" : "note",
    title: title || (files[0]?.name ?? null),
    body: [text, url && !text.includes(url) ? url : ""].filter(Boolean).join("\n"),
    source: "share",
    meta: url ? { url } : {},
    files: await Promise.all(files.map(async (file) => ({ name: file.name, mimeType: file.type || "application/octet-stream", data: new Uint8Array(await file.arrayBuffer()) }))),
  });
  return NextResponse.redirect(new URL(`/entrees/${id}`, request.url), 303);
}
