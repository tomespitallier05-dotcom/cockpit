import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { servedFile } from "@/lib/safe-file";
import { db } from "@/server/db";
import { attachment } from "@/server/db/schema";
import { getRequestUser } from "@/server/session";
import { readStoredFile } from "@/server/storage";

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

  // The type comes from the uploader (or from an email's sender): never serve it as-is.
  const served = servedFile(row.mimeType, new URL(request.url).searchParams.has("download"));
  const download = served.disposition === "attachment";
  return new Response(file.body, {
    headers: {
      "Content-Type": served.contentType,
      ...(file.size ? { "Content-Length": String(file.size) } : {}),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
      // Personal files never sit in the browser cache: every view re-checks the session.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // A file opened on its own page must never run code in the app's origin.
      ...(served.sandbox ? { "Content-Security-Policy": "default-src 'none'; sandbox" } : {}),
    },
  });
}
