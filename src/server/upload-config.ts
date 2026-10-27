import "server-only";
import type { UploadConfig } from "@/lib/upload-client";
import type { CurrentUser } from "./session";
import { uploadMode, workspacePrefix } from "./storage";

export function uploadConfigFor(me: CurrentUser): UploadConfig {
  return { mode: uploadMode(), prefix: workspacePrefix(me.workspaceId) };
}
