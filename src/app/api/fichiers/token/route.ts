import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getRequestUser } from "@/server/session";
import { BLOB_MAX_BYTES, workspacePrefix } from "@/server/storage";

/**
 * Issues a short-lived token so the browser can upload a private file straight
 * to Vercel Blob (no 4.5 MB function body limit). The token only allows writing
 * under the caller's workspace prefix. Recording the file is a separate,
 * authenticated Server Action (registerUpload), so no Blob callback is needed.
 */
export async function POST(request: Request) {
  const me = await getRequestUser(request);
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(workspacePrefix(me.workspaceId))) throw new Error("Chemin refusé.");
        return { maximumSizeInBytes: BLOB_MAX_BYTES, addRandomSuffix: false, allowOverwrite: false };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Envoi impossible." }, { status: 400 });
  }
}
