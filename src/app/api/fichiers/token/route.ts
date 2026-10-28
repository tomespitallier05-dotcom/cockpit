import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getRequestUser } from "@/server/session";
import { BLOB_MAX_BYTES, workspacePrefix } from "@/server/storage";

/**
 * Issues a presigned URL so the browser can upload one private file straight to
 * Vercel Blob (no 4.5 MB function body limit). The signed token only allows a
 * `put` of that exact pathname, under the caller's workspace prefix, for a few
 * minutes. It works with the deployment's OIDC identity, so no long-lived Blob
 * secret is stored. Recording the file is a separate, authenticated Server
 * Action (registerUpload), so no upload-completed callback is needed.
 */
export async function POST(request: Request) {
  const me = await getRequestUser(request);
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const body = (await request.json()) as HandleUploadPresignedBody;
  try {
    const result = await handleUploadPresigned({
      request,
      body,
      getSignedToken: async (pathname) => {
        if (!pathname.startsWith(workspacePrefix(me.workspaceId))) throw new Error("Chemin refusé.");
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          maximumSizeInBytes: BLOB_MAX_BYTES,
          validUntil: Date.now() + 10 * 60 * 1000,
        });
        return { token, urlOptions: { maximumSizeInBytes: BLOB_MAX_BYTES, allowOverwrite: false } };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Envoi impossible." }, { status: 400 });
  }
}
