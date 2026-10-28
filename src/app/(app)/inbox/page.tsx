import { InboxIcon, ZapIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CaptureButton } from "@/components/capture/capture-button";
import { PageContainer, PageHeader, PageIcon } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/dal";
import { listInbox } from "@/server/data/entries";
import { listProjects } from "@/server/queries";
import { listContactOptions } from "@/server/data/contacts";
import { googleAccount } from "@/server/google";
import { uploadConfigFor } from "@/server/upload-config";
import { InboxImports } from "./inbox-imports";
import { InboxView } from "./inbox-view";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Inbox"
        description="Tout ce que tu captures arrive ici, brut. Range chaque élément dans un projet, ou classe-le : objectif Inbox zéro."
        icon={<PageIcon icon={InboxIcon} />}
        actions={
          <>
            <Suspense fallback={null}>
              <ImportsLoader />
            </Suspense>
            <CaptureButton>
              <ZapIcon /> Capturer
            </CaptureButton>
          </>
        }
      />
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
          <InboxLoader />
        </Suspense>
      </div>
    </PageContainer>
  );
}

async function InboxLoader() {
  const [me, items, projects] = await Promise.all([requireUser(), listInbox(), listProjects()]);
  return (
    <InboxView
      items={items.map(({ id, type, title, plainText, occurredAt, meta }) => {
        const ai = (meta as { ai?: { status?: string; suggestion?: { projectId?: string | null; summary?: string } } }).ai;
        return {
          id,
          type,
          title,
          plainText,
          occurredAt,
          suggestedProjectId: ai?.suggestion?.projectId ?? null,
          summary: ai?.suggestion?.summary ?? null,
          analyzing: ai?.status === "processing",
        };
      })}
      projects={projects.map(({ id, name, icon, color }) => ({ id, name, icon, color }))}
      timeZone={me.timezone}
    />
  );
}

async function ImportsLoader() {
  const me = await requireUser();
  const [contacts, google] = await Promise.all([listContactOptions(), googleAccount(me.id)]);
  return <InboxImports uploadConfig={uploadConfigFor(me)} contacts={contacts} driveConnected={Boolean(google?.drive)} />;
}
