import { BotIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader, PageIcon } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { aiStatus } from "@/server/ai/config";
import { getThreadMessages, listThreads } from "@/server/data/assistant";
import { AssistantChat } from "./assistant-chat";

export const metadata: Metadata = { title: "Assistant" };

export default function AssistantPage({ searchParams }: PageProps<"/assistant">) {
  return (
    <PageContainer className="max-w-6xl">
      <PageHeader
        title="Assistant"
        description="Pose une question sur tout ce que tu as capturé. Chaque réponse cite ses sources, et rien n'est modifié sans ta validation."
        icon={<PageIcon icon={BotIcon} />}
      />
      <Suspense fallback={<Skeleton className="mt-8 h-[60vh] w-full rounded-2xl" />}>
        <AssistantLoader searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function AssistantLoader({ searchParams }: { searchParams: PageProps<"/assistant">["searchParams"] }) {
  const params = await searchParams;
  const threadId = typeof params.c === "string" && /^[0-9a-f-]{36}$/i.test(params.c) ? params.c : null;
  const [threads, messages] = await Promise.all([listThreads(), threadId ? getThreadMessages(threadId) : null]);
  return (
    <AssistantChat
      key={threadId ?? "new"}
      threads={threads}
      threadId={messages ? threadId : null}
      initialMessages={messages ?? []}
      initialQuestion={typeof params.q === "string" ? params.q.slice(0, 4000) : undefined}
      configured={aiStatus().claude}
    />
  );
}
