import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Source } from "../ai/retrieval";
import { requireUser } from "../dal";
import { db } from "../db";
import { aiMessage, aiThread } from "../db/schema";

export type ChatMessage = { id: string; role: "user" | "assistant"; text: string; sources: Source[] };

export async function listThreads(limit = 30) {
  const me = await requireUser();
  return db
    .select({ id: aiThread.id, title: aiThread.title, updatedAt: aiThread.updatedAt })
    .from(aiThread)
    .where(eq(aiThread.workspaceId, me.workspaceId))
    .orderBy(desc(aiThread.updatedAt))
    .limit(limit);
}

export async function getThreadMessages(threadId: string): Promise<ChatMessage[] | null> {
  const me = await requireUser();
  const [thread] = await db
    .select({ id: aiThread.id })
    .from(aiThread)
    .where(and(eq(aiThread.id, threadId), eq(aiThread.workspaceId, me.workspaceId)));
  if (!thread) return null;
  const rows = await db
    .select({ id: aiMessage.id, role: aiMessage.role, content: aiMessage.content })
    .from(aiMessage)
    .where(eq(aiMessage.threadId, threadId))
    .orderBy(asc(aiMessage.createdAt));
  return rows
    .filter((row) => row.role !== "tool")
    .map((row) => {
      const content = row.content as { text?: string; sources?: Source[] };
      return { id: row.id, role: row.role as "user" | "assistant", text: content.text ?? "", sources: content.sources ?? [] };
    });
}
