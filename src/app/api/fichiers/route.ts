import { NextResponse } from "next/server";
import { recordAttachment } from "@/server/attachments";
import { getRequestUser } from "@/server/session";
import { LOCAL_MAX_BYTES, newStorageKey, uploadMode, writeLocalFile } from "@/server/storage";

/** Local-mode upload (development). In production the browser uploads straight to Blob. */
export async function POST(request: Request) {
  const me = await getRequestUser(request);
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (uploadMode() !== "local") {
    return NextResponse.json({ error: "Utilise l'envoi direct vers le stockage." }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const entryId = form.get("entryId");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  if (file.size > LOCAL_MAX_BYTES) {
    return NextResponse.json({ error: "Fichier trop lourd (25 Mo maximum)." }, { status: 413 });
  }

  try {
    const storageKey = newStorageKey(me.workspaceId, file.name);
    await writeLocalFile(storageKey, new Uint8Array(await file.arrayBuffer()));
    const result = await recordAttachment(
      me,
      { storageKey, fileName: file.name, mimeType: file.type, sizeBytes: file.size },
      typeof entryId === "string" && entryId ? entryId : null,
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Envoi impossible." }, { status: 400 });
  }
}
