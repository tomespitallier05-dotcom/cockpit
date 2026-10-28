import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { attachment } from "@/server/db/schema";
import { getRequestUser } from "@/server/session";
import { readStoredFile } from "@/server/storage";

const INLINE_KINDS = new Set(["image", "pdf", "audio", "video"]);

/** Streams a private file to its owner. `?download=1` forces a download. */
export async function GET(request: Request, { params }: RouteContext<"/api/fichiers/[id]">) {
  const me = await getRequestUser(request);
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const [row] = await db
    .select()
    .from(attachment)
    .where(and(eq(attachment.id, id), eq(attachment.workspaceId, me.workspaceId)));
  if (!row) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const file = await readStoredFile(row.storageKey);
  if (!file) return NextResponse.json({ error: "Fichier manquant." }, { status: 404 });

  const download = new URL(request.url).searchParams.has("download") || !INLINE_KINDS.has(row.kind);
  return new Response(file.body, {
    headers: {
      "Content-Type": row.mimeType,
      ...(file.size ? { "Content-Length": String(file.size) } : {}),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
      // Personal files never sit in the browser cache: every view re-checks the session.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
