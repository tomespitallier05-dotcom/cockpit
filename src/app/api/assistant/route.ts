import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runAssistant, type AssistantEvent } from "@/server/ai/assistant";
import { claudeAvailable } from "@/server/ai/config";
import { db } from "@/server/db";
import { aiMessage, aiThread } from "@/server/db/schema";
import { getRequestUser } from "@/server/session";

export const maxDuration = 300;

const body = z.object({
  threadId: z.uuid().nullable().optional(),
  message: z.string().trim().min(1).max(4000),
});

/** Streams one assistant answer as newline-delimited JSON events. */
export async function POST(request: Request) {
  const me = await getRequestUser(request);
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (!claudeAvailable()) {
    return NextResponse.json({ error: "L'assistant s'active quand ANTHROPIC_API_KEY est configurée." }, { status: 503 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Message invalide." }, { status: 400 });
  const { message } = parsed.data;

  let threadId = parsed.data.threadId ?? null;
  if (threadId) {
    const [owned] = await db
      .select({ id: aiThread.id })
      .from(aiThread)
      .where(and(eq(aiThread.id, threadId), eq(aiThread.workspaceId, me.workspaceId)));
    if (!owned) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
  } else {
    const [created] = await db
      .insert(aiThread)
      .values({ workspaceId: me.workspaceId, title: message.slice(0, 80) })
      .returning({ id: aiThread.id });
    threadId = created.id;
  }

  const previous = await db
    .select({ role: aiMessage.role, content: aiMessage.content })
    .from(aiMessage)
    .where(eq(aiMessage.threadId, threadId))
    .orderBy(asc(aiMessage.createdAt));
  const history = previous
    .filter((row) => row.role !== "tool")
    .slice(-20)
    .map((row) => ({ role: row.role as "user" | "assistant", text: String((row.content as { text?: string }).text ?? "") }))
    .filter((turn) => turn.text);
  await db.insert(aiMessage).values({ threadId, role: "user", content: { text: message } });

  const encoder = new TextEncoder();
  const id = threadId;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AssistantEvent | { t: "thread"; d: string }) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      emit({ t: "thread", d: id });
      try {
        const answer = await runAssistant({ workspaceId: me.workspaceId, timezone: me.timezone, history, question: message, emit });
        await db.insert(aiMessage).values({ threadId: id, role: "assistant", content: { text: answer.text, sources: answer.sources } });
        await db.update(aiThread).set({ updatedAt: new Date() }).where(eq(aiThread.id, id));
        emit({ t: "sources", d: answer.sources });
      } catch (error) {
        console.error("assistant", error);
        emit({ t: "error", d: error instanceof Error ? error.message : "L'assistant n'a pas pu répondre." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
