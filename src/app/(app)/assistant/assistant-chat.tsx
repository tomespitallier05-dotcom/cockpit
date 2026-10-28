"use client";

import { ArrowUpIcon, Loader2Icon, MessageSquarePlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { deleteThread } from "@/server/actions/assistant";

type Source = { n: number; entryId: string; title: string; date: string; projectName: string | null };
type Message = { id: string; role: "user" | "assistant"; text: string; sources: Source[] };

const SUGGESTIONS = [
  "Que m'a conseillé mon mentor ces 30 derniers jours ?",
  "Quels produits semblent les plus prometteurs ?",
  "Quelles erreurs reviennent souvent ?",
  "Analyse mon évolution ce mois-ci",
  "Quels sont mes blocages principaux ?",
  "Montre mes meilleurs résultats",
];

export function AssistantChat({
  threads,
  threadId: initialThreadId,
  initialMessages,
  initialQuestion,
  configured,
}: {
  threads: { id: string; title: string | null; updatedAt: Date }[];
  threadId: string | null;
  initialMessages: Message[];
  initialQuestion?: string;
  configured: boolean;
}) {
  const router = useRouter();
  const [threadId, setThreadId] = useState(initialThreadId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const askedInitial = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, status]);

  const send = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setStatus("Réflexion…");
    const assistantId = `a${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: `u${Date.now()}`, role: "user", text, sources: [] },
      { id: assistantId, role: "assistant", text: "", sources: [] },
    ]);
    const patch = (update: (message: Message) => Message) =>
      setMessages((current) => current.map((m) => (m.id === assistantId ? update(m) : m)));

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, message: text }),
      });
      if (!response.ok || !response.body) {
        const error = await response.json().catch(() => ({ error: "L'assistant n'a pas pu répondre." }));
        throw new Error(error.error);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { t: string; d: unknown };
          if (event.t === "thread" && typeof event.d === "string") {
            setThreadId(event.d);
            window.history.replaceState(null, "", `/assistant?c=${event.d}`);
          } else if (event.t === "text") {
            setStatus(null);
            patch((m) => ({ ...m, text: m.text + String(event.d) }));
          } else if (event.t === "status") {
            setStatus(String(event.d));
          } else if (event.t === "sources") {
            patch((m) => ({ ...m, sources: event.d as Source[] }));
          } else if (event.t === "error") {
            toast.error(String(event.d));
          }
        }
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L'assistant n'a pas pu répondre.");
      patch((m) => (m.text ? m : { ...m, text: "_Pas de réponse._" }));
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };

  // ⌘K "Demander à l'assistant" lands here with ?q=…
  useEffect(() => {
    if (initialQuestion && !askedInitial.current && configured) {
      askedInitial.current = true;
      void send(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deleteThread(id);
      if (!result.ok) return void toast.error(result.error);
      if (id === threadId) router.push("/assistant");
    });

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden md:block">
        <Button asChild variant="outline" size="sm" className="w-full justify-start">
          <Link href="/assistant">
            <MessageSquarePlusIcon />
            Nouvelle conversation
          </Link>
        </Button>
        <ul className="mt-3 space-y-0.5">
          {threads.map((thread) => (
            <li key={thread.id} className="group flex items-center">
              <Link
                href={`/assistant?c=${thread.id}`}
                className={cn(
                  "min-w-0 flex-1 truncate rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors",
                  thread.id === threadId ? "bg-white/[0.06] text-foreground" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                )}
              >
                {thread.title || "Conversation"}
              </Link>
              <button
                type="button"
                onClick={() => remove(thread.id)}
                className="ml-1 hidden rounded p-1 text-subtle hover:text-destructive group-hover:block"
                aria-label="Supprimer la conversation"
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="surface flex min-h-[60vh] min-w-0 flex-col">
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="py-6">
              <p className="text-[13.5px] text-muted-foreground">
                {configured
                  ? "L'assistant cherche dans tes notes, appels, messages, tâches, KPI, inventaire et contenus. Essaie :"
                  : "L'assistant s'active quand ANTHROPIC_API_KEY est ajoutée dans les variables Vercel."}
              </p>
              {configured ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void send(suggestion)}
                      className="rounded-lg border border-border bg-white/[0.02] px-3 py-1.5 text-left text-[12.5px] text-muted-foreground transition-colors hover:border-white/15 hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary/15 px-3.5 py-2 text-[13.5px] text-foreground">
                  {message.text}
                </p>
              </div>
            ) : (
              <div key={message.id} className="max-w-[92%] text-[13.5px] text-muted-foreground">
                {message.text ? <Markdown text={message.text} citations={message.sources} /> : null}
                {message.sources.length ? (
                  <ol className="mt-3 space-y-1 border-t border-border pt-3">
                    {message.sources.map((source) => (
                      <li key={source.n} className="text-[12px]">
                        <Link href={`/entrees/${source.entryId}`} className="text-subtle hover:text-foreground">
                          <span className="mr-1.5 text-primary">{source.n}</span>
                          {source.title} · {source.date}
                          {source.projectName ? ` · ${source.projectName}` : ""}
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            ),
          )}
          {status ? (
            <p className="flex items-center gap-2 text-[12.5px] text-subtle">
              <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
              {status}
            </p>
          ) : null}
          <div ref={endRef} />
        </div>
        <form
          className="flex items-end gap-2 border-t border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
        >
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder={configured ? "Pose ta question…" : "Assistant non configuré"}
            disabled={!configured}
            className="max-h-40 min-h-10 resize-none"
            aria-label="Question"
          />
          <Button type="submit" size="icon" disabled={!configured || busy || !input.trim()} aria-label="Envoyer">
            {busy ? <Loader2Icon className="animate-spin" /> : <ArrowUpIcon />}
          </Button>
        </form>
      </section>
    </div>
  );
}
