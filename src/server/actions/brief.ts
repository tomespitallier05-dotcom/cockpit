"use server";

import { refresh } from "next/cache";
import { buildBrief } from "../ai/brief";
import { fail, ok, type ActionResult } from "../dal";
import { getActionUser } from "../session";

/** Rewrites today's brief, with Claude when it is configured. */
export async function refreshBrief(): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    await buildBrief(me.workspaceId, { useAi: true });
    refresh();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
