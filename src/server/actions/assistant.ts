"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "../dal";
import { db } from "../db";
import { aiThread } from "../db/schema";
import { getActionUser } from "../session";

export async function deleteThread(threadId: string): Promise<ActionResult> {
  try {
    const me = await getActionUser();
    await db
      .delete(aiThread)
      .where(and(eq(aiThread.id, z.uuid().parse(threadId)), eq(aiThread.workspaceId, me.workspaceId)));
    refresh();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
